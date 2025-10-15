# backend/app/models/boards.py
from __future__ import annotations
import uuid
from typing import Optional, List, TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import String, Integer, Text, ForeignKey, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, uuid_pk_db

if TYPE_CHECKING:
    from .progress import UserTopicProgress

class Board(Base):
    __tablename__ = "boards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    name: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(sa.Integer, server_default=sa.text("0"), nullable=False)

    modules: Mapped[List["Module"]] = relationship(back_populates="board", cascade="all, delete-orphan")

class Module(Base):
    __tablename__ = "modules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    board_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(sa.Integer, server_default=sa.text("0"), nullable=False)

    board: Mapped["Board"] = relationship(back_populates="modules")
    topics: Mapped[List["LearningTopic"]] = relationship(back_populates="module", cascade="all, delete-orphan")


class LearningTopic(Base):
    __tablename__ = "learning_topics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    pass_threshold: Mapped[float] = mapped_column(
        Numeric(3, 2), server_default=sa.text("0.80"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(sa.Integer, server_default=sa.text("0"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=sa.text("true"), nullable=False)

    module: Mapped["Module"] = relationship(back_populates="topics")
    content: Mapped[Optional["LearningTopicContent"]] = relationship(
        back_populates="topic", cascade="all, delete-orphan", uselist=False
    )
    progress_entries: Mapped[List["UserTopicProgress"]] = relationship(
        back_populates="topic"
    )

class LearningTopicContent(TimestampMixin, Base):
    __tablename__ = "learning_topic_contents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    topic_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learning_topics.id", ondelete="CASCADE"),
        unique=True, index=True, nullable=False
    )
    body_format: Mapped[str] = mapped_column(String, server_default=sa.text("'markdown'"), nullable=False)
    body_markdown: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    resources: Mapped[Optional[dict]] = mapped_column(JSONB)

    topic: Mapped["LearningTopic"] = relationship(back_populates="content")
