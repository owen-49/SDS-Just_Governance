from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db.db import get_db
from app.core.exceptions.codes import BizCode
from app.core.exceptions.exceptions import BizError
from app.deps.auth import get_current_user
from app.models import (
    Board,
    Module,
    Topic,
    TopicContent,
    UserTopicProgress,
)
from app.schemas.api_response import ok

router = APIRouter(prefix="/api/v1", tags=["learning"])


def _validate_order(order: str) -> str:
    if order.lower() not in {"asc", "desc"}:
        raise BizError(422, BizCode.VALIDATION_ERROR, "invalid_order", data={"allowed": ["asc", "desc"]})
    return order.lower()


def _resolve_sort(sort: str, allowed: dict[str, Any]) -> Any:
    try:
        return allowed[sort]
    except KeyError as exc:
        raise BizError(
            422,
            BizCode.VALIDATION_ERROR,
            "invalid_sort",
            data={"field": "sort", "allowed": list(allowed.keys())},
        ) from exc


def _apply_sort(column: Any, order: str) -> Any:
    if order == "desc":
        return sa.desc(column)
    return sa.asc(column)


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _datetime_to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat()


@router.get("/boards")
async def list_boards(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort: str = Query("sort_order"),
    order: str = Query("asc"),
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    del user
    order = _validate_order(order)
    sort_column = _resolve_sort(sort, {
        "sort_order": Board.sort_order,
        "name": Board.name,
        "id": Board.id,
    })

    total_result = await session.execute(sa.select(sa.func.count()).select_from(Board))
    total = total_result.scalar_one()

    stmt = (
        sa.select(Board)
        .order_by(_apply_sort(sort_column, order))
        .offset((page - 1) * size)
        .limit(size)
    )
    result = await session.execute(stmt)
    boards = result.scalars().all()

    data = {
        "items": [
            {"board_id": str(board.id), "name": board.name, "sort_order": board.sort_order}
            for board in boards
        ],
        "page": page,
        "size": size,
        "total": total,
    }
    return ok(data=data, request=request)


@router.get("/boards/{board_id}/modules")
async def list_modules(
    board_id: UUID,
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    sort: str = Query("sort_order"),
    order: str = Query("asc"),
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    del user
    board = await session.get(Board, board_id)
    if not board:
        raise BizError(404, BizCode.NOT_FOUND, "board_not_found")

    order = _validate_order(order)
    sort_column = _resolve_sort(sort, {
        "sort_order": Module.sort_order,
        "name": Module.name,
        "id": Module.id,
    })

    base_stmt = sa.select(Module).where(Module.board_id == board_id)
    total_result = await session.execute(
        sa.select(sa.func.count()).select_from(base_stmt.subquery())
    )
    total = total_result.scalar_one()

    stmt = (
        base_stmt.order_by(_apply_sort(sort_column, order)).offset((page - 1) * size).limit(size)
    )
    result = await session.execute(stmt)
    modules = result.scalars().all()

    data = {
        "items": [
            {"module_id": str(module.id), "name": module.name, "sort_order": module.sort_order}
            for module in modules
        ],
        "page": page,
        "size": size,
        "total": total,
    }
    return ok(data=data, request=request)


@router.get("/modules/{module_id}/topics")
async def list_topics(
    module_id: UUID,
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    sort: str = Query("sort_order"),
    order: str = Query("asc"),
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    del user
    module = await session.get(Module, module_id)
    if not module:
        raise BizError(404, BizCode.NOT_FOUND, "module_not_found")

    order = _validate_order(order)
    sort_column = _resolve_sort(sort, {
        "sort_order": Topic.sort_order,
        "name": Topic.name,
        "id": Topic.id,
    })

    base_stmt = sa.select(Topic).where(Topic.module_id == module_id, Topic.is_active.is_(True))
    total_result = await session.execute(
        sa.select(sa.func.count()).select_from(base_stmt.subquery())
    )
    total = total_result.scalar_one()

    stmt = (
        base_stmt.order_by(_apply_sort(sort_column, order)).offset((page - 1) * size).limit(size)
    )
    result = await session.execute(stmt)
    topics = result.scalars().all()

    data = {
        "items": [
            {
                "topic_id": str(topic.id),
                "name": topic.name,
                "pass_threshold": _decimal_to_float(topic.pass_threshold),
                "sort_order": topic.sort_order,
                "is_active": topic.is_active,
            }
            for topic in topics
        ],
        "page": page,
        "size": size,
        "total": total,
    }
    return ok(data=data, request=request)


@router.get("/topics/{topic_id}")
async def get_topic_detail(
    topic_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    topic = await session.get(Topic, topic_id)
    if not topic or not topic.is_active:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")

    progress = await session.get(UserTopicProgress, (user.id, topic_id))

    data = {
        "topic": {
            "topic_id": str(topic.id),
            "name": topic.name,
            "pass_threshold": _decimal_to_float(topic.pass_threshold),
            "is_active": topic.is_active,
        },
        "progress_summary": {
            "progress_status": progress.progress_status if progress else "not_started",
            "best_score": _decimal_to_float(progress.best_score) if progress else None,
            "last_score": _decimal_to_float(progress.last_score) if progress else None,
            "marked_complete": bool(progress.marked_complete) if progress else False,
        },
    }
    return ok(data=data, request=request)


@router.get("/topics/{topic_id}/content")
async def get_topic_content(
    topic_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    del user
    stmt = (
        sa.select(TopicContent, Topic)
        .join(Topic, TopicContent.topic_id == Topic.id)
        .where(Topic.id == topic_id)
    )
    result = await session.execute(stmt)
    row = result.first()
    if not row:
        raise BizError(404, BizCode.NOT_FOUND, "topic_content_not_found")

    content, topic = row
    if not topic.is_active:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")

    data = {
        "topic_id": str(content.topic_id),
        "body_format": content.body_format,
        "body_markdown": content.body_markdown,
        "summary": content.summary,
        "resources": content.resources or [],
    }
    return ok(data=data, request=request)


@router.get("/topics/{topic_id}/progress")
async def get_topic_progress(
    topic_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    topic = await session.get(Topic, topic_id)
    if not topic or not topic.is_active:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")

    progress = await session.get(UserTopicProgress, (user.id, topic_id))

    data = {
        "progress_status": progress.progress_status if progress else "not_started",
        "last_score": _decimal_to_float(progress.last_score) if progress else None,
        "attempt_count": progress.attempt_count if progress else 0,
        "best_score": _decimal_to_float(progress.best_score) if progress else None,
        "last_quiz_session_id": str(progress.last_quiz_session_id) if progress and progress.last_quiz_session_id else None,
        "quiz_state": progress.quiz_state if progress else "none",
        "marked_complete": bool(progress.marked_complete) if progress else False,
        "completed_at": _datetime_to_iso(progress.completed_at) if progress else None,
        "last_visited_at": _datetime_to_iso(progress.last_visited_at) if progress else None,
    }
    return ok(data=data, request=request)


@router.post("/topics/{topic_id}/visit")
async def visit_topic(
    topic_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    topic = await session.get(Topic, topic_id)
    if not topic or not topic.is_active:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")

    progress = await session.get(UserTopicProgress, (user.id, topic_id))
    now = datetime.now(timezone.utc)
    if not progress:
        progress = UserTopicProgress(
            user_id=user.id,
            topic_id=topic_id,
            progress_status="in_progress",
            last_visited_at=now,
        )
        session.add(progress)
    else:
        progress.last_visited_at = now
        if progress.progress_status == "not_started":
            progress.progress_status = "in_progress"
    await session.commit()
    return ok(request=request)


@router.post("/topics/{topic_id}/complete")
async def complete_topic(
    topic_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    topic = await session.get(Topic, topic_id)
    if not topic or not topic.is_active:
        raise BizError(404, BizCode.NOT_FOUND, "topic_not_found")

    progress = await session.get(UserTopicProgress, (user.id, topic_id))
    best_score = _decimal_to_float(progress.best_score) if progress and progress.best_score is not None else None
    threshold = _decimal_to_float(topic.pass_threshold) or 0.0

    if best_score is None or best_score < threshold:
        raise BizError(
            409,
            BizCode.CONFLICT,
            "score_below_threshold",
            data={"pass_threshold": threshold},
        )

    if progress.marked_complete:
        raise BizError(409, BizCode.CONFLICT, "already_marked_complete")

    now = datetime.now(timezone.utc)
    progress.marked_complete = True
    progress.completed_at = now
    progress.progress_status = "completed"
    await session.commit()

    data = {
        "marked_complete": True,
        "completed_at": _datetime_to_iso(now),
    }
    return ok(data=data, request=request)


@router.get("/progress/overview")
async def progress_overview(
    request: Request,
    session: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    boards_result = await session.execute(
        sa.select(Board).options(selectinload(Board.modules)).order_by(Board.sort_order.asc(), Board.name.asc())
    )
    boards = boards_result.scalars().unique().all()

    totals_result = await session.execute(
        sa.select(Topic.module_id, sa.func.count())
        .where(Topic.is_active.is_(True))
        .group_by(Topic.module_id)
    )
    totals = {module_id: count for module_id, count in totals_result.all()}

    completed_result = await session.execute(
        sa.select(Topic.module_id, sa.func.count())
        .join(UserTopicProgress, sa.and_(UserTopicProgress.topic_id == Topic.id, UserTopicProgress.user_id == user.id))
        .where(Topic.is_active.is_(True), UserTopicProgress.progress_status == "completed")
        .group_by(Topic.module_id)
    )
    completed = {module_id: count for module_id, count in completed_result.all()}

    payload = {
        "boards": [],
    }

    for board in boards:
        board_entry = {
            "board_id": str(board.id),
            "name": board.name,
            "modules": [],
        }
        modules = sorted(board.modules, key=lambda m: (m.sort_order, m.name))
        for module in modules:
            board_entry["modules"].append(
                {
                    "module_id": str(module.id),
                    "name": module.name,
                    "topics_total": totals.get(module.id, 0),
                    "topics_completed": completed.get(module.id, 0),
                }
            )
        payload["boards"].append(board_entry)

    return ok(data=payload, request=request)
