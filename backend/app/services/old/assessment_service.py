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
import asyncio
import logging
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.exceptions import BizError, BizCode
from app.schemas.assessment import (
    AssessmentStartIn,
    AssessmentStartOut,
    AssessmentAvailabilityOut,
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
    format_answer_for_storage,
    normalize_single_choice_answer,
    normalize_multi_choice_answer,
    build_pagination_meta,
)
from app.services.old.gpt_call import generate_assessment_feedback

logger = logging.getLogger(__name__)

# Repositories
from app.repositories import questions as questions_repo
from app.repositories import assessment_sessions as sessions_repo
from app.repositories import assessment_items as items_repo
from app.repositories import assessment_responses as responses_repo


class AssessmentService:
    """整体评测服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_global_availability(self) -> AssessmentAvailabilityOut:
        """Return availability metadata for global assessments."""
        total_available = await questions_repo.count_total_questions(self.db)
        max_count = min(50, total_available) if total_available else 0
        default_count = min(20, max_count) if max_count else 0

        return AssessmentAvailabilityOut(
            available_total=total_available,
            default_count=default_count,
            max_count=max_count,
        )

    # ========================================
    # 一、开始整体评测（创建会话+出题）
    # ========================================

    async def start_global_assessment(
        self, *, user_id: UUID, config: Optional[AssessmentStartIn] = None
    ) -> AssessmentStartOut:
        """Start or resume a global assessment for the user."""
        existing = await sessions_repo.get_latest_unsubmitted_session(
            self.db, user_id=user_id, kind="global"
        )

        requested_count = config.count if (config and config.count) else 20
        total_available = await questions_repo.count_total_questions(self.db)

        if not existing:
            if total_available <= 0:
                raise BizError(
                    400,
                    BizCode.INVALID_REQUEST,
                    "insufficient_questions",
                    data={
                        "required": requested_count,
                        "actual": total_available,
                        "message": "No active questions are available. Please add questions before starting the assessment.",
                    },
                )
            if requested_count > total_available:
                raise BizError(
                    400,
                    BizCode.INVALID_REQUEST,
                    "insufficient_questions",
                    data={
                        "required": requested_count,
                        "actual": total_available,
                        "message": f"Only {total_available} questions available; requested {requested_count}.",
                    },
                )

        if existing:
            existing_items = await items_repo.get_session_items(
                self.db, session_id=existing.id, order_by_no=True
            )

            if existing_items:
                answered = await responses_repo.count_session_responses(
                    self.db, session_id=existing.id
                )
                last_index = existing.last_question_index or answered

                logger.info(
                    "Resuming unfinished global assessment session %s for user %s",
                    existing.id,
                    user_id,
                )

                progress = AssessmentProgress(
                    total=len(existing_items),
                    answered=answered,
                    last_question_index=last_index,
                )

                return self._build_start_out(
                    session=existing, items=existing_items, progress=progress
                )

            logger.warning(
                "Found unfinished global assessment session %s without items; removing stale session",
                existing.id,
            )
            await self.db.delete(existing)
            await self.db.flush()

        difficulty = config.difficulty if config else "mixed"
        count = requested_count

        session = await sessions_repo.create_session(
            self.db, user_id=user_id, kind="global", last_question_index=0
        )

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
                    "message": f"Only {len(questions)} questions available; requested {count}.",
                },
            )

        items = await items_repo.create_items_batch(
            self.db, session_id=session.id, questions=questions
        )

        await self.db.commit()

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

    def _build_start_out(
        self,
        *,
        session,
        items: List,
        progress: AssessmentProgress | None = None,
    ) -> AssessmentStartOut:
        """Build the DTO returned by the start endpoint."""
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

        computed_progress = progress or AssessmentProgress(
            total=len(items),
            answered=0,
            last_question_index=0,
        )

        return AssessmentStartOut(
            session_id=session.id,
            started_at=session.started_at,
            items=question_bases,
            progress=computed_progress,
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
        snapshot = item.question_snapshot or {}
        qtype = snapshot.get("qtype")
        stored_answer = (
            format_answer_for_storage(payload.answer, qtype)
            if qtype
            else payload.answer
        )

        await responses_repo.upsert_response(
            self.db,
            session_id=session_id,
            item_id=payload.item_id,
            answer=stored_answer,
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

        item_question_map: Dict[UUID, UUID] = {}
        question_ids: List[UUID] = []

        for item in items:
            snapshot = item.question_snapshot or {}
            raw_qid = snapshot.get("question_id")
            if not raw_qid:
                continue
            try:
                qid = UUID(str(raw_qid))
            except ValueError:
                continue
            item_question_map[item.id] = qid
            question_ids.append(qid)

        question_map = {}
        if question_ids:
            unique_ids = list(dict.fromkeys(question_ids))
            question_map = await questions_repo.get_questions_by_ids(self.db, unique_ids)

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

            question = question_map.get(item_question_map.get(item.id))
            is_correct = None
            score = 0.0

            if question:
                user_answer = (response.answer or "").strip()
                correct_answer = questions_repo.extract_correct_answer(question)

                if question.qtype == "single":
                    if correct_answer:
                        correct = normalize_single_choice_answer(correct_answer)
                        user = normalize_single_choice_answer(user_answer) if user_answer else ""
                        if user:
                            is_correct = user == correct
                            score = 1.0 if is_correct else 0.0

                elif question.qtype == "multi":
                    if correct_answer:
                        correct = normalize_multi_choice_answer(correct_answer)
                        user = (
                            normalize_multi_choice_answer(user_answer)
                            if user_answer
                            else ""
                        )
                        if user:
                            is_correct = user == correct
                            score = 1.0 if is_correct else 0.0

                else:
                    # 主观题暂不自动判分，沿用已有成绩（若有）
                    is_correct = response.is_correct
                    score = float(response.score or 0.0)

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
        loop = asyncio.get_running_loop()
        breakdown_payload = [item.model_dump() for item in breakdown]

        fallback_summary = f"Your overall score is {total_score:.1f}. Keep refining weaker areas."
        fallback_actions = [
            "Review topics with lower scores.",
            "Schedule additional practice sessions.",
        ]

        try:
            summary, actions = await loop.run_in_executor(
                None,
                generate_assessment_feedback,
                float(total_score),
                breakdown_payload,
            )
        except Exception as exc:
            logger.warning("Failed to generate AI feedback: %s", exc)
            summary, actions = fallback_summary, fallback_actions

        if not summary:
            summary = fallback_summary
        if not actions:
            actions = fallback_actions

        level = (
            "beginner"
            if total_score < 60
            else "intermediate" if total_score < 80 else "advanced"
        )

        focus_topics = [
            item.topic_name for item in breakdown if item.score < 80
        ]

        ai_recommendation = AIRecommendation(
            level=level,
            focus_topics=focus_topics,
            suggested_actions=actions,
        )

        return summary, ai_recommendation.model_dump()

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

        # 3. 准备题目映射，补全正确答案与解析
        question_ids: List[UUID] = []
        for _, snapshot in results:
            raw_qid = snapshot.get("question_id") if isinstance(snapshot, dict) else None
            if raw_qid:
                try:
                    question_ids.append(UUID(str(raw_qid)))
                except ValueError:
                    continue

        question_map = {}
        if question_ids:
            unique_ids = list(dict.fromkeys(question_ids))
            question_map = await questions_repo.get_questions_by_ids(self.db, unique_ids)

        # 4. 构建 items 列表
        items_with_responses = []
        for response, snapshot in results:
            # 从 questions 表查询完整题目（获取 answer_key 和 explanation）
            # TODO: 优化为批量查询
            # question = await questions_repo.get_question_by_id(...)

            question = None
            raw_qid = snapshot.get("question_id") if isinstance(snapshot, dict) else None
            if raw_qid:
                try:
                    question = question_map.get(UUID(str(raw_qid)))
                except ValueError:
                    question = None

            correct_answer = (
                questions_repo.extract_correct_answer(question) if question else None
            )
            explanation = question.explanation if question and question.explanation else None
            score_value = float(response.score) if response.score is not None else None

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
                    correct_answer=correct_answer,
                    explanation=explanation,
                    score=score_value,
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
