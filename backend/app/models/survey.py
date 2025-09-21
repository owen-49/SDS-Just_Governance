from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Text, DateTime, CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, uuid_pk

# 主表：onboarding_surveys（每个用户 1 条）
# 参考：补充-问卷表结构.md。:contentReference[oaicite:17]{index=17}
class OnboardingSurvey(Base):
    __tablename__ = "onboarding_surveys"
    __table_args__ = (UniqueConstraint("user_id", name="uq_onboarding_survey_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    total_score: Mapped[Optional[int]] = mapped_column(Integer)
    level: Mapped[Optional[str]] = mapped_column(String)  # 'new'/'developing'/'strong'

    answers: Mapped[List["OnboardingSurveyAnswer"]] = relationship(
        back_populates="survey", cascade="all, delete-orphan"
    )

# 每题答案（单选/多选/文本）
# 参考：补充-问卷表结构.md。:contentReference[oaicite:18]{index=18}
class OnboardingSurveyAnswer(Base):
    __tablename__ = "onboarding_survey_answers"
    __table_args__ = (
        UniqueConstraint("survey_id", "question_key", name="uq_survey_question_key"),
        CheckConstraint("question_type in ('single_choice','multi_choice','text')", name="ck_question_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("onboarding_surveys.id", ondelete="CASCADE"), index=True)
    question_number: Mapped[int] = mapped_column(Integer, nullable=False)
    question_key: Mapped[str] = mapped_column(String, nullable=False)
    question_type: Mapped[str] = mapped_column(String, nullable=False)

    answer_value: Mapped[Optional[str]] = mapped_column(Text)   # 单选的 value
    answer_text: Mapped[Optional[str]] = mapped_column(Text)    # 文本题或 other 的补充
    answer_score: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    survey: Mapped["OnboardingSurvey"] = relationship(back_populates="answers")
    options: Mapped[List["OnboardingSurveyOption"]] = relationship(
        back_populates="answer", cascade="all, delete-orphan"
    )

# 多选题选项明细
# 参考：补充-问卷表结构.md。:contentReference[oaicite:19]{index=19}
class OnboardingSurveyOption(Base):
    __tablename__ = "onboarding_survey_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    answer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("onboarding_survey_answers.id", ondelete="CASCADE"), index=True)
    option_value: Mapped[str] = mapped_column(String, nullable=False)
    option_text: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    answer: Mapped["OnboardingSurveyAnswer"] = relationship(back_populates="options")
