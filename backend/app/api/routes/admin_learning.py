from __future__ import annotations

"""Minimal learning admin endpoints used to seed topics."""

from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.db import get_db
from app.core.exceptions.codes import BizCode
from app.core.exceptions.exceptions import BizError
from app.deps.auth import get_current_user
from app.models import (
    Board,
    Document,
    DocumentChunk,
    LearningTopic,
    LearningTopicContent,
    Module,
    Question,
    QuestionTopic,
    User,
)
from app.schemas.api_response import ok
from app.services.topic_rag import TopicRAGService

router = APIRouter(prefix="/api/v1/admin/learning", tags=["admin"])

rag_service = TopicRAGService()


def _ensure_admin(user: User) -> None:
    if not user.is_active:
        raise BizError(403, BizCode.FORBIDDEN, "inactive_user")


class BoardCreate(BaseModel):
    name: str = Field(..., min_length=1)
    sort_order: int = Field(0, ge=0)


class ModuleCreate(BaseModel):
    board_id: UUID
    name: str = Field(..., min_length=1)
    sort_order: int = Field(0, ge=0)


class TopicCreate(BaseModel):
    module_id: UUID
    name: str = Field(..., min_length=1)
    sort_order: int = Field(0, ge=0)
    pass_threshold: float = Field(0.8, ge=0, le=1)
    is_active: bool = True


class ResourceItem(BaseModel):
    title: str
    url: str


class TopicContentUpsert(BaseModel):
    body_format: str = Field("markdown", min_length=1)
    body_markdown: str | None = None
    summary: str | None = None
    resources: list[ResourceItem] | dict[str, Any] | None = None


class DocumentChunkIn(BaseModel):
    content: str = Field(..., min_length=1)
    chunk_index: int | None = Field(default=None, ge=0)


class TopicDocumentCreate(BaseModel):
    title: str | None = None
    source: str | None = None
    metadata: dict[str, Any] | None = None
    chunks: list[DocumentChunkIn]


class ChoiceIn(BaseModel):
    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)


class TopicQuestionCreate(BaseModel):
    stem: str = Field(..., min_length=1)
    qtype: Literal["single", "multi", "short"] = "single"
    choices: list[ChoiceIn] = Field(default_factory=list)
    correct_options: list[str] = Field(default_factory=list)
    reference_answer: str | None = None
    explanation: str | None = None
    is_active: bool = True


@router.post("/boards")
async def create_board(
    payload: BoardCreate,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    _ensure_admin(user)
    board = Board(name=payload.name, sort_order=payload.sort_order)
    session.add(board)
    await session.commit()
    await session.refresh(board)
    return ok(
        data={"board_id": str(board.id), "name": board.name, "sort_order": board.sort_order},
        request=request,
        status_code=201,
    )


@router.post("/modules")
async def create_module(
    payload: ModuleCreate,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    _ensure_admin(user)
    board = await session.get(Board, payload.board_id)
    if not board:
        raise BizError(404, BizCode.NOT_FOUND, "board_not_found")
    module = Module(
        board_id=payload.board_id,
        name=payload.name,
        sort_order=payload.sort_order,
    )
    session.add(module)
    await session.commit()
    await session.refresh(module)
    return ok(
        data={
            "module_id": str(module.id),
            "board_id": str(module.board_id),
            "name": module.name,
            "sort_order": module.sort_order,
        },
        request=request,
        status_code=201,
    )


@router.post("/topics")
async def create_topic(
    payload: TopicCreate,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    _ensure_admin(user)
    module = await session.get(Module, payload.module_id)
    if not module:
        raise BizError(404, BizCode.NOT_FOUND, "module_not_found")
    topic = LearningTopic(
        module_id=payload.module_id,
        name=payload.name,
        sort_order=payload.sort_order,
        pass_threshold=Decimal(str(payload.pass_threshold)),
        is_active=payload.is_active,
    )
    session.add(topic)
    await session.commit()
    await session.refresh(topic)
    return ok(
        data={
            "topic_id": str(topic.id),
            "module_id": str(topic.module_id),
            "name": topic.name,
            "sort_order": topic.sort_order,
            "pass_threshold": float(topic.pass_threshold),
            "is_active": topic.is_active,
        },
        request=request,
        status_code=201,
    )


@router.put("/topics/{topic_id}/content")
async def upsert_topic_content(
    topic_id: UUID,
    payload: TopicContentUpsert,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    _ensure_admin(user)
    topic = await session.get(LearningTopic, topic_id)
    if not topic:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")

    resources: Any | None = payload.resources
    if isinstance(resources, list):
        resources = [item.model_dump() for item in resources]

    existing = await session.execute(
        sa.select(LearningTopicContent).where(LearningTopicContent.topic_id == topic_id)
    )
    content = existing.scalar_one_or_none()

    if content:
        content.body_format = payload.body_format
        content.body_markdown = payload.body_markdown
        content.summary = payload.summary
        content.resources = resources
    else:
        content = LearningTopicContent(
            topic_id=topic_id,
            body_format=payload.body_format,
            body_markdown=payload.body_markdown,
            summary=payload.summary,
            resources=resources,
        )
        session.add(content)

    await session.commit()
    await session.refresh(content)
    return ok(
        data={
            "topic_id": str(content.topic_id),
            "content_id": str(content.id),
            "body_format": content.body_format,
        },
        request=request,
    )


@router.post("/topics/{topic_id}/documents")
async def add_topic_document(
    topic_id: UUID,
    payload: TopicDocumentCreate,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    _ensure_admin(user)
    topic = await session.get(LearningTopic, topic_id)
    if not topic:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")
    if not payload.chunks:
        raise BizError(422, BizCode.VALIDATION_ERROR, "missing_chunks")

    document = Document(
        title=payload.title,
        source=payload.source,
        topic_id=topic_id,
        document_metadata=payload.metadata,
    )
    session.add(document)
    await session.flush()

    next_index = 0
    for idx, chunk in enumerate(payload.chunks):
        chunk_index = chunk.chunk_index if chunk.chunk_index is not None else next_index
        next_index = chunk_index + 1
        document_chunk = DocumentChunk(
            document_id=document.id,
            chunk_index=chunk_index,
            content=chunk.content,
        )
        session.add(document_chunk)
        await session.flush()
        document_chunk.embedding = rag_service.embed_text(chunk.content)
        session.add(document_chunk)

    await session.commit()
    await session.refresh(document)
    return ok(
        data={"document_id": str(document.id), "topic_id": str(topic_id)},
        request=request,
        status_code=201,
    )


@router.post("/topics/{topic_id}/quiz/questions")
async def add_topic_question(
    topic_id: UUID,
    payload: TopicQuestionCreate,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    _ensure_admin(user)
    topic = await session.get(LearningTopic, topic_id)
    if not topic:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")

    if payload.qtype in {"single", "multi"} and not payload.choices:
        raise BizError(422, BizCode.VALIDATION_ERROR, "choices_required")

    choices = [choice.model_dump() for choice in payload.choices]
    answer_key: dict[str, Any] = {"correct_options": payload.correct_options}
    if payload.reference_answer:
        answer_key["reference"] = payload.reference_answer

    question = Question(
        qtype=payload.qtype,
        stem=payload.stem,
        choices=choices,
        answer_key=answer_key,
        explanation=payload.explanation,
        is_active=payload.is_active,
    )
    session.add(question)
    await session.flush()

    session.add(QuestionTopic(question_id=question.id, topic_id=topic_id))
    await session.commit()
    await session.refresh(question)

    return ok(
        data={
            "question_id": str(question.id),
            "topic_id": str(topic_id),
            "qtype": question.qtype,
        },
        request=request,
        status_code=201,
    )
