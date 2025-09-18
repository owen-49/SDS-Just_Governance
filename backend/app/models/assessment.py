from __future__ import annotations
import uuid
from typing import Optional, List
from sqlalchemy import String, Text, Boolean, Integer, Numeric, Enum, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, uuid_pk

# 题型/测评类型枚举
# 参考：question_type / assessment_kind。:contentReference[oaicite:10]{index=10}
QuestionType = Enum("single", "multi", "short", name="question_type")
AssessmentKind = Enum("global", "topic_quiz", name="assessment_kind")

# 题库 questions
# 参考：结构字段。:contentReference[oaicite:11]{index=11}
class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    qtype: Mapped[str] = mapped_column(QuestionType, nullable=False)
    stem: Mapped[str] = mapped_column(Text, nullable=False)
    choices: Mapped[Optional[dict]] = mapped_column(JSONB)     # [{key,text}]
    answer_key: Mapped[Optional[dict]] = mapped_column(JSONB)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    rubric: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

# 题目-主题 关联（多对多）
# 参考：question_topics。:contentReference[oaicite:12]{index=12}
class QuestionTopic(Base):
    __tablename__ = "question_topics"
    __table_args__ = (
        PrimaryKeyConstraint("question_id", "topic_id", name="pk_question_topics"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))

# 测评会话（大测/小测）
# 参考：assessment_sessions 字段。:contentReference[oaicite:13]{index=13}
class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(AssessmentKind, nullable=False)
    topic_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("topics.id"))
    started_at = mapped_column()
    submitted_at = mapped_column()
    total_score: Mapped[Optional[float]] = mapped_column(Numeric)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    ai_recommendation: Mapped[Optional[dict]] = mapped_column(JSONB)
    last_question_index: Mapped[Optional[int]] = mapped_column(Integer)

    items: Mapped[List["AssessmentItem"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

# 评测中的每道题快照
# 参考：assessment_items。:contentReference[oaicite:14]{index=14}
class AssessmentItem(Base):
    __tablename__ = "assessment_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessment_sessions.id", ondelete="CASCADE"), index=True)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False)
    question_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)

    session: Mapped["AssessmentSession"] = relationship(back_populates="items")
