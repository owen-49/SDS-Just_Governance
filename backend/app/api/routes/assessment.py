# backend/app/api/routes/assessment.py
"""
测评模块路由
- 主题小测（Topic Quiz）：2个端点
- 整体评测（Global Assessment）：5个端点
"""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.db import get_db
from app.deps.auth import get_current_user
from app.models import User
from app.schemas.core.api_response import ok, fail
from app.core.exceptions.exceptions import BizError, BizCode

# TODO: 待实现的 schemas 和 services
# from app.schemas.assessment import (
#     QuizPendingOut, QuizSubmitIn, QuizSubmitOut,
#     AssessmentStartIn, AssessmentStartOut,
#     AnswerSaveIn, AnswerSaveOut,
#     AssessmentSubmitOut, AssessmentHistoryOut,
#     AssessmentDetailOut
# )
# from app.services.quiz_service import QuizService
# from app.services.assessment_service import AssessmentService

router = APIRouter(prefix="/api/v1", tags=["assessment"])


# ========================================
# 一、主题小测（Topic Quiz）
# ========================================


@router.post("/topics/{topic_id}/quiz/pending")
async def get_or_create_quiz_pending(
    topic_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    生成/获取待做题单（主题小测）

    **业务逻辑：**
    1. 检查 user_topic_progress 是否已有 pending_quiz
    2. 若无，从 question_topics 按主题抽题（如5-10题）
    3. 将题单存入 pending_quiz (JSONB)，设置 quiz_state='pending'
    4. 若已有，直接返回现有题单

    **响应示例：**
    ```json
    {
      "code": 0,
      "message": "ok",
      "data": {
        "topic_id": "uuid",
        "quiz_state": "pending",
        "questions": [
          {
            "order_no": 1,
            "question_id": "uuid",
            "qtype": "single",
            "stem": "What is corporate governance?",
            "choices": ["A. ...", "B. ...", "C. ...", "D. ..."]
          }
        ]
      }
    }
    ```

    **错误码：**
    - 401: 未登录
    - 404: 主题不存在
    """
    # TODO: 实现逻辑
    # quiz_service = QuizService(db)
    # result = await quiz_service.get_or_create_pending_quiz(
    #     user_id=current_user.id,
    #     topic_id=topic_id
    # )
    # return ok(data=result)

    # 临时占位返回
    return ok(
        data={"topic_id": str(topic_id), "quiz_state": "pending", "questions": []}
    )


@router.post("/topics/{topic_id}/quiz/submit")
async def submit_topic_quiz(
    topic_id: UUID,
    # payload: QuizSubmitIn,  # TODO: 使用真实schema
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    提交主题小测并判分

    **请求体示例：**
    ```json
    {
      "answers": [
        {"order_no": 1, "answer": "B"},
        {"order_no": 2, "answer": "A"},
        {"order_no": 3, "answer": "C"}
      ]
    }
    ```

    **业务逻辑：**
    1. 从 pending_quiz 取题单（若不存在 → 409）
    2. **此时才创建** assessment_sessions(kind='topic_quiz', topic_id=...)
    3. 为每题写入 assessment_items（question_snapshot）
    4. 写入 assessment_responses，判分客观题
    5. 计算 total_score，更新 user_topic_progress:
       - last_score, attempt_count, best_score
       - last_quiz_session_id
       - quiz_state='completed', 清空 pending_quiz

    **响应示例：**
    ```json
    {
      "code": 0,
      "message": "ok",
      "data": {
        "session_id": "uuid",
        "total_score": 85.0,
        "items": [
          {
            "order_no": 1,
            "is_correct": true,
            "correct_answer": "B",
            "explanation": "Corporate governance ensures..."
          },
          {
            "order_no": 2,
            "is_correct": false,
            "correct_answer": "D",
            "explanation": "The primary duty is..."
          }
        ],
        "can_mark_complete": true
      }
    }
    ```

    **错误码：**
    - 401: 未登录
    - 404: 主题不存在
    - 409: pending_quiz不存在或已完成（conflict）
    - 422: 答案格式错误
    """
    # TODO: 实现逻辑
    # quiz_service = QuizService(db)
    # result = await quiz_service.submit_and_grade(
    #     user_id=current_user.id,
    #     topic_id=topic_id,
    #     answers=payload.answers
    # )
    # return ok(data=result)

    return ok(
        data={
            "session_id": "temp-uuid",
            "total_score": 0.0,
            "items": [],
            "can_mark_complete": False,
        }
    )


# ========================================
# 二、整体评测（Global Assessment）
# ========================================


@router.post("/assessments/global/start")
async def start_global_assessment(
    # payload: AssessmentStartIn = None,  # TODO: 可选配置
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    开始整体评测（创建会话+出题）

    **请求体（可选）：**
    ```json
    {
      "difficulty": "mixed",  // beginner|intermediate|advanced|mixed
      "count": 20             // 题目数量，默认20
    }
    ```

    **业务逻辑：**
    1. 创建 assessment_sessions(kind='global', user_id=...)
    2. 从 questions 表跨主题抽题（按权重/难度策略）
    3. 写入 assessment_items(question_snapshot)
    4. 返回首屏题目（前端可分页加载或一次性全拿）

    **响应示例：**
    ```json
    {
      "code": 0,
      "message": "ok",
      "data": {
        "session_id": "uuid",
        "started_at": "2025-01-15T10:00:00Z",
        "items": [
          {
            "item_id": "uuid",
            "order_no": 1,
            "snapshot": {
              "qtype": "single",
              "stem": "What is the role of a board?",
              "choices": ["A. ...", "B. ...", "C. ...", "D. ..."]
            }
          }
        ],
        "progress": {
          "total": 20,
          "answered": 0,
          "last_question_index": 0
        }
      }
    }
    ```

    **错误码：**
    - 401: 未登录
    - 409: 用户已有未提交的global会话（可选约束）
    """
    # TODO: 实现逻辑
    # assessment_service = AssessmentService(db)
    # result = await assessment_service.start_global_assessment(
    #     user_id=current_user.id,
    #     config=payload
    # )
    # return ok(data=result)

    return ok(
        data={
            "session_id": "temp-uuid",
            "started_at": "2025-01-15T10:00:00Z",
            "items": [],
            "progress": {"total": 20, "answered": 0, "last_question_index": 0},
        }
    )


@router.post("/assessments/{session_id}/answer")
async def save_answer(
    session_id: UUID,
    # payload: AnswerSaveIn,  # TODO: {item_id, answer, last_question_index?}
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    逐题保存答案（自动保存）

    **请求体示例：**
    ```json
    {
      "item_id": "uuid",        // 或用 order_no 定位
      "answer": "B",
      "last_question_index": 3  // 可选：同步更新进度
    }
    ```

    **业务逻辑：**
    1. 验证会话归属（session.user_id == current_user.id）
    2. 查询 assessment_items 确认 item_id 属于该会话
    3. 写入/更新 assessment_responses(answer)
    4. 客观题可实时计算 is_correct（但不影响总分，提交时统一算）
    5. 更新 assessment_sessions.last_question_index

    **响应示例：**
    ```json
    {
      "code": 0,
      "message": "ok",
      "data": {
        "saved": true,
        "progress": {
          "answered": 4,
          "total": 20,
          "last_question_index": 3
        }
      }
    }
    ```

    **错误码：**
    - 401: 未登录
    - 403: 无权访问他人会话
    - 404: 会话或题目不存在
    - 409: 会话已提交（不可再答题）
    - 422: 答案格式错误
    """
    # TODO: 实现逻辑
    # assessment_service = AssessmentService(db)
    # result = await assessment_service.save_answer(
    #     session_id=session_id,
    #     user_id=current_user.id,
    #     item_id=payload.item_id,
    #     answer=payload.answer,
    #     last_question_index=payload.last_question_index
    # )
    # return ok(data=result)

    return ok(
        data={
            "saved": True,
            "progress": {"answered": 0, "total": 20, "last_question_index": 0},
        }
    )


@router.post("/assessments/{session_id}/submit")
async def submit_global_assessment(
    session_id: UUID,
    force: bool = Query(False, description="强制提交（有未答题时）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    提交整体评测（汇总评分+AI总结）

    **业务逻辑：**
    1. 验证会话归属 & 状态（未提交 & 未过期）
    2. 从 assessment_responses 聚合计算 total_score
    3. 更新 assessment_sessions:
       - submitted_at = NOW()
       - total_score
       - ai_summary, ai_recommendation（可异步生成，先返回基础结果）
    4. 分项得分：按 question_topics 分组统计

    **响应示例：**
    ```json
    {
      "code": 0,
      "message": "ok",
      "data": {
        "session_id": "uuid",
        "total_score": 82.5,
        "breakdown": [
          {
            "topic_id": "uuid",
            "topic_name": "Governance Basics",
            "score": 85.0
          },
          {
            "topic_id": "uuid",
            "topic_name": "Legal Framework",
            "score": 80.0
          }
        ],
        "ai_summary": "You demonstrated strong understanding of governance principles...",
        "ai_recommendation": {
          "level": "intermediate",
          "focus_topics": ["uuid1", "uuid2"],
          "suggested_actions": [
            "Review fiduciary duties in depth",
            "Practice case studies on conflict of interest"
          ]
        },
        "submitted_at": "2025-01-15T11:30:00Z"
      }
    }
    ```

    **错误码：**
    - 401: 未登录
    - 403: 无权访问他人会话
    - 404: 会话不存在
    - 409: 会话已提交（重复提交）
    - 422: 有未答题且未设置force=true
    """
    # TODO: 实现逻辑
    # assessment_service = AssessmentService(db)
    # result = await assessment_service.submit_and_finalize(
    #     session_id=session_id,
    #     user_id=current_user.id,
    #     force=force
    # )
    # return ok(data=result)

    return ok(
        data={
            "session_id": str(session_id),
            "total_score": 0.0,
            "breakdown": [],
            "ai_summary": None,
            "ai_recommendation": None,
            "submitted_at": "2025-01-15T11:30:00Z",
        }
    )


@router.get("/assessments/history")
async def get_assessment_history(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    查看评测历史（个人中心）

    **查询参数：**
    - page: 页码（默认1）
    - limit: 每页条数（默认10，最大50）

    **业务逻辑：**
    查询 assessment_sessions WHERE:
    - user_id = current_user.id
    - kind = 'global'
    - submitted_at IS NOT NULL
    ORDER BY submitted_at DESC

    **响应示例：**
    ```json
    {
      "code": 0,
      "message": "ok",
      "data": {
        "items": [
          {
            "session_id": "uuid",
            "kind": "global",
            "started_at": "2025-01-15T10:00:00Z",
            "submitted_at": "2025-01-15T11:30:00Z",
            "total_score": 82.5,
            "question_count": 20
          },
          {
            "session_id": "uuid",
            "kind": "global",
            "started_at": "2025-01-10T14:00:00Z",
            "submitted_at": "2025-01-10T15:20:00Z",
            "total_score": 78.0,
            "question_count": 20
          }
        ],
        "pagination": {
          "page": 1,
          "limit": 10,
          "total": 5,
          "total_pages": 1
        }
      }
    }
    ```

    **错误码：**
    - 401: 未登录
    """
    # TODO: 实现逻辑
    # assessment_service = AssessmentService(db)
    # result = await assessment_service.get_user_history(
    #     user_id=current_user.id,
    #     page=page,
    #     limit=limit
    # )
    # return ok(data=result)

    return ok(
        data={
            "items": [],
            "pagination": {"page": 1, "limit": 10, "total": 0, "total_pages": 0},
        }
    )


@router.get("/assessments/{session_id}")
async def get_assessment_detail(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    查看评测详情（逐题回放）

    **业务逻辑：**
    JOIN查询：
    - assessment_sessions (基础信息)
    - assessment_items (题目快照)
    - assessment_responses (用户答案+判分)
    ORDER BY order_no ASC

    **权限校验：**
    - 只能查看自己的会话
    - 只返回已提交会话（submitted_at IS NOT NULL）

    **响应示例：**
    ```json
    {
      "code": 0,
      "message": "ok",
      "data": {
        "session": {
          "session_id": "uuid",
          "kind": "global",
          "started_at": "2025-01-15T10:00:00Z",
          "submitted_at": "2025-01-15T11:30:00Z",
          "total_score": 82.5,
          "ai_summary": "You demonstrated...",
          "ai_recommendation": {...}
        },
        "items": [
          {
            "order_no": 1,
            "snapshot": {
              "qtype": "single",
              "stem": "What is the primary role...",
              "choices": ["A. ...", "B. ...", "C. ...", "D. ..."]
            },
            "response": {
              "answer": "B",
              "is_correct": true,
              "correct_answer": "B",
              "explanation": "The board's primary role is...",
              "score": 1.0
            }
          },
          {
            "order_no": 2,
            "snapshot": {
              "qtype": "multi",
              "stem": "Which are fiduciary duties?",
              "choices": ["A. ...", "B. ...", "C. ...", "D. ..."]
            },
            "response": {
              "answer": "A,C",
              "is_correct": false,
              "correct_answer": "A,B,C",
              "explanation": "Fiduciary duties include...",
              "score": 0.5
            }
          }
        ]
      }
    }
    ```

    **错误码：**
    - 401: 未登录
    - 403: 无权访问他人会话
    - 404: 会话不存在或未提交
    """
    # TODO: 实现逻辑
    # assessment_service = AssessmentService(db)
    # result = await assessment_service.get_session_detail(
    #     session_id=session_id,
    #     user_id=current_user.id
    # )
    # return ok(data=result)

    return ok(
        data={
            "session": {
                "session_id": str(session_id),
                "kind": "global",
                "started_at": "2025-01-15T10:00:00Z",
                "submitted_at": None,
                "total_score": None,
                "ai_summary": None,
                "ai_recommendation": None,
            },
            "items": [],
        }
    )
