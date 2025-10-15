from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import ForeignKey, Enum, Integer, Numeric, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .content import LearningTopic

ProgressStatusEnum = Enum(
    "not_started", "in_progress", "completed", name="progress_status"
)
QuizStateEnum = Enum("none", "pending", "completed", name="quiz_state")


class UserTopicProgress(TimestampMixin, Base):
    __tablename__ = "user_topic_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("learning_topics.id", ondelete="CASCADE"),
        primary_key=True,
    )
    progress_status: Mapped[str] = mapped_column(
        ProgressStatusEnum,
        server_default=sa.text("'not_started'"),
        nullable=False,
    )
    last_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    attempt_count: Mapped[int] = mapped_column(
        Integer, server_default=sa.text("0"), nullable=False
    )
    best_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    last_quiz_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_sessions.id", ondelete="SET NULL")
    )
    pending_quiz: Mapped[Optional[dict]] = mapped_column(JSONB)
    quiz_state: Mapped[str] = mapped_column(
        QuizStateEnum, server_default=sa.text("'none'"), nullable=False
    )
    marked_complete: Mapped[bool] = mapped_column(
        Boolean, server_default=sa.text("false"), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_visited_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    topic: Mapped["LearningTopic"] = relationship(back_populates="progress_entries")
