# backend/app/models/documents.py
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, uuid_pk_db

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    title: Mapped[Optional[str]] = mapped_column(String)
    source: Mapped[Optional[str]] = mapped_column(String)
    topic_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("topics.id"))
    document_metadata: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False
    )

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db())
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True, nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[list[float]]] = mapped_column(JSONB)
