# backend/app/models/onboarding.py
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List

import sqlalchemy as sa
from sqlalchemy import String, Integer, Text, DateTime, CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, uuid_pk_db

class OnboardingSurvey(Base):
    __tablename__ = "onboarding_surveys"
    __table_args__ = (UniqueConstraint("user_id", name="uq_onboarding_survey_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"),
                                               index=True, nullable=False)
    # 如果“创建即提交”
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    total_score: Mapped[Optional[int]] = mapped_column(sa.Integer)
    level: Mapped[Optional[str]] = mapped_column(String)  # 'new'/'developing'/'strong'

    answers: Mapped[List["OnboardingSurveyAnswer"]] = relationship(
        back_populates="survey", cascade="all, delete-orphan"
    )

class OnboardingSurveyAnswer(Base):
    __tablename__ = "onboarding_survey_answers"
    __table_args__ = (
        UniqueConstraint("survey_id", "question_key", name="uq_survey_question_key"),
        CheckConstraint("question_type in ('single_choice','multi_choice','text')", name="ck_question_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    survey_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("onboarding_surveys.id", ondelete="CASCADE"),
        index=True, nullable=False
    )
    question_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    question_key: Mapped[str] = mapped_column(String, nullable=False)
    question_type: Mapped[str] = mapped_column(String, nullable=False)

    answer_value: Mapped[Optional[str]] = mapped_column(Text)
    answer_text: Mapped[Optional[str]] = mapped_column(Text)
    answer_score: Mapped[Optional[int]] = mapped_column(sa.Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )

    survey: Mapped["OnboardingSurvey"] = relationship(back_populates="answers")

class OnboardingSurveyOption(Base):
    __tablename__ = "onboarding_survey_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("onboarding_survey_answers.id", ondelete="CASCADE"),
        index=True, nullable=False
    )
    option_value: Mapped[str] = mapped_column(String, nullable=False)
    option_text: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )

    answer: Mapped["OnboardingSurveyAnswer"] = relationship(back_populates="options")
