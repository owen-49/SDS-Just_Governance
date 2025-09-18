from __future__ import annotations
import uuid
from typing import Optional, List
from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, uuid_pk

# 四大板块 / 模块 / 主题
# 参考：boards/modules/topics 结构。:contentReference[oaicite:4]{index=4}
class Board(Base):
    __tablename__ = "boards"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    modules: Mapped[List["Module"]] = relationship(back_populates="board", cascade="all, delete-orphan")

class Module(Base):
    __tablename__ = "modules"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    board_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    board: Mapped["Board"] = relationship(back_populates="modules")
    topics: Mapped[List["Topic"]] = relationship(back_populates="module", cascade="all, delete-orphan")

class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    pass_threshold: Mapped[float] = mapped_column(default=0.8)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    module: Mapped["Module"] = relationship(back_populates="topics")
    content: Mapped[Optional["TopicContent"]] = relationship(
        back_populates="topic", cascade="all, delete-orphan", uselist=False
    )

# 主题内容（Markdown + 资源）
# 参考：topic_contents 结构。:contentReference[oaicite:5]{index=5}
class TopicContent(TimestampMixin, Base):
    __tablename__ = "topic_contents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), unique=True, index=True)
    body_format: Mapped[Optional[str]] = mapped_column(String, default="markdown")
    body_markdown: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    resources: Mapped[Optional[dict]] = mapped_column(JSONB)

    topic: Mapped["Topic"] = relationship(back_populates="content")
