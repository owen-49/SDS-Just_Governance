# app/models/topic.py
import uuid, datetime as dt
from sqlalchemy import String, ForeignKey, Table, Column, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

topic_tag = Table(
    "topic_tags", Base.metadata,
    Column("topic_id", ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(120), index=True)
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    is_published: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow)

    author = relationship("User", back_populates="topics")
    comments = relationship("Comment", back_populates="topic", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=topic_tag, back_populates="topics")

class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    topic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(default=dt.datetime.utcnow)

    topic = relationship("Topic", back_populates="comments")
    author = relationship("User")

class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(48), index=True, unique=True)

    topics = relationship("Topic", secondary=topic_tag, back_populates="tags")
