# backend/app/models/chat.py
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List

import sqlalchemy as sa
from sqlalchemy import String, Integer, Text, DateTime, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, uuid_pk_db

ChatScope = Enum("global", "topic", name="chat_scope")
MsgRole = Enum("user", "ai", name="role")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="ux_topic_chat_once"),
        Index("idx_sessions_user_last_active", "user_id", "last_active_at", postgresql_using="btree"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    scope: Mapped[str] = mapped_column(ChatScope, nullable=False)
    topic_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("learning_topics.id"))
    title: Mapped[Optional[str]] = mapped_column(String)

    token_count: Mapped[Optional[int]] = mapped_column(Integer)
    message_count: Mapped[Optional[int]] = mapped_column(Integer)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    summary_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    summarized_upto_message_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    # 创建时自动给值；后续由业务逻辑更新（更可控）
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )

    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(MsgRole, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[Optional[int]] = mapped_column(Integer)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
