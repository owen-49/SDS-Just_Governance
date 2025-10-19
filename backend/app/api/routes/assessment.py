# backend/app/api/routes/assessment.py
"""
测评模块路由
- 主题小测（Topic Quiz）：2个端点
- 整体评测（Global Assessment）：5个端点
"""
import logging
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.db import get_db
from app.deps.auth import get_current_user
from app.models import User
from app.schemas.core.api_response import ApiResponse, ok, fail
from app.core.exceptions.exceptions import BizError, BizCode

# 导入 Schemas
from app.schemas.assessment import (
    QuizPendingOut,
    QuizSubmitIn,
    QuizSubmitOut,
    AssessmentStartIn,
    AssessmentStartOut,
    AnswerSaveIn,
    AnswerSaveOut,
    AssessmentSubmitOut,
    AssessmentHistoryOut,
    AssessmentDetailOut,
)

# 导入 Services
from app.services.old.quiz_service import QuizService
from app.services.old.assessment_service import AssessmentService

router = APIRouter(prefix="/api/v1", tags=["assessment"])
logger = logging.getLogger(__name__)


# ========================================
# 一、主题小测（Topic Quiz）
# ========================================


@router.post(
    "/topics/{topic_id}/quiz/pending",
    response_model=ApiResponse[QuizPendingOut],
    summary="Generate or fetch pending quiz (topic quiz)",
)
async def get_or_create_quiz_pending(
    topic_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate or fetch a pending quiz for the specified topic."""
    request_id = (
        request.state.request_id if hasattr(request.state, "request_id") else None
    )

    try:
        quiz_service = QuizService(db)

        result = await quiz_service.get_or_create_pending_quiz(
            user_id=current_user.id,
            topic_id=topic_id,
            question_count=5,
        )

        logger.info(
            {
                "action": "quiz_pending_created",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "topic_id": str(topic_id),
                "question_count": len(result.questions),
            }
        )

        return ok(data=result.model_dump(), request_id=request_id)

    except BizError as e:
        logger.warning(
            {
                "action": "quiz_pending_failed",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "topic_id": str(topic_id),
                "error": e.message,
                "code": e.code,
            }
        )
        return fail(
            code=e.code,
            message=e.message,
            data=e.data,
            request_id=request_id,
        )

    except Exception as e:
        logger.error(
            {
                "action": "quiz_pending_error",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "topic_id": str(topic_id),
                "error": str(e),
            },
            exc_info=True,
        )
        return fail(
            code=BizCode.INTERNAL_ERROR,
            message="internal_error",
            request_id=request_id,
        )


@router.post(
    "/topics/{topic_id}/quiz/submit",
    response_model=ApiResponse[QuizSubmitOut],
    summary="Submit topic quiz and grade",
)
async def submit_topic_quiz(
    topic_id: UUID,
    payload: QuizSubmitIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit the topic quiz answers and return grading results."""
    request_id = (
        request.state.request_id if hasattr(request.state, "request_id") else None
    )

    try:
        quiz_service = QuizService(db)

        result = await quiz_service.submit_and_grade(
            user_id=current_user.id,
            topic_id=topic_id,
            answers=payload.answers,
        )

        logger.info(
            {
                "action": "quiz_submitted",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "topic_id": str(topic_id),
                "session_id": str(result.session_id),
                "total_score": result.total_score,
                "can_mark_complete": result.can_mark_complete,
            }
        )

        return ok(data=result.model_dump(), request_id=request_id)

    except BizError as e:
        logger.warning(
            {
                "action": "quiz_submit_failed",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "topic_id": str(topic_id),
                "error": e.message,
                "code": e.code,
            }
        )
        return fail(
            code=e.code,
            message=e.message,
            data=e.data,
            request_id=request_id,
        )

    except Exception as e:
        logger.error(
            {
                "action": "quiz_submit_error",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "topic_id": str(topic_id),
                "error": str(e),
            },
            exc_info=True,
        )
        return fail(
            code=BizCode.INTERNAL_ERROR,
            message="internal_error",
            request_id=request_id,
        )


# ========================================
# 二、整体评测（Global Assessment）
# ========================================


@router.post(
    "/assessments/global/start",
    response_model=ApiResponse[AssessmentStartOut],
    summary="Start global assessment (create session & generate questions)",
)
async def start_global_assessment(
    request: Request,
    payload: Optional[AssessmentStartIn] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a new global assessment session and generate questions."""
    request_id = (
        request.state.request_id if hasattr(request.state, "request_id") else None
    )

    try:
        assessment_service = AssessmentService(db)

        result = await assessment_service.start_global_assessment(
            user_id=current_user.id,
            config=payload,
        )

        logger.info(
            {
                "action": "assessment_started",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(result.session_id),
                "question_count": len(result.items),
            }
        )

        return ok(data=result.model_dump(), request_id=request_id)

    except BizError as e:
        logger.warning(
            {
                "action": "assessment_start_failed",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "error": e.message,
                "code": e.code,
            }
        )
        return fail(
            code=e.code,
            message=e.message,
            data=e.data,
            request_id=request_id,
        )

    except Exception as e:
        logger.error(
            {
                "action": "assessment_start_error",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "error": str(e),
            },
            exc_info=True,
        )
        return fail(
            code=BizCode.INTERNAL_ERROR,
            message="internal_error",
            request_id=request_id,
        )


@router.post(
    "/assessments/{session_id}/answer",
    response_model=ApiResponse[AnswerSaveOut],
    summary="Save answer for current question (auto-save)",
)
async def save_answer(
    session_id: UUID,
    payload: AnswerSaveIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save the current answer for the session (auto-save)."""
    request_id = (
        request.state.request_id if hasattr(request.state, "request_id") else None
    )

    try:
        assessment_service = AssessmentService(db)

        result = await assessment_service.save_answer(
            session_id=session_id,
            user_id=current_user.id,
            payload=payload,
        )

        logger.info(
            {
                "action": "answer_saved",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "item_id": str(payload.item_id),
                "progress": result.progress.model_dump(),
            }
        )

        return ok(data=result.model_dump(), request_id=request_id)

    except BizError as e:
        logger.warning(
            {
                "action": "answer_save_failed",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "error": e.message,
                "code": e.code,
            }
        )
        return fail(
            code=e.code,
            message=e.message,
            data=e.data,
            request_id=request_id,
        )

    except Exception as e:
        logger.error(
            {
                "action": "answer_save_error",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "error": str(e),
            },
            exc_info=True,
        )
        return fail(
            code=BizCode.INTERNAL_ERROR,
            message="internal_error",
            request_id=request_id,
        )


@router.post(
    "/assessments/{session_id}/submit",
    response_model=ApiResponse[AssessmentSubmitOut],
    summary="Submit global assessment (score & AI summary)",
)
async def submit_global_assessment(
    session_id: UUID,
    request: Request,
    force: bool = Query(False, description="Force submit even if some answers are missing"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit the global assessment, compute scores, and generate AI summary."""
    request_id = (
        request.state.request_id if hasattr(request.state, "request_id") else None
    )

    try:
        assessment_service = AssessmentService(db)

        result = await assessment_service.submit_and_finalize(
            session_id=session_id,
            user_id=current_user.id,
            force=force,
        )

        logger.info(
            {
                "action": "assessment_submitted",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "total_score": result.total_score,
                "breakdown_count": len(result.breakdown),
            }
        )

        return ok(data=result.model_dump(), request_id=request_id)

    except BizError as e:
        logger.warning(
            {
                "action": "assessment_submit_failed",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "error": e.message,
                "code": e.code,
            }
        )
        return fail(
            code=e.code,
            message=e.message,
            data=e.data,
            request_id=request_id,
        )

    except Exception as e:
        logger.error(
            {
                "action": "assessment_submit_error",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "error": str(e),
            },
            exc_info=True,
        )
        return fail(
            code=BizCode.INTERNAL_ERROR,
            message="internal_error",
            request_id=request_id,
        )


@router.get(
    "/assessments/history",
    response_model=ApiResponse[AssessmentHistoryOut],
    summary="Get assessment history (user center)",
)
async def get_assessment_history(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the authenticated user's assessment history."""
    request_id = (
        request.state.request_id if hasattr(request.state, "request_id") else None
    )

    try:
        assessment_service = AssessmentService(db)

        result = await assessment_service.get_user_history(
            user_id=current_user.id,
            page=page,
            limit=limit,
        )

        logger.info(
            {
                "action": "history_retrieved",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "page": page,
                "limit": limit,
                "total": result.pagination.total,
            }
        )

        return ok(data=result.model_dump(), request_id=request_id)

    except BizError as e:
        logger.warning(
            {
                "action": "history_retrieval_failed",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "error": e.message,
                "code": e.code,
            }
        )
        return fail(
            code=e.code,
            message=e.message,
            data=e.data,
            request_id=request_id,
        )

    except Exception as e:
        logger.error(
            {
                "action": "history_retrieval_error",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "error": str(e),
            },
            exc_info=True,
        )
        return fail(
            code=BizCode.INTERNAL_ERROR,
            message="internal_error",
            request_id=request_id,
        )


@router.get(
    "/assessments/{session_id}",
    response_model=ApiResponse[AssessmentDetailOut],
    summary="Get assessment detail (per-question review)",
)
async def get_assessment_detail(
    session_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the detailed per-question review for a submitted assessment."""
    request_id = (
        request.state.request_id if hasattr(request.state, "request_id") else None
    )

    try:
        assessment_service = AssessmentService(db)

        result = await assessment_service.get_session_detail(
            session_id=session_id,
            user_id=current_user.id,
        )

        logger.info(
            {
                "action": "detail_retrieved",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "item_count": len(result.items),
            }
        )

        return ok(data=result.model_dump(), request_id=request_id)

    except BizError as e:
        logger.warning(
            {
                "action": "detail_retrieval_failed",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "error": e.message,
                "code": e.code,
            }
        )
        return fail(
            code=e.code,
            message=e.message,
            data=e.data,
            request_id=request_id,
        )

    except Exception as e:
        logger.error(
            {
                "action": "detail_retrieval_error",
                "request_id": request_id,
                "user_id": str(current_user.id),
                "session_id": str(session_id),
                "error": str(e),
            },
            exc_info=True,
        )
        return fail(
            code=BizCode.INTERNAL_ERROR,
            message="internal_error",
            request_id=request_id,
        )
