from __future__ import annotations

"""Topic scoped retrieval utilities."""

from dataclasses import dataclass
from typing import Sequence
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, DocumentChunk
from .embeddings import EmbeddingBackend, SimpleEmbeddingBackend, cosine_similarity


@dataclass(slots=True)
class RagResult:
    chunk_id: UUID
    document_id: UUID
    score: float
    content: str
    chunk_index: int
    document_title: str | None
    source: str | None
    metadata: dict | None

    def as_payload(self) -> dict:
        return {
            "chunk_id": str(self.chunk_id),
            "document_id": str(self.document_id),
            "chunk_index": self.chunk_index,
            "score": round(self.score, 6),
            "content": self.content,
            "document_title": self.document_title,
            "source": self.source,
            "metadata": self.metadata or {},
        }


class TopicRAGService:
    """Execute topic scoped retrieval with pluggable embeddings."""

    def __init__(self, embedding_backend: EmbeddingBackend | None = None) -> None:
        self._backend = embedding_backend or SimpleEmbeddingBackend()

    def embed_text(self, text: str) -> list[float]:
        return self._backend.embed(text)

    async def _ensure_chunk_embedding(self, session: AsyncSession, chunk: DocumentChunk) -> list[float]:
        if chunk.embedding:
            return list(chunk.embedding)
        embedding = self.embed_text(chunk.content)
        chunk.embedding = embedding
        session.add(chunk)
        await session.flush()
        return embedding

    async def _load_chunks(self, session: AsyncSession, topic_id: UUID) -> Sequence[tuple[DocumentChunk, Document]]:
        stmt = (
            sa.select(DocumentChunk, Document)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(Document.topic_id == topic_id)
            .order_by(DocumentChunk.chunk_index.asc())
        )
        result = await session.execute(stmt)
        return result.all()

    async def search(
        self,
        session: AsyncSession,
        topic_id: UUID,
        query: str,
        *,
        limit: int = 5,
    ) -> list[RagResult]:
        if not query.strip():
            return []

        query_embedding = self._backend.embed(query)
        rows = await self._load_chunks(session, topic_id)
        scored: list[tuple[float, DocumentChunk, Document, list[float]]] = []

        for chunk, document in rows:
            embedding = await self._ensure_chunk_embedding(session, chunk)
            score = cosine_similarity(query_embedding, embedding)
            if score <= 0:
                continue
            scored.append((score, chunk, document, embedding))

        scored.sort(key=lambda item: item[0], reverse=True)
        top = scored[:limit]

        return [
            RagResult(
                chunk_id=chunk.id,
                document_id=document.id,
                score=score,
                content=chunk.content,
                chunk_index=chunk.chunk_index,
                document_title=document.title,
                source=document.source,
                metadata=document.document_metadata,
            )
            for score, chunk, document, _ in top
        ]


__all__ = ["TopicRAGService", "RagResult"]
