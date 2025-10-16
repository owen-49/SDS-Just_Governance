# backend/app/services/quiz_service.py
"""
主题小测业务逻辑（Topic Quiz Service）
负责主题小测的完整流程：
1. 生成/获取待做题单（不建会话）
2. 提交并判分（建会话、落库、更新进度）
"""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.exceptions import BizError, BizCode
from app.schemas.assessment import (
    QuizPendingOut,
    QuizSubmitIn,
    QuizSubmitOut,
    QuestionBase,
    QuestionWithAnswer,
    AnswerItem,
)

# Repositories
from app.repositories import questions as questions_repo
from app.repositories import assessment_sessions as sessions_repo
from app.repositories import assessment_items as items_repo
from app.repositories import assessment_responses as responses_repo


class QuizService:
    """主题小测服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========================================
    # 一、生成/获取待做题单（不建会话）
    # ========================================

    async def get_or_create_pending_quiz(
        self, *, user_id: UUID, topic_id: UUID, question_count: int = 5
    ) -> QuizPendingOut:
        """
        生成或获取待做小测题单

        业务逻辑：
        1. 检查 user_topic_progress 是否已有 pending_quiz
        2. 若无，从 question_topics 按主题抽题（默认5题）
        3. 将题单存入 pending_quiz (JSONB)，设置 quiz_state='pending'
        4. 若已有，直接返回现有题单

        Args:
            user_id: 用户ID
            topic_id: 主题ID
            question_count: 题目数量（默认5）

        Returns:
            QuizPendingOut 对象

        Raises:
            BizError(404): 主题不存在
            BizError(400): 题库题目不足

        Example:
            >>> quiz_service = QuizService(db)
            >>> result = await quiz_service.get_or_create_pending_quiz(
            ...     user_id=user_id, topic_id=topic_id
            ... )
        """
        # TODO: 这里需要实现 user_progress_repo（暂时用伪代码占位）
        # from app.repositories import user_progress as progress_repo
        # progress = await progress_repo.get_or_create_progress(
        #     self.db, user_id=user_id, topic_id=topic_id
        # )

        # 暂时模拟：假设没有 pending_quiz，需要生成
        # if progress.pending_quiz and progress.quiz_state == "pending":
        #     # 已有待做题单，直接返回
        #     return self._build_pending_out(progress.pending_quiz, topic_id)

        # 1. 检查主题是否存在（通过查询题目数量来验证）
        is_enough, actual_count = await questions_repo.check_topic_has_enough_questions(
            self.db, topic_id=topic_id, required_count=question_count
        )

        if not is_enough:
            raise BizError(
                400,
                BizCode.INVALID_REQUEST,
                "insufficient_questions",
                data={
                    "required": question_count,
                    "actual": actual_count,
                    "message": f"主题仅有 {actual_count} 题，需要 {question_count} 题",
                },
            )

        # 2. 随机抽题
        questions = await questions_repo.get_random_questions_by_topic(
            self.db, topic_id=topic_id, count=question_count
        )

        # 3. 构建题单快照（不含答案）
        pending_quiz = []
        for idx, question in enumerate(questions, start=1):
            snapshot = {
                "order_no": idx,
                "question_id": str(question.id),
                "qtype": question.qtype,
                "stem": question.stem,
                "choices": question.choices,  # JSONB 格式
            }
            pending_quiz.append(snapshot)

        # 4. 存入 user_topic_progress.pending_quiz
        # await progress_repo.save_pending_quiz(
        #     self.db, user_id=user_id, topic_id=topic_id, pending_quiz=pending_quiz
        # )

        # 5. 返回题单
        return self._build_pending_out(pending_quiz, topic_id, quiz_state="pending")

    def _build_pending_out(
        self, pending_quiz: List[dict], topic_id: UUID, quiz_state: str = "pending"
    ) -> QuizPendingOut:
        """
        构建 QuizPendingOut 响应

        Args:
            pending_quiz: 题单列表（JSONB 格式）
            topic_id: 主题ID
            quiz_state: 小测状态

        Returns:
            QuizPendingOut 对象
        """
        questions = []
        for item in pending_quiz:
            questions.append(
                QuestionBase(
                    item_id=UUID(item["question_id"]),  # 临时用 question_id
                    order_no=item["order_no"],
                    snapshot={
                        "qtype": item["qtype"],
                        "stem": item["stem"],
                        "choices": item.get("choices"),
                    },
                )
            )

        return QuizPendingOut(
            topic_id=topic_id, quiz_state=quiz_state, questions=questions
        )

    # ========================================
    # 二、提交小测并判分（落历史&更新进度）
    # ========================================

    async def submit_and_grade(
        self, *, user_id: UUID, topic_id: UUID, answers: List[AnswerItem]
    ) -> QuizSubmitOut:
        """
        提交主题小测并判分

        业务逻辑：
        1. 从 pending_quiz 取题单（若不存在 → 409）
        2. **此时才创建** assessment_sessions(kind='topic_quiz', topic_id=...)
        3. 为每题写入 assessment_items（question_snapshot）
        4. 写入 assessment_responses，判分客观题
        5. 计算 total_score，更新 user_topic_progress:
           - last_score, attempt_count, best_score
           - last_quiz_session_id
           - quiz_state='completed', 清空 pending_quiz

        Args:
            user_id: 用户ID
            topic_id: 主题ID
            answers: 答案列表

        Returns:
            QuizSubmitOut 对象

        Raises:
            BizError(409): pending_quiz不存在或已完成
            BizError(422): 答案格式错误

        Example:
            >>> result = await quiz_service.submit_and_grade(
            ...     user_id=user_id,
            ...     topic_id=topic_id,
            ...     answers=[
            ...         AnswerItem(order_no=1, answer="B"),
            ...         AnswerItem(order_no=2, answer="A,C"),
            ...     ]
            ... )
        """
        # TODO: 需要 user_progress_repo
        # from app.repositories import user_progress as progress_repo
        # progress = await progress_repo.get_progress(
        #     self.db, user_id=user_id, topic_id=topic_id
        # )

        # 暂时模拟：假设从 pending_quiz 取题
        # if not progress or not progress.pending_quiz:
        #     raise BizError(409, BizCode.CONFLICT, "no_pending_quiz")
        #
        # if progress.quiz_state == "completed":
        #     raise BizError(409, BizCode.ALREADY_DONE, "quiz_already_completed")
        #
        # pending_quiz = progress.pending_quiz

        # 1. 模拟：直接从 question_topics 抽题（实际应从 pending_quiz 读）
        questions = await questions_repo.get_random_questions_by_topic(
            self.db, topic_id=topic_id, count=len(answers)
        )

        # 构建 pending_quiz（模拟）
        pending_quiz = []
        for idx, question in enumerate(questions, start=1):
            pending_quiz.append(
                {
                    "order_no": idx,
                    "question_id": str(question.id),
                    "qtype": question.qtype,
                    "stem": question.stem,
                    "choices": question.choices,
                }
            )

        # 2. 创建评测会话（此时才建会话）
        session = await sessions_repo.create_session(
            self.db, user_id=user_id, kind="topic_quiz", topic_id=topic_id
        )

        # 3. 写入 assessment_items（题目快照）
        items = await items_repo.create_items_from_snapshots(
            self.db, session_id=session.id, snapshots=pending_quiz
        )

        # 4. 判分并写入 assessment_responses
        grading_results = await self._grade_answers(
            items=items, answers=answers, questions=questions
        )

        # 5. 批量创建答题记录
        responses_data = []
        for result in grading_results:
            responses_data.append(
                {
                    "item_id": result["item_id"],
                    "answer": result["answer"],
                    "is_correct": result["is_correct"],
                    "score": result["score"],
                }
            )

        await responses_repo.create_responses_batch(
            self.db, session_id=session.id, responses_data=responses_data
        )

        # 6. 计算总分
        total_score = sum(r["score"] for r in grading_results)
        total_score_percent = (
            (total_score / len(grading_results)) * 100 if grading_results else 0
        )

        # 7. 更新 assessment_sessions.total_score
        await sessions_repo.mark_as_submitted(
            self.db, session_id=session.id, total_score=total_score_percent
        )

        # 8. 更新 user_topic_progress
        # await progress_repo.update_quiz_scores(
        #     self.db,
        #     user_id=user_id,
        #     topic_id=topic_id,
        #     last_score=total_score_percent,
        #     best_score=max(progress.best_score or 0, total_score_percent),
        #     attempt_count=(progress.attempt_count or 0) + 1,
        #     last_quiz_session_id=session.id,
        #     quiz_state="completed",
        # )

        await self.db.commit()

        # 9. 构建响应
        return self._build_submit_out(
            session_id=session.id,
            grading_results=grading_results,
            total_score=total_score_percent,
            threshold=80.0,  # TODO: 从 topics.pass_threshold 读取
        )

    async def _grade_answers(
        self, *, items: List, answers: List[AnswerItem], questions: List
    ) -> List[dict]:
        """
        判分核心逻辑

        Args:
            items: 题目实例列表
            answers: 用户答案列表
            questions: 完整题目列表（含答案）

        Returns:
            判分结果列表
            [
                {
                    "item_id": UUID,
                    "order_no": int,
                    "answer": str,
                    "is_correct": bool,
                    "correct_answer": str,
                    "explanation": str,
                    "score": float
                },
                ...
            ]
        """
        # 构建索引：order_no -> item
        items_map = {item.order_no: item for item in items}

        # 构建索引：question_id -> question
        questions_map = {q.id: q for q in questions}

        # 构建索引：order_no -> answer
        answers_map = {ans.order_no: ans.answer for ans in answers}

        results = []

        for item in items:
            order_no = item.order_no
            user_answer = answers_map.get(order_no, "").strip()

            # 从 snapshot 获取 question_id
            snapshot = item.question_snapshot
            question_id_str = snapshot.get("question_id")

            # 暂时简化：直接用 order_no 对应 questions 列表
            question = questions[order_no - 1] if order_no <= len(questions) else None

            if not question:
                # 题目不存在，跳过
                results.append(
                    {
                        "item_id": item.id,
                        "order_no": order_no,
                        "answer": user_answer,
                        "is_correct": False,
                        "correct_answer": None,
                        "explanation": None,
                        "score": 0.0,
                    }
                )
                continue

            # 提取正确答案
            correct_answer = questions_repo.extract_correct_answer(question)
            explanation = questions_repo.get_explanation(question)

            # 判分逻辑
            is_correct = False
            score = 0.0

            if question.qtype == "single":
                # 单选题：完全匹配
                normalized_user = user_answer.strip().upper()
                normalized_correct = (
                    correct_answer.strip().upper() if correct_answer else ""
                )
                is_correct = normalized_user == normalized_correct
                score = 1.0 if is_correct else 0.0

            elif question.qtype == "multi":
                # 多选题：完全对得1分，部分对得0.5分
                normalized_user = self._normalize_multi_choice(user_answer)
                normalized_correct = correct_answer if correct_answer else ""

                if normalized_user == normalized_correct:
                    is_correct = True
                    score = 1.0
                else:
                    # 部分对：计算交集
                    user_set = (
                        set(normalized_user.split(",")) if normalized_user else set()
                    )
                    correct_set = (
                        set(normalized_correct.split(","))
                        if normalized_correct
                        else set()
                    )

                    if user_set and correct_set:
                        intersection = user_set & correct_set
                        if intersection:
                            score = 0.5  # 部分对
                        else:
                            score = 0.0
                    else:
                        score = 0.0

            else:  # short
                # 简答题：暂不判分（留给人工/AI）
                is_correct = None
                score = 0.0
                correct_answer = None
                explanation = "简答题需要人工判分"

            results.append(
                {
                    "item_id": item.id,
                    "order_no": order_no,
                    "answer": user_answer,
                    "is_correct": is_correct,
                    "correct_answer": correct_answer,
                    "explanation": explanation,
                    "score": score,
                }
            )

        return results

    def _normalize_multi_choice(self, answer: str) -> str:
        """
        标准化多选答案：去空白、转大写、排序

        Example:
            >>> self._normalize_multi_choice("C, A, B")
            'A,B,C'
        """
        if not answer:
            return ""
        choices = [c.strip().upper() for c in answer.split(",")]
        return ",".join(sorted(set(choices)))

    def _build_submit_out(
        self,
        *,
        session_id: UUID,
        grading_results: List[dict],
        total_score: float,
        threshold: float = 80.0,
    ) -> QuizSubmitOut:
        """
        构建提交响应

        Args:
            session_id: 会话ID
            grading_results: 判分结果列表
            total_score: 总分（百分制）
            threshold: 及格阈值（默认80%）

        Returns:
            QuizSubmitOut 对象
        """
        items = []
        for result in grading_results:
            items.append(
                QuestionWithAnswer(
                    item_id=result["item_id"],
                    order_no=result["order_no"],
                    snapshot={
                        "qtype": "single",  # TODO: 从 snapshot 读取
                        "stem": "",
                        "choices": None,
                    },
                    your_answer=result["answer"],
                    is_correct=result["is_correct"],
                    correct_answer=result["correct_answer"],
                    explanation=result["explanation"],
                    score=result["score"],
                )
            )

        can_mark_complete = total_score >= threshold

        return QuizSubmitOut(
            session_id=session_id,
            total_score=round(total_score, 2),
            items=items,
            can_mark_complete=can_mark_complete,
            threshold=threshold,
        )
