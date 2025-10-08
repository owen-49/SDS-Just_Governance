# backend/app/services/assessment_service.py
"""
整体评测业务逻辑（Global Assessment Service）
负责整体评测的完整流程：
1. 开始评测（创建会话+出题）
2. 逐题保存答案（自动保存）
3. 提交评测（汇总评分+AI总结）
4. 查看历史记录
5. 查看评测详情（逐题回放）
"""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.exceptions import BizError, BizCode
from app.schemas.assessment import (
    AssessmentStartIn,
    AssessmentStartOut,
    AssessmentProgress,
    AnswerSaveIn,
    AnswerSaveOut,
    AssessmentSubmitOut,
    AssessmentHistoryOut,
    AssessmentHistoryItem,
    AssessmentDetailOut,
    AssessmentSessionDetail,
    ItemWithResponse,
    QuestionBase,
    QuestionWithAnswer,
    QuestionSnapshot,
    TopicBreakdown,
    AIRecommendation,
    build_pagination_meta,
)

# Repositories
from app.repositories import questions as questions_repo
from app.repositories import assessment_sessions as sessions_repo
from app.repositories import assessment_items as items_repo
from app.repositories import assessment_responses as responses_repo


class AssessmentService:
    """整体评测服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========================================
    # 一、开始整体评测（创建会话+出题）
    # ========================================

    async def start_global_assessment(
        self, *, user_id: UUID, config: Optional[AssessmentStartIn] = None
    ) -> AssessmentStartOut:
        """
        开始整体评测

        业务逻辑：
        1. 检查用户是否有未提交的 global 会话（可选约束）
        2. 创建 assessment_sessions(kind='global', user_id=...)
        3. 从 questions 表跨主题抽题（按权重/难度策略）
        4. 写入 assessment_items(question_snapshot)
        5. 返回首屏题目（前端可分页加载或一次性全拿）

        Args:
            user_id: 用户ID
            config: 可选配置（难度、题数）

        Returns:
            AssessmentStartOut 对象

        Raises:
            BizError(409): 用户已有未提交的global会话

        Example:
            >>> assessment_service = AssessmentService(db)
            >>> result = await assessment_service.start_global_assessment(
            ...     user_id=user_id,
            ...     config=AssessmentStartIn(difficulty="mixed", count=20)
            ... )
        """
        # 1. 检查是否有未完成的会话（可选约束）
        existing = await sessions_repo.get_latest_unsubmitted_session(
            self.db, user_id=user_id, kind="global"
        )

        if existing:
            raise BizError(
                409,
                BizCode.CONFLICT,
                "unfinished_assessment_exists",
                data={
                    "session_id": str(existing.id),
                    "started_at": existing.started_at.isoformat(),
                    "message": "请先完成或删除现有评测",
                },
            )

        # 2. 解析配置
        difficulty = config.difficulty if config else "mixed"
        count = config.count if config else 20

        # 3. 创建评测会话
        session = await sessions_repo.create_session(
            self.db, user_id=user_id, kind="global", last_question_index=0
        )

        # 4. 抽题（跨主题，按难度分布）
        questions = await self._select_questions_for_global(
            difficulty=difficulty, count=count
        )

        if len(questions) < count:
            raise BizError(
                400,
                BizCode.INVALID_REQUEST,
                "insufficient_questions",
                data={
                    "required": count,
                    "actual": len(questions),
                    "message": f"题库仅有 {len(questions)} 题，需要 {count} 题",
                },
            )

        # 5. 写入 assessment_items（题目快照）
        items = await items_repo.create_items_batch(
            self.db, session_id=session.id, questions=questions
        )

        await self.db.commit()

        # 6. 构建响应
        return self._build_start_out(session=session, items=items)

    async def _select_questions_for_global(self, difficulty: str, count: int) -> List:
        """
        为整体评测选题

        策略：
        - mixed: 全局随机抽题
        - 其他难度: 按难度过滤（需要 questions 表有 difficulty 字段）

        Args:
            difficulty: 难度策略
            count: 题目数量

        Returns:
            题目列表（QuestionDTO）
        """
        if difficulty == "mixed":
            # 全局随机抽题
            questions = await questions_repo.get_random_questions(self.db, count=count)
        else:
            # TODO: 按难度过滤（需要扩展 questions 表）
            questions = await questions_repo.get_random_questions(self.db, count=count)

        return questions

    def _build_start_out(self, *, session, items: List) -> AssessmentStartOut:
        """
        构建开始评测响应

        Args:
            session: 评测会话对象
            items: 题目实例列表

        Returns:
            AssessmentStartOut 对象
        """
        question_bases = []
        for item in items:
            snapshot = item.question_snapshot
            question_bases.append(
                QuestionBase(
                    item_id=item.id,
                    order_no=item.order_no,
                    snapshot=QuestionSnapshot(
                        qtype=snapshot["qtype"],
                        stem=snapshot["stem"],
                        choices=snapshot.get("choices"),
                    ),
                )
            )

        progress = AssessmentProgress(
            total=len(items), answered=0, last_question_index=0
        )

        return AssessmentStartOut(
            session_id=session.id,
            started_at=session.started_at,
            items=question_bases,
            progress=progress,
        )

    # ========================================
    # 二、逐题保存答案（自动保存）
    # ========================================

    async def save_answer(
        self, *, session_id: UUID, user_id: UUID, payload: AnswerSaveIn
    ) -> AnswerSaveOut:
        """
        保存单题答案（自动保存）

        业务逻辑：
        1. 验证会话归属（session.user_id == current_user.id）
        2. 查询 assessment_items 确认 item_id 属于该会话
        3. 写入/更新 assessment_responses(answer)
        4. 客观题可实时计算 is_correct（但不影响总分）
        5. 更新 assessment_sessions.last_question_index

        Args:
            session_id: 会话ID
            user_id: 用户ID（权限校验）
            payload: AnswerSaveIn 对象

        Returns:
            AnswerSaveOut 对象

        Raises:
            BizError(403): 无权访问他人会话
            BizError(404): 会话或题目不存在
            BizError(409): 会话已提交（不可再答题）
            BizError(422): 答案格式错误

        Example:
            >>> result = await assessment_service.save_answer(
            ...     session_id=session_id,
            ...     user_id=user_id,
            ...     payload=AnswerSaveIn(item_id=item_id, answer="B")
            ... )
        """
        # 1. 验证会话归属
        session = await sessions_repo.get_user_session(
            self.db, session_id=session_id, user_id=user_id
        )

        if not session:
            raise BizError(403, BizCode.FORBIDDEN, "forbidden")

        # 2. 检查会话是否已提交
        if session.submitted_at:
            raise BizError(409, BizCode.ALREADY_DONE, "assessment_already_submitted")

        # 3. 验证 item_id 属于该会话
        item = await items_repo.get_item_by_id(self.db, payload.item_id)

        if not item or item.session_id != session_id:
            raise BizError(404, BizCode.NOT_FOUND, "item_not_found")

        # 4. Upsert 答题记录（创建或更新）
        # TODO: 可选实时判分（需要查询 question 的 answer_key）
        await responses_repo.upsert_response(
            self.db,
            session_id=session_id,
            item_id=payload.item_id,
            answer=payload.answer,
        )

        # 5. 更新 last_question_index（可选）
        if payload.last_question_index is not None:
            await sessions_repo.update_last_question_index(
                self.db,
                session_id=session_id,
                last_question_index=payload.last_question_index,
            )

        await self.db.commit()

        # 6. 查询当前进度
        answered = await responses_repo.count_session_responses(self.db, session_id)
        total = await items_repo.count_session_items(self.db, session_id)

        progress = AssessmentProgress(
            total=total,
            answered=answered,
            last_question_index=payload.last_question_index or 0,
        )

        return AnswerSaveOut(saved=True, progress=progress)

    # ========================================
    # 三、提交整体评测（汇总评分+AI总结）
    # ========================================

    async def submit_and_finalize(
        self, *, session_id: UUID, user_id: UUID, force: bool = False
    ) -> AssessmentSubmitOut:
        """
        提交整体评测

        业务逻辑：
        1. 验证会话归属 & 状态（未提交 & 未过期）
        2. 检查是否所有题目都已答（force=False 时）
        3. 从 assessment_responses 聚合计算 total_score
        4. 更新 assessment_sessions:
           - submitted_at = NOW()
           - total_score
           - ai_summary, ai_recommendation（可异步生成）
        5. 分项得分：按 question_topics 分组统计

        Args:
            session_id: 会话ID
            user_id: 用户ID（权限校验）
            force: 强制提交（有未答题时）

        Returns:
            AssessmentSubmitOut 对象

        Raises:
            BizError(403): 无权访问他人会话
            BizError(404): 会话不存在
            BizError(409): 会话已提交（重复提交）
            BizError(422): 有未答题且未设置force=true

        Example:
            >>> result = await assessment_service.submit_and_finalize(
            ...     session_id=session_id,
            ...     user_id=user_id,
            ...     force=False
            ... )
        """
        # 1. 验证会话归属
        session = await sessions_repo.get_user_session(
            self.db, session_id=session_id, user_id=user_id
        )

        if not session:
            raise BizError(403, BizCode.FORBIDDEN, "forbidden")

        # 2. 检查是否已提交
        if session.submitted_at:
            raise BizError(409, BizCode.ALREADY_DONE, "assessment_already_submitted")

        # 3. 检查是否所有题目都已答
        total_items = await items_repo.count_session_items(self.db, session_id)
        is_complete, answered = await responses_repo.check_all_items_answered(
            self.db, session_id, total_items
        )

        if not is_complete and not force:
            raise BizError(
                422,
                BizCode.VALIDATION_ERROR,
                "unanswered_questions",
                data={
                    "total": total_items,
                    "answered": answered,
                    "unanswered": total_items - answered,
                    "message": f"还有 {total_items - answered} 题未答，请设置 force=true 强制提交",
                },
            )

        # 4. 获取所有答题记录并判分
        items = await items_repo.get_session_items(self.db, session_id)
        responses = await responses_repo.get_session_responses(self.db, session_id)

        # 构建映射：item_id -> response
        responses_map = {resp.item_id: resp for resp in responses}

        # 判分（如果还未判分）
        grading_results = await self._grade_all_responses(
            items=items, responses_map=responses_map
        )

        # 批量更新判分结果
        item_scores = {}
        for result in grading_results:
            if result["is_correct"] is not None:
                item_scores[result["item_id"]] = {
                    "is_correct": result["is_correct"],
                    "score": result["score"],
                }

        if item_scores:
            await responses_repo.batch_update_scores(self.db, item_scores)

        # 5. 计算总分
        total_score = await responses_repo.calculate_session_total_score(
            self.db, session_id
        )
        total_score_percent = (total_score / len(items)) * 100 if items else 0.0

        # 6. 生成分项得分（按主题统计）
        breakdown = await self._calculate_breakdown(
            session_id=session_id, items=items, responses_map=responses_map
        )

        # 7. 生成 AI 总结和建议（可异步）
        ai_summary, ai_recommendation = await self._generate_ai_content(
            total_score=total_score_percent, breakdown=breakdown
        )

        # 8. 更新会话状态
        await sessions_repo.mark_as_submitted(
            self.db,
            session_id=session_id,
            total_score=total_score_percent,
            ai_summary=ai_summary,
            ai_recommendation=ai_recommendation,
        )

        await self.db.commit()

        # 9. 构建响应
        return AssessmentSubmitOut(
            session_id=session_id,
            total_score=round(total_score_percent, 2),
            breakdown=breakdown,
            ai_summary=ai_summary,
            ai_recommendation=ai_recommendation,
            submitted_at=datetime.now(timezone.utc),
        )

    async def _grade_all_responses(
        self, *, items: List, responses_map: dict
    ) -> List[dict]:
        """
        判分所有答题记录

        Args:
            items: 题目实例列表
            responses_map: {item_id: response} 映射

        Returns:
            判分结果列表
        """
        results = []

        for item in items:
            response = responses_map.get(item.id)

            if not response:
                # 未答题，跳过
                results.append(
                    {
                        "item_id": item.id,
                        "order_no": item.order_no,
                        "is_correct": None,
                        "score": 0.0,
                    }
                )
                continue

            # 如果已判分，跳过
            if response.is_correct is not None:
                results.append(
                    {
                        "item_id": item.id,
                        "order_no": item.order_no,
                        "is_correct": response.is_correct,
                        "score": float(response.score or 0.0),
                    }
                )
                continue

            # 判分逻辑（复用 quiz_service 的逻辑）
            snapshot = item.question_snapshot
            qtype = snapshot.get("qtype")

            # TODO: 需要从 questions 表获取 answer_key
            # 暂时简化：假设已有 answer_key 在 snapshot 中
            # 实际应该：从 question_id 查询完整题目

            is_correct = False
            score = 0.0

            if qtype == "single":
                # 单选题判分
                is_correct = True  # TODO: 实现判分逻辑
                score = 1.0 if is_correct else 0.0

            elif qtype == "multi":
                # 多选题判分
                score = 0.5  # TODO: 实现部分对逻辑

            results.append(
                {
                    "item_id": item.id,
                    "order_no": item.order_no,
                    "is_correct": is_correct,
                    "score": score,
                }
            )

        return results

    async def _calculate_breakdown(
        self, *, session_id: UUID, items: List, responses_map: dict
    ) -> List[TopicBreakdown]:
        """
        计算分主题得分

        Args:
            session_id: 会话ID
            items: 题目实例列表
            responses_map: {item_id: response} 映射

        Returns:
            分主题得分列表

        Note:
            需要从 question_topics 查询每题的主题归属
        """
        # TODO: 实现分主题统计
        # 1. 从 items 提取 question_id 列表
        # 2. 查询 question_topics 获取主题归属
        # 3. 按主题分组统计得分

        # 暂时返回空列表
        return []

    async def _generate_ai_content(
        self, *, total_score: float, breakdown: List[TopicBreakdown]
    ) -> tuple[Optional[str], Optional[dict]]:
        """
        生成 AI 总结和建议

        Args:
            total_score: 总分（百分制）
            breakdown: 分主题得分

        Returns:
            (ai_summary, ai_recommendation) 元组

        Note:
            可以异步生成，先返回基础结果，后台更新
        """
        # TODO: 调用 OpenAI API 生成总结和建议
        # 暂时返回模拟数据

        ai_summary = f"您的总分为 {total_score:.1f}分，表现良好。"

        level = (
            "beginner"
            if total_score < 60
            else "intermediate" if total_score < 80 else "advanced"
        )

        ai_recommendation = AIRecommendation(
            level=level,
            focus_topics=[],
            suggested_actions=[
                "复习薄弱环节",
                "多做练习题",
            ],
        )

        return ai_summary, ai_recommendation.model_dump()

    # ========================================
    # 四、查看历史记录（个人中心）
    # ========================================

    async def get_user_history(
        self, *, user_id: UUID, page: int = 1, limit: int = 10
    ) -> AssessmentHistoryOut:
        """
        查询用户的评测历史

        Args:
            user_id: 用户ID
            page: 页码（从1开始）
            limit: 每页条数

        Returns:
            AssessmentHistoryOut 对象

        Example:
            >>> result = await assessment_service.get_user_history(
            ...     user_id=user_id, page=1, limit=10
            ... )
        """
        sessions, total = await sessions_repo.get_user_history(
            self.db, user_id=user_id, kind="global", page=page, limit=limit
        )

        items = []
        for session in sessions:
            # 查询题目数量
            question_count = await items_repo.count_session_items(self.db, session.id)

            items.append(
                AssessmentHistoryItem(
                    session_id=session.id,
                    kind=session.kind,
                    started_at=session.started_at,
                    submitted_at=session.submitted_at,
                    total_score=(
                        float(session.total_score) if session.total_score else None
                    ),
                    question_count=question_count,
                )
            )

        pagination = build_pagination_meta(page, limit, total)

        return AssessmentHistoryOut(items=items, pagination=pagination)

    # ========================================
    # 五、查看评测详情（逐题回放）
    # ========================================

    async def get_session_detail(
        self, *, session_id: UUID, user_id: UUID
    ) -> AssessmentDetailOut:
        """
        查询评测详情（逐题回放）

        Args:
            session_id: 会话ID
            user_id: 用户ID（权限校验）

        Returns:
            AssessmentDetailOut 对象

        Raises:
            BizError(403): 无权访问他人会话
            BizError(404): 会话不存在或未提交

        Example:
            >>> result = await assessment_service.get_session_detail(
            ...     session_id=session_id, user_id=user_id
            ... )
        """
        # 1. 验证会话归属
        session = await sessions_repo.get_user_session(
            self.db, session_id=session_id, user_id=user_id
        )

        if not session:
            raise BizError(403, BizCode.FORBIDDEN, "forbidden")

        # 2. 检查是否已提交（只能查看已提交的详情）
        if not session.submitted_at:
            raise BizError(404, BizCode.NOT_FOUND, "assessment_not_submitted")

        # 3. 查询题目和答题记录（JOIN）
        results = await responses_repo.get_responses_with_items(self.db, session_id)

        # 4. 构建 items 列表
        items_with_responses = []
        for response, snapshot in results:
            # 从 questions 表查询完整题目（获取 answer_key 和 explanation）
            # TODO: 优化为批量查询
            # question = await questions_repo.get_question_by_id(...)

            items_with_responses.append(
                ItemWithResponse(
                    order_no=response.item.order_no,
                    snapshot=QuestionSnapshot(
                        qtype=snapshot["qtype"],
                        stem=snapshot["stem"],
                        choices=snapshot.get("choices"),
                    ),
                    response=QuestionWithAnswer(
                        item_id=response.item.id,
                        order_no=response.item.order_no,
                        snapshot=QuestionSnapshot(
                            qtype=snapshot["qtype"],
                            stem=snapshot["stem"],
                            choices=snapshot.get("choices"),
                        ),
                        your_answer=response.answer,
                        is_correct=response.is_correct,
                        correct_answer=None,  # TODO: 从 question 获取
                        explanation=None,  # TODO: 从 question 获取
                        score=float(response.score) if response.score else None,
                    ),
                )
            )

        # 5. 构建会话详情
        session_detail = AssessmentSessionDetail(
            session_id=session.id,
            kind=session.kind,
            topic_id=session.topic_id,
            started_at=session.started_at,
            submitted_at=session.submitted_at,
            total_score=float(session.total_score) if session.total_score else None,
            ai_summary=session.ai_summary,
            ai_recommendation=(
                AIRecommendation(**session.ai_recommendation)
                if session.ai_recommendation
                else None
            ),
        )

        return AssessmentDetailOut(session=session_detail, items=items_with_responses)
