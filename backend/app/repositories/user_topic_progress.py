from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.progress import UserTopicProgress


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_progress(
    db: AsyncSession, *, user_id: UUID, topic_id: UUID
) -> Optional[UserTopicProgress]:
    result = await db.execute(
        select(UserTopicProgress).where(
            UserTopicProgress.user_id == user_id,
            UserTopicProgress.topic_id == topic_id,
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_progress(
    db: AsyncSession, *, user_id: UUID, topic_id: UUID
) -> UserTopicProgress:
    progress = await get_progress(db, user_id=user_id, topic_id=topic_id)
    if progress:
        return progress

    progress = UserTopicProgress(user_id=user_id, topic_id=topic_id)
    db.add(progress)
    await db.flush()
    return progress


async def set_pending_quiz(
    db: AsyncSession,
    *,
    progress: UserTopicProgress,
    pending_quiz: list[dict],
) -> UserTopicProgress:
    progress.pending_quiz = pending_quiz
    progress.quiz_state = "pending"
    progress.last_visited_at = _now()
    await db.flush()
    return progress


async def clear_pending_quiz(
    db: AsyncSession, *, progress: UserTopicProgress
) -> UserTopicProgress:
    progress.pending_quiz = None
    progress.quiz_state = "none"
    progress.last_visited_at = _now()
    await db.flush()
    return progress


async def update_after_quiz(
    db: AsyncSession,
    *,
    progress: UserTopicProgress,
    total_score: float,
    session_id: UUID,
    threshold: Optional[float] = None,
) -> UserTopicProgress:
    rounded_score = round(float(total_score), 2)
    progress.last_score = rounded_score
    progress.attempt_count = (progress.attempt_count or 0) + 1

    current_best = (
        float(progress.best_score) if progress.best_score is not None else None
    )
    if current_best is None or rounded_score > current_best:
        progress.best_score = rounded_score

    progress.quiz_state = "completed"
    progress.pending_quiz = None
    progress.last_quiz_session_id = session_id
    progress.last_visited_at = _now()

    # threshold is persisted for downstream "mark complete" logic if needed.
    await db.flush()
    return progress
