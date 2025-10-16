# backend/app/repositories/assessment_sessions.py
"""
评测会话（AssessmentSession）数据访问层
负责 assessment_sessions 表的 CRUD 操作
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, update, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import AssessmentSession


# ========================================
# 一、创建（Create）
# ========================================


async def create_session(
    db: AsyncSession,
    *,
    user_id: UUID,
    kind: str,  # 'global' | 'topic_quiz'
    topic_id: Optional[UUID] = None,
    **extra_fields,
) -> AssessmentSession:
    """
    创建一个新的评测会话

    Args:
        db: 数据库会话
        user_id: 用户ID
        kind: 评测类型 ('global' 或 'topic_quiz')
        topic_id: 主题ID（仅 topic_quiz 需要）
        **extra_fields: 其他可选字段（如 last_question_index）

    Returns:
        创建的会话对象

    Example:
        >>> session = await create_session(
        ...     db, user_id=user_id, kind='global'
        ... )
    """
    session = AssessmentSession(
        user_id=user_id,
        kind=kind,
        topic_id=topic_id,
        started_at=datetime.now(timezone.utc),
        **extra_fields,
    )
    db.add(session)
    await db.flush()  # 获取 session.id，但不提交事务
    return session


# ========================================
# 二、查询（Read）
# ========================================


async def get_session_by_id(
    db: AsyncSession, session_id: UUID
) -> Optional[AssessmentSession]:
    """
    根据 session_id 查询会话

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        会话对象，不存在返回 None
    """
    result = await db.execute(
        select(AssessmentSession).where(AssessmentSession.id == session_id)
    )
    return result.scalar_one_or_none()


async def get_user_session(
    db: AsyncSession, session_id: UUID, user_id: UUID
) -> Optional[AssessmentSession]:
    """
    查询用户的指定会话（带权限校验）

    Args:
        db: 数据库会话
        session_id: 会话ID
        user_id: 用户ID（权限校验）

    Returns:
        会话对象，不存在或不属于该用户返回 None
    """
    result = await db.execute(
        select(AssessmentSession).where(
            and_(
                AssessmentSession.id == session_id, AssessmentSession.user_id == user_id
            )
        )
    )
    return result.scalar_one_or_none()


async def get_latest_unsubmitted_session(
    db: AsyncSession, user_id: UUID, kind: str
) -> Optional[AssessmentSession]:
    """
    获取用户最新的未提交会话（用于防止重复开始）

    Args:
        db: 数据库会话
        user_id: 用户ID
        kind: 评测类型

    Returns:
        最新的未提交会话，不存在返回 None

    Example:
        >>> # 检查用户是否有未完成的global评测
        >>> session = await get_latest_unsubmitted_session(
        ...     db, user_id=user_id, kind='global'
        ... )
    """
    result = await db.execute(
        select(AssessmentSession)
        .where(
            and_(
                AssessmentSession.user_id == user_id,
                AssessmentSession.kind == kind,
                AssessmentSession.submitted_at.is_(None),
            )
        )
        .order_by(desc(AssessmentSession.started_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_user_history(
    db: AsyncSession,
    user_id: UUID,
    kind: str = "global",
    page: int = 1,
    limit: int = 10,
) -> tuple[List[AssessmentSession], int]:
    """
    查询用户的评测历史（已提交的会话）

    Args:
        db: 数据库会话
        user_id: 用户ID
        kind: 评测类型（默认 'global'）
        page: 页码（从1开始）
        limit: 每页条数

    Returns:
        (会话列表, 总条数) 元组

    Example:
        >>> sessions, total = await get_user_history(
        ...     db, user_id=user_id, page=1, limit=10
        ... )
        >>> print(f"Found {total} sessions, showing {len(sessions)}")
    """
    # 查询总数
    count_query = (
        select(func.count())
        .select_from(AssessmentSession)
        .where(
            and_(
                AssessmentSession.user_id == user_id,
                AssessmentSession.kind == kind,
                AssessmentSession.submitted_at.is_not(None),
            )
        )
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 查询分页数据
    offset = (page - 1) * limit
    data_query = (
        select(AssessmentSession)
        .where(
            and_(
                AssessmentSession.user_id == user_id,
                AssessmentSession.kind == kind,
                AssessmentSession.submitted_at.is_not(None),
            )
        )
        .order_by(desc(AssessmentSession.submitted_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(data_query)
    sessions = list(result.scalars().all())

    return sessions, total


async def get_topic_quiz_session(
    db: AsyncSession, user_id: UUID, topic_id: UUID
) -> Optional[AssessmentSession]:
    """
    查询用户某主题的最新小测会话

    Args:
        db: 数据库会话
        user_id: 用户ID
        topic_id: 主题ID

    Returns:
        最新的主题小测会话，不存在返回 None
    """
    result = await db.execute(
        select(AssessmentSession)
        .where(
            and_(
                AssessmentSession.user_id == user_id,
                AssessmentSession.kind == "topic_quiz",
                AssessmentSession.topic_id == topic_id,
            )
        )
        .order_by(desc(AssessmentSession.started_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


# ========================================
# 三、更新（Update）
# ========================================


async def update_last_question_index(
    db: AsyncSession, session_id: UUID, last_question_index: int
) -> int:
    """
    更新会话的最后答题位置（用于进度追踪）

    Args:
        db: 数据库会话
        session_id: 会话ID
        last_question_index: 最后答题的题号

    Returns:
        受影响的行数（应为1）
    """
    stmt = (
        update(AssessmentSession)
        .where(AssessmentSession.id == session_id)
        .values(last_question_index=last_question_index)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    return result.rowcount or 0


async def mark_as_submitted(
    db: AsyncSession,
    session_id: UUID,
    total_score: float,
    ai_summary: Optional[str] = None,
    ai_recommendation: Optional[dict] = None,
) -> int:
    """
    标记会话为已提交并更新评分/总结

    Args:
        db: 数据库会话
        session_id: 会话ID
        total_score: 总分
        ai_summary: AI生成的总结（可选）
        ai_recommendation: AI生成的建议（可选）

    Returns:
        受影响的行数（应为1）

    Example:
        >>> await mark_as_submitted(
        ...     db, session_id=session_id,
        ...     total_score=82.5,
        ...     ai_summary="You demonstrated..."
        ... )
    """
    stmt = (
        update(AssessmentSession)
        .where(
            and_(
                AssessmentSession.id == session_id,
                AssessmentSession.submitted_at.is_(None),  # 防止重复提交
            )
        )
        .values(
            submitted_at=datetime.now(timezone.utc),
            total_score=total_score,
            ai_summary=ai_summary,
            ai_recommendation=ai_recommendation,
        )
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    return result.rowcount or 0


async def update_ai_content(
    db: AsyncSession,
    session_id: UUID,
    ai_summary: Optional[str] = None,
    ai_recommendation: Optional[dict] = None,
) -> int:
    """
    单独更新AI生成的内容（用于异步生成场景）

    Args:
        db: 数据库会话
        session_id: 会话ID
        ai_summary: AI总结
        ai_recommendation: AI建议

    Returns:
        受影响的行数

    Example:
        >>> # 先提交会话，后台异步生成AI内容
        >>> await mark_as_submitted(db, session_id, total_score)
        >>> # ... 后台任务生成AI内容 ...
        >>> await update_ai_content(
        ...     db, session_id,
        ...     ai_summary=summary,
        ...     ai_recommendation=recommendation
        ... )
    """
    values = {}
    if ai_summary is not None:
        values["ai_summary"] = ai_summary
    if ai_recommendation is not None:
        values["ai_recommendation"] = ai_recommendation

    if not values:
        return 0

    stmt = (
        update(AssessmentSession)
        .where(AssessmentSession.id == session_id)
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    return result.rowcount or 0


# ========================================
# 四、删除（Delete）
# ========================================


async def delete_session(db: AsyncSession, session_id: UUID, user_id: UUID) -> int:
    """
    删除评测会话（级联删除 items 和 responses）

    Args:
        db: 数据库会话
        session_id: 会话ID
        user_id: 用户ID（权限校验）

    Returns:
        受影响的行数

    Note:
        数据库模型中配置了 cascade="all, delete-orphan"，
        删除会话会自动删除关联的 items 和 responses
    """
    from sqlalchemy import delete as sql_delete

    stmt = (
        sql_delete(AssessmentSession)
        .where(
            and_(
                AssessmentSession.id == session_id, AssessmentSession.user_id == user_id
            )
        )
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    return result.rowcount or 0


# ========================================
# 五、统计查询（Statistics）
# ========================================


async def count_user_sessions(
    db: AsyncSession,
    user_id: UUID,
    kind: Optional[str] = None,
    submitted_only: bool = False,
) -> int:
    """
    统计用户的评测会话数量

    Args:
        db: 数据库会话
        user_id: 用户ID
        kind: 评测类型（可选，不传则统计所有）
        submitted_only: 是否只统计已提交的

    Returns:
        会话数量

    Example:
        >>> # 统计用户完成的global评测次数
        >>> count = await count_user_sessions(
        ...     db, user_id=user_id,
        ...     kind='global', submitted_only=True
        ... )
    """
    conditions = [AssessmentSession.user_id == user_id]

    if kind:
        conditions.append(AssessmentSession.kind == kind)

    if submitted_only:
        conditions.append(AssessmentSession.submitted_at.is_not(None))

    query = select(func.count()).select_from(AssessmentSession).where(and_(*conditions))
    result = await db.execute(query)
    return result.scalar() or 0


async def get_user_best_score(
    db: AsyncSession, user_id: UUID, kind: str = "global"
) -> Optional[float]:
    """
    查询用户的最高分

    Args:
        db: 数据库会话
        user_id: 用户ID
        kind: 评测类型

    Returns:
        最高分，无记录返回 None
    """
    query = select(func.max(AssessmentSession.total_score)).where(
        and_(
            AssessmentSession.user_id == user_id,
            AssessmentSession.kind == kind,
            AssessmentSession.submitted_at.is_not(None),
            AssessmentSession.total_score.is_not(None),
        )
    )
    result = await db.execute(query)
    return result.scalar()


async def get_user_average_score(
    db: AsyncSession, user_id: UUID, kind: str = "global"
) -> Optional[float]:
    """
    查询用户的平均分

    Args:
        db: 数据库会话
        user_id: 用户ID
        kind: 评测类型

    Returns:
        平均分（保留2位小数），无记录返回 None
    """
    query = select(func.avg(AssessmentSession.total_score)).where(
        and_(
            AssessmentSession.user_id == user_id,
            AssessmentSession.kind == kind,
            AssessmentSession.submitted_at.is_not(None),
            AssessmentSession.total_score.is_not(None),
        )
    )
    result = await db.execute(query)
    avg = result.scalar()
    return round(float(avg), 2) if avg else None


# ========================================
# 六、便捷组合查询
# ========================================


async def get_session_with_items(db: AsyncSession, session_id: UUID, user_id: UUID):
    """
    查询会话及其题目（JOIN assessment_items）

    Args:
        db: 数据库会话
        session_id: 会话ID
        user_id: 用户ID（权限校验）

    Returns:
        会话对象（包含 .items 关联）

    Note:
        使用 selectinload 预加载关联，避免 N+1 查询
    """
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(AssessmentSession)
        .options(selectinload(AssessmentSession.items))
        .where(
            and_(
                AssessmentSession.id == session_id, AssessmentSession.user_id == user_id
            )
        )
    )
    return result.scalar_one_or_none()
