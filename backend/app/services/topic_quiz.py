from __future__ import annotations

"""Topic quiz orchestration utilities."""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions.codes import BizCode
from app.core.exceptions.exceptions import BizError
from app.models import (
    AssessmentItem,
    AssessmentSession,
    LearningTopic,
    Question,
    QuestionTopic,
    User,
    UserTopicProgress,
)


@dataclass(slots=True)
class QuizQuestion:
    item_id: UUID
    question_id: UUID
    order_no: int
    stem: str
    qtype: str
    choices: dict

    def as_payload(self) -> dict:
        return {
            "item_id": str(self.item_id),
            "question_id": str(self.question_id),
            "order": self.order_no,
            "stem": self.stem,
            "qtype": self.qtype,
            "choices": self.choices or {},
        }


@dataclass(slots=True)
class QuizSummary:
    score: float
    correct_count: int
    total_questions: int
    passed: bool
    best_score: float | None
    attempt_count: int

    def as_payload(self) -> dict:
        return {
            "score": round(self.score, 4),
            "correct_count": self.correct_count,
            "total_questions": self.total_questions,
            "passed": self.passed,
            "best_score": self.best_score,
            "attempt_count": self.attempt_count,
        }


class TopicQuizService:
    def __init__(self, minimum_questions: int = 3) -> None:
        self.minimum_questions = minimum_questions

    async def _ensure_topic(self, session: AsyncSession, topic_id: UUID) -> LearningTopic:
        topic = await session.get(LearningTopic, topic_id)
        if not topic or not topic.is_active:
            raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")
        return topic

    async def _ensure_progress(self, session: AsyncSession, user: User, topic: LearningTopic) -> UserTopicProgress:
        progress = await session.get(UserTopicProgress, (user.id, topic.id))
        if progress:
            return progress
        progress = UserTopicProgress(
            user_id=user.id,
            topic_id=topic.id,
            progress_status="in_progress",
        )
        session.add(progress)
        await session.flush()
        return progress

    async def _select_questions(self, session: AsyncSession, topic: LearningTopic, limit: int) -> list[Question]:
        stmt = (
            sa.select(Question)
            .join(QuestionTopic, QuestionTopic.question_id == Question.id)
            .where(QuestionTopic.topic_id == topic.id, Question.is_active.is_(True))
            .order_by(Question.id.asc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        questions = result.scalars().all()
        if len(questions) < limit:
            raise BizError(
                409,
                BizCode.CONFLICT,
                "insufficient_questions",
                data={"required": limit, "available": len(questions)},
            )
        return questions

    async def start_quiz(
        self,
        session: AsyncSession,
        *,
        user: User,
        topic_id: UUID,
        question_limit: int | None = None,
    ) -> tuple[AssessmentSession, list[QuizQuestion]]:
        topic = await self._ensure_topic(session, topic_id)
        progress = await self._ensure_progress(session, user, topic)

        if progress.quiz_state == "pending" and progress.pending_quiz:
            # Allow resuming existing quiz without creating a new one.
            session_id = UUID(progress.pending_quiz["session_id"])
            questions = [
                QuizQuestion(
                    item_id=UUID(item["item_id"]),
                    question_id=UUID(item["question_id"]),
                    order_no=item["order"],
                    stem=item["stem"],
                    qtype=item["qtype"],
                    choices=item.get("choices") or {},
                )
                for item in progress.pending_quiz["questions"]
            ]
            existing_session = await session.get(AssessmentSession, session_id)
            if not existing_session:
                # Session was deleted; reset quiz state and start a fresh quiz.
                progress.pending_quiz = None
                progress.quiz_state = "none"
            else:
                return existing_session, questions

        limit = question_limit or self.minimum_questions
        questions = await self._select_questions(session, topic, limit)

        assessment_session = AssessmentSession(
            user_id=user.id,
            kind="topic_quiz",
            topic_id=topic.id,
        )
        session.add(assessment_session)
        await session.flush()

        quiz_questions: list[QuizQuestion] = []
        pending_payload = {
            "session_id": str(assessment_session.id),
            "questions": [],
        }
        for order_no, question in enumerate(questions, start=1):
            item = AssessmentItem(
                session_id=assessment_session.id,
                order_no=order_no,
                question_snapshot={
                    "question_id": str(question.id),
                    "stem": question.stem,
                    "qtype": question.qtype,
                    "choices": question.choices or {},
                    "answer_key": question.answer_key or {},
                    "explanation": question.explanation,
                },
            )
            session.add(item)
            await session.flush()
            quiz_question = QuizQuestion(
                item_id=item.id,
                question_id=question.id,
                order_no=order_no,
                stem=question.stem,
                qtype=question.qtype,
                choices=question.choices or {},
            )
            quiz_questions.append(quiz_question)
            pending_payload["questions"].append(
                quiz_question.as_payload() | {"item_id": str(item.id)}
            )

        progress.pending_quiz = pending_payload
        progress.quiz_state = "pending"
        progress.last_quiz_session_id = assessment_session.id
        await session.flush()

        return assessment_session, quiz_questions

    @staticmethod
    def _normalise_answer(answer: object) -> list[str]:
        if isinstance(answer, str):
            return [answer]
        if isinstance(answer, Iterable):
            return [str(item) for item in answer]
        return []

    @staticmethod
    def _score_question(snapshot: dict, answer: list[str]) -> tuple[bool, float]:
        qtype = snapshot.get("qtype")
        answer_key = snapshot.get("answer_key") or {}
        correct_options = {str(opt) for opt in answer_key.get("correct_options", [])}

        if qtype == "single":
            return (set(answer) == correct_options, 1.0)
        if qtype == "multi":
            return (set(answer) == correct_options, 1.0)
        if qtype == "short":
            reference = answer_key.get("reference")
            if not reference:
                return False, 0.0
            expected = {token.lower() for token in correct_options} | {reference.lower()}
            provided = {opt.lower() for opt in answer}
            return (bool(provided & expected), 1.0)
        return False, 1.0

    async def submit(
        self,
        session: AsyncSession,
        *,
        user: User,
        topic_id: UUID,
        session_id: UUID,
        answers: dict[str, list[str] | str],
    ) -> QuizSummary:
        topic = await self._ensure_topic(session, topic_id)
        progress = await self._ensure_progress(session, user, topic)

        if progress.quiz_state != "pending" or not progress.pending_quiz:
            raise BizError(409, BizCode.CONFLICT, "quiz_not_pending")

        pending_session_id = UUID(progress.pending_quiz.get("session_id"))
        if pending_session_id != session_id:
            raise BizError(409, BizCode.CONFLICT, "session_mismatch")

        assessment_session = await session.get(AssessmentSession, session_id)
        if not assessment_session:
            raise BizError(404, BizCode.NOT_FOUND, "quiz_session_not_found")

        stmt = (
            sa.select(AssessmentItem)
            .where(AssessmentItem.session_id == session_id)
            .order_by(AssessmentItem.order_no.asc())
        )
        items_result = await session.execute(stmt)
        items = items_result.scalars().all()
        if not items:
            raise BizError(409, BizCode.CONFLICT, "quiz_items_missing")

        total_questions = len(items)
        correct = 0
        for item in items:
            user_answer = answers.get(str(item.id)) or answers.get(str(item.question_snapshot.get("question_id")))
            normalised = self._normalise_answer(user_answer)
            is_correct, _ = self._score_question(item.question_snapshot, normalised)
            if is_correct:
                correct += 1

        score = correct / total_questions if total_questions else 0.0

        assessment_session.submitted_at = datetime.now(timezone.utc)
        assessment_session.total_score = Decimal(str(score))
        session.add(assessment_session)

        progress.last_score = Decimal(str(score))
        progress.attempt_count += 1
        if progress.best_score is None or score > float(progress.best_score):
            progress.best_score = Decimal(str(score))
        progress.quiz_state = "completed"
        progress.pending_quiz = None
        progress.last_quiz_session_id = assessment_session.id
        if score > 0 and progress.progress_status == "not_started":
            progress.progress_status = "in_progress"

        threshold = float(topic.pass_threshold or Decimal("0"))
        passed = score >= threshold

        if passed and (progress.progress_status != "completed" or not progress.marked_complete):
            progress.progress_status = "in_progress"

        await session.flush()

        best_score = float(progress.best_score) if progress.best_score is not None else None

        return QuizSummary(
            score=score,
            correct_count=correct,
            total_questions=total_questions,
            passed=passed,
            best_score=best_score,
            attempt_count=progress.attempt_count,
        )


__all__ = ["TopicQuizService", "QuizQuestion", "QuizSummary"]
