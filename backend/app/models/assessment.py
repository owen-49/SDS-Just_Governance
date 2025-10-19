# backend/app/models/assessment.py
"""
评测相关数据模型
- Question: 题库
- QuestionTopic: 题目-主题关联
- AssessmentSession: 评测会话
- AssessmentItem: 题目快照
- AssessmentResponse: 答题记录（新增）
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List

import sqlalchemy as sa
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Integer,
    Numeric,
    Enum,
    ForeignKey,
    PrimaryKeyConstraint,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, uuid_pk_db

QuestionType = Enum("single", "multi", "short", name="question_type")
AssessmentKind = Enum("global", "topic_quiz", name="assessment_kind")


class Question(Base):
    """题库"""

    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db()
    )
    qtype: Mapped[str] = mapped_column(QuestionType, nullable=False)
    stem: Mapped[str] = mapped_column(Text, nullable=False)
    choices: Mapped[Optional[dict]] = mapped_column(JSONB)
    answer_key: Mapped[Optional[dict]] = mapped_column(JSONB)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    rubric: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(
        Boolean, server_default=sa.text("true"), nullable=False
    )


class QuestionTopic(Base):
    """题目-主题关联表"""

    __tablename__ = "question_topics"
    __table_args__ = (
        PrimaryKeyConstraint("question_id", "topic_id", name="pk_question_topics"),
    )

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learning_topics.id", ondelete="CASCADE"), nullable=False
    )


class AssessmentSession(Base):
    """评测会话"""

    __tablename__ = "assessment_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(AssessmentKind, nullable=False)
    topic_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("learning_topics.id")
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_score: Mapped[Optional[float]] = mapped_column(Numeric)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    ai_recommendation: Mapped[Optional[dict]] = mapped_column(JSONB)
    last_question_index: Mapped[Optional[int]] = mapped_column(Integer)

    # 关系
    items: Mapped[List["AssessmentItem"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    responses: Mapped[List["AssessmentResponse"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class AssessmentItem(Base):
    """题目快照（评测中的题目实例）"""

    __tablename__ = "assessment_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db()
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessment_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False)
    question_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # 关系
    session: Mapped["AssessmentSession"] = relationship(back_populates="items")
    response: Mapped[Optional["AssessmentResponse"]] = relationship(
        back_populates="item", uselist=False
    )


# ========================================
# 新增：AssessmentResponse（答题记录）
# ========================================


class AssessmentResponse(Base):
    """
    用户答题记录（一题一条）
    - 存储用户的答案
    - 客观题：自动判分（is_correct、score）
    - 简答题：后续人工/AI判分
    """

    __tablename__ = "assessment_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db()
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessment_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessment_items.id", ondelete="CASCADE"),
        unique=True,  # 一题只能有一条答题记录
        index=True,
        nullable=False,
    )

    # 用户答案（标准化格式）
    # 单选: "B"
    # 多选: "A,C,D"（排序后，逗号分隔）
    # 简答: 原文
    answer: Mapped[str] = mapped_column(Text, nullable=False)

    # 判分结果（客观题自动填充）
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean)
    score: Mapped[Optional[float]] = mapped_column(Numeric)

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    # 关系
    session: Mapped["AssessmentSession"] = relationship(back_populates="responses")
    item: Mapped["AssessmentItem"] = relationship(back_populates="response")
