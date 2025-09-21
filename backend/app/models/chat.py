from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Text, DateTime, Enum, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, uuid_pk

# ENUM 定义（PG 枚举）
# 参考：chat_scope, role。:contentReference[oaicite:6]{index=6}
ChatScope = Enum("global", "topic", name="chat_scope")
MsgRole = Enum("user", "ai", name="role")

# chat_sessions
# 参考：结构与索引。:contentReference[oaicite:7]{index=7}
class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="ux_topic_chat_once"),
        Index("idx_sessions_user_last_active", "user_id", "last_active_at", postgresql_using="btree"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scope: Mapped[str] = mapped_column(ChatScope, nullable=False)
    topic_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("topics.id"))
    title: Mapped[Optional[str]] = mapped_column(String)

    token_count: Mapped[Optional[int]] = mapped_column(Integer)
    message_count: Mapped[Optional[int]] = mapped_column(Integer)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    summary_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    summarized_upto_message_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

# chat_messages（附 meta/embedding）
# 参考：字段与 pgvector 注释。:contentReference[oaicite:8]{index=8} :contentReference[oaicite:9]{index=9}
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(MsgRole, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[Optional[int]] = mapped_column(Integer)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # 如果启用了 pgvector，可把下行改成真正的 vector(1536)
    # from sqlalchemy import types; class Vector(types.UserDefinedType): def get_col_spec(self): return "vector(1536)"
    # embedding: Mapped[Optional[Any]] = mapped_column(Vector)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
