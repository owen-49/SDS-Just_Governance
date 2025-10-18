# backend/app/services/quiz_service.py
"""
主题小测业务逻辑（Topic Quiz Service）
负责主题小测的完整流程：
1. 生成/获取待做题单（不建会话）
2. 提交并判分（建会话、落库、更新进度）
"""
from __future__ import annotations
from typing import Optional, List, Dict
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
    QuestionSnapshot,
    format_answer_for_storage,
    normalize_single_choice_answer,
    normalize_multi_choice_answer,
)

# Repositories
from app.repositories import questions as questions_repo
from app.repositories import assessment_sessions as sessions_repo
from app.repositories import assessment_items as items_repo
from app.repositories import assessment_responses as responses_repo
from app.repositories import user_topic_progress as progress_repo


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
        progress = await progress_repo.get_or_create_progress(
            self.db, user_id=user_id, topic_id=topic_id
        )

        if progress.pending_quiz and progress.quiz_state == "pending":
            return self._build_pending_out(
                progress.pending_quiz, topic_id, quiz_state=progress.quiz_state
            )

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

        questions = await questions_repo.get_random_questions_by_topic(
            self.db, topic_id=topic_id, count=question_count
        )

        pending_quiz = []
        for idx, question in enumerate(questions, start=1):
            snapshot = {
                "question_id": str(question.id),
                "qtype": question.qtype,
                "stem": question.stem,
                "choices": question.choices,
            }
            pending_quiz.append({"order_no": idx, "snapshot": snapshot})

        await progress_repo.set_pending_quiz(
            self.db, progress=progress, pending_quiz=pending_quiz
        )
        await self.db.commit()


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
            snapshot_data = item.get("snapshot") if isinstance(item, dict) else None
            if snapshot_data is None:
                snapshot_data = item

            question_id_str = snapshot_data.get("question_id")
            try:
                question_uuid = UUID(str(question_id_str)) if question_id_str else None
            except ValueError:
                question_uuid = None

            if question_uuid is None:
                raise BizError(
                    500, BizCode.INTERNAL_ERROR, "quiz_snapshot_invalid_question_id"
                )

            questions.append(
                QuestionBase(
                    item_id=question_uuid,
                    order_no=item.get("order_no"),
                    snapshot=QuestionSnapshot(
                        qtype=snapshot_data.get("qtype"),
                        stem=snapshot_data.get("stem"),
                        choices=snapshot_data.get("choices"),
                    ),
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
        """Submit a topic quiz and return grading outcome."""
        progress = await progress_repo.get_progress(
            self.db, user_id=user_id, topic_id=topic_id
        )

        if not progress or not progress.pending_quiz:
            raise BizError(409, BizCode.CONFLICT, "no_pending_quiz")

        pending_quiz_raw = progress.pending_quiz
        if not isinstance(pending_quiz_raw, list):
            raise BizError(500, BizCode.INTERNAL_ERROR, "pending_quiz_invalid")

        snapshot_map: Dict[int, dict] = {}
        question_ids: List[UUID] = []
        question_order_map: Dict[UUID, int] = {}

        for entry in pending_quiz_raw:
            if not isinstance(entry, dict):
                continue

            order_no = entry.get("order_no")
            if order_no is None:
                continue

            snapshot = entry.get("snapshot")
            if not isinstance(snapshot, dict):
                snapshot = {
                    "question_id": entry.get("question_id"),
                    "qtype": entry.get("qtype"),
                    "stem": entry.get("stem"),
                    "choices": entry.get("choices"),
                }

            snapshot_map[int(order_no)] = snapshot

            question_id = snapshot.get("question_id")
            if question_id:
                try:
                    question_uuid = UUID(str(question_id))
                except ValueError:
                    raise BizError(
                        500, BizCode.INTERNAL_ERROR, "quiz_snapshot_invalid_question_id"
                    )
                question_order_map[question_uuid] = int(order_no)
                question_ids.append(question_uuid)

        if not snapshot_map:
            raise BizError(409, BizCode.CONFLICT, "no_pending_quiz")

        expected_orders = set(snapshot_map.keys())
        resolved_order_sequence: List[int] = []
        resolved_answer_map: Dict[int, AnswerItem] = {}
        invalid_refs: List[str] = []
        duplicate_orders: List[int] = []

        for item in answers:
            resolved_order: Optional[int] = None

            if item.order_no is not None:
                resolved_order = item.order_no
            elif item.item_id is not None:
                resolved_order = question_order_map.get(item.item_id)
                if resolved_order is None:
                    invalid_refs.append(str(item.item_id))
                    continue
            else:
                invalid_refs.append("missing_identifier")
                continue

            if resolved_order not in snapshot_map:
                invalid_refs.append(str(resolved_order))
                continue

            if resolved_order in resolved_answer_map:
                duplicate_orders.append(resolved_order)
                continue

            resolved_order_sequence.append(resolved_order)
            resolved_answer_map[resolved_order] = item

        if invalid_refs:
            raise BizError(
                422,
                BizCode.VALIDATION_ERROR,
                "invalid_answer_reference",
                data={"references": invalid_refs},
            )

        if duplicate_orders:
            raise BizError(
                422,
                BizCode.VALIDATION_ERROR,
                "duplicate_answers",
                data={"orders": sorted(set(duplicate_orders))},
            )

        provided_orders = set(resolved_answer_map.keys())
        missing_orders = expected_orders - provided_orders

        if missing_orders:
            raise BizError(
                422,
                BizCode.VALIDATION_ERROR,
                "missing_answers",
                data={"missing_orders": sorted(missing_orders)},
            )

        questions_map: Dict[UUID, object] = {}
        if question_ids:
            unique_ids = list(dict.fromkeys(question_ids))
            questions_map = await questions_repo.get_questions_by_ids(
                self.db, unique_ids
            )
            missing_questions = [
                str(qid) for qid in unique_ids if qid not in questions_map
            ]
            if missing_questions:
                raise BizError(
                    500,
                    BizCode.INTERNAL_ERROR,
                    "questions_missing",
                    data={"question_ids": missing_questions},
                )

        session = await sessions_repo.create_session(
            self.db, user_id=user_id, kind="topic_quiz", topic_id=topic_id
        )

        items = await items_repo.create_items_from_snapshots(
            self.db, session_id=session.id, snapshots=pending_quiz_raw
        )

        prepared_answers = [
            AnswerItem(order_no=order, answer=resolved_answer_map[order].answer)
            for order in resolved_order_sequence
        ]

        grading_results = await self._grade_answers(
            items=items,
            answers=prepared_answers,
            snapshot_map=snapshot_map,
            questions_map=questions_map,
        )

        responses_data = [
            {
                "item_id": result["item_id"],
                "answer": result["answer"],
                "is_correct": result["is_correct"],
                "score": result["score"],
            }
            for result in grading_results
        ]

        await responses_repo.create_responses_batch(
            self.db, session_id=session.id, responses_data=responses_data
        )

        total_score = sum(r["score"] for r in grading_results)
        total_score_percent = (
            (total_score / len(grading_results)) * 100 if grading_results else 0.0
        )

        await sessions_repo.mark_as_submitted(
            self.db, session_id=session.id, total_score=total_score_percent
        )

        await progress_repo.update_after_quiz(
            self.db,
            progress=progress,
            total_score=total_score_percent,
            session_id=session.id,
            threshold=80.0,
        )

        await self.db.commit()

        return self._build_submit_out(
            session_id=session.id,
            grading_results=grading_results,
            total_score=total_score_percent,
            threshold=80.0,
        )

    async def _grade_answers(
        self,
        *,
        items: List,
        answers: List[AnswerItem],
        snapshot_map: Dict[int, dict],
        questions_map: Dict[UUID, object],
    ) -> List[dict]:
        """判分核心逻辑。"""
        answers_map = {ans.order_no: ans.answer.strip() for ans in answers}
        results = []

        for item in items:
            order_no = item.order_no
            snapshot = snapshot_map.get(order_no) or {}

            question = None
            question_id = snapshot.get("question_id")
            if question_id:
                try:
                    question = questions_map.get(UUID(str(question_id)))
                except ValueError:
                    question = None

            user_answer_raw = answers_map.get(order_no, "")
            qtype = snapshot.get("qtype") or (question.qtype if question else None)
            stored_answer = (
                format_answer_for_storage(user_answer_raw, qtype)
                if qtype and user_answer_raw
                else user_answer_raw.strip()
            )

            correct_answer_raw = (
                questions_repo.extract_correct_answer(question) if question else None
            )

            normalized_correct = None
            if correct_answer_raw:
                if qtype == "single":
                    normalized_correct = normalize_single_choice_answer(correct_answer_raw)
                elif qtype == "multi":
                    normalized_correct = normalize_multi_choice_answer(correct_answer_raw)
                else:
                    normalized_correct = correct_answer_raw

            is_correct = None
            score = 0.0

            if qtype == "single" and normalized_correct:
                is_correct = stored_answer == normalized_correct
                score = 1.0 if is_correct else 0.0
            elif qtype == "multi" and normalized_correct:
                is_correct = stored_answer == normalized_correct
                score = 1.0 if is_correct else 0.0
            elif qtype in ("short", "text"):
                is_correct = None
                score = 0.0
            elif normalized_correct is not None:
                is_correct = stored_answer == normalized_correct
                score = 1.0 if is_correct else 0.0
            else:
                is_correct = False
                score = 0.0

            results.append(
                {
                    "item_id": item.id,
                    "order_no": order_no,
                    "answer": stored_answer,
                    "is_correct": is_correct,
                    "correct_answer": normalized_correct,
                    "explanation": questions_repo.get_explanation(question)
                    if question
                    else None,
                    "score": score,
                    "snapshot": snapshot,
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
            snapshot = result.get("snapshot", {})
            items.append(
                QuestionWithAnswer(
                    item_id=result["item_id"],
                    order_no=result["order_no"],
                    snapshot=QuestionSnapshot(
                        qtype=snapshot.get("qtype"),
                        stem=snapshot.get("stem"),
                        choices=snapshot.get("choices"),
                    ),
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
