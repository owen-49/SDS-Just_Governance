# backend/app/models/assessments.py
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List

import sqlalchemy as sa
from sqlalchemy import String, Text, Boolean, Integer, Numeric, Enum, ForeignKey, PrimaryKeyConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, uuid_pk_db

QuestionType = Enum("single", "multi", "short", name="question_type")
AssessmentKind = Enum("global", "topic_quiz", name="assessment_kind")

class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    qtype: Mapped[str] = mapped_column(QuestionType, nullable=False)
    stem: Mapped[str] = mapped_column(Text, nullable=False)
    choices: Mapped[Optional[dict]] = mapped_column(JSONB)      # 可空就不设默认
    answer_key: Mapped[Optional[dict]] = mapped_column(JSONB)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    rubric: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=sa.text("true"), nullable=False)

class QuestionTopic(Base):
    __tablename__ = "question_topics"
    __table_args__ = (
        PrimaryKeyConstraint("question_id", "topic_id", name="pk_question_topics"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learning_topics.id", ondelete="CASCADE"),
        nullable=False
    )

class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(AssessmentKind, nullable=False)
    topic_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("learning_topics.id"))

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_score: Mapped[Optional[float]] = mapped_column(Numeric)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    ai_recommendation: Mapped[Optional[dict]] = mapped_column(JSONB)
    last_question_index: Mapped[Optional[int]] = mapped_column(Integer)

    items: Mapped[List["AssessmentItem"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

class AssessmentItem(Base):
    __tablename__ = "assessment_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessment_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False)
    question_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)

    session: Mapped["AssessmentSession"] = relationship(back_populates="items")
