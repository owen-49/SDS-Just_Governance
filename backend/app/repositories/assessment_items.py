# backend/app/repositories/assessment_items.py
"""
评测题目快照（AssessmentItem）数据访问层
负责 assessment_items 表的 CRUD 操作
"""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import AssessmentItem
from app.schemas.assessment import QuestionDTO, QuestionSnapshot


# ========================================
# 一、创建（Create）
# ========================================


async def create_item(
    db: AsyncSession, *, session_id: UUID, order_no: int, question_snapshot: dict
) -> AssessmentItem:
    """
    创建单个题目快照

    Args:
        db: 数据库会话
        session_id: 评测会话ID
        order_no: 题号
        question_snapshot: 题目快照（JSONB格式）

    Returns:
        创建的题目对象

    Example:
        >>> snapshot = {
        ...     "qtype": "single",
        ...     "stem": "What is...",
        ...     "choices": ["A. ...", "B. ...", "C. ...", "D. ..."]
        ... }
        >>> item = await create_item(
        ...     db, session_id=session_id, order_no=1, question_snapshot=snapshot
        ... )
    """
    item = AssessmentItem(
        session_id=session_id, order_no=order_no, question_snapshot=question_snapshot
    )
    db.add(item)
    await db.flush()  # 获取 item.id，但不提交事务
    return item


async def create_items_batch(
    db: AsyncSession, *, session_id: UUID, questions: List[QuestionDTO]
) -> List[AssessmentItem]:
    """
    批量创建题目快照（用于开始评测时）

    Args:
        db: 数据库会话
        session_id: 评测会话ID
        questions: 题目列表（从 questions 表查询得到）

    Returns:
        创建的题目对象列表

    Note:
        - question_snapshot 不包含答案（answer_key），防止泄露
        - 按 order_no 自动编号（1, 2, 3...）

    Example:
        >>> questions = await get_random_questions(db, count=20)
        >>> items = await create_items_batch(
        ...     db, session_id=session_id, questions=questions
        ... )
        >>> len(items)
        20
    """
    items = []

    for idx, question in enumerate(questions, start=1):
        # 构建快照：仅包含前端需要的字段，不含答案
        snapshot = {
            "question_id": str(question.id),
            "qtype": question.qtype,
            "stem": question.stem,
            "choices": question.choices,  # JSONB 格式
            # 注意：不包含 answer_key 和 explanation
        }

        item = AssessmentItem(
            session_id=session_id, order_no=idx, question_snapshot=snapshot
        )
        db.add(item)
        items.append(item)

    await db.flush()
    return items


async def create_items_from_snapshots(
    db: AsyncSession, *, session_id: UUID, snapshots: List[dict]
) -> List[AssessmentItem]:
    """
    从已有快照批量创建题目（用于主题小测提交时）

    Args:
        db: 数据库会话
        session_id: 评测会话ID
        snapshots: 快照列表（来自 user_topic_progress.pending_quiz）

    Returns:
        创建的题目对象列表

    Note:
        主题小测流程：
        1. pending 阶段：题目存在 user_topic_progress.pending_quiz
        2. submit 阶段：创建 session，从 pending_quiz 复制到 assessment_items

    Example:
        >>> # 从 pending_quiz 读取
        >>> pending_quiz = progress.pending_quiz  # [{order_no, snapshot}, ...]
        >>> items = await create_items_from_snapshots(
        ...     db, session_id=session_id, snapshots=pending_quiz
        ... )
    """
    items = []

    for snapshot_data in snapshots:
        item = AssessmentItem(
            session_id=session_id,
            order_no=snapshot_data.get("order_no", 0),
            question_snapshot=snapshot_data.get("snapshot", {}),
        )
        db.add(item)
        items.append(item)

    await db.flush()
    return items


# ========================================
# 二、查询（Read）
# ========================================


async def get_item_by_id(db: AsyncSession, item_id: UUID) -> Optional[AssessmentItem]:
    """
    根据 item_id 查询题目

    Args:
        db: 数据库会话
        item_id: 题目ID

    Returns:
        题目对象，不存在返回 None
    """
    result = await db.execute(
        select(AssessmentItem).where(AssessmentItem.id == item_id)
    )
    return result.scalar_one_or_none()


async def get_session_items(
    db: AsyncSession, session_id: UUID, order_by_no: bool = True
) -> List[AssessmentItem]:
    """
    查询会话的所有题目

    Args:
        db: 数据库会话
        session_id: 会话ID
        order_by_no: 是否按题号排序（默认True）

    Returns:
        题目列表

    Example:
        >>> items = await get_session_items(db, session_id)
        >>> for item in items:
        ...     print(f"题号 {item.order_no}: {item.question_snapshot['stem']}")
    """
    query = select(AssessmentItem).where(AssessmentItem.session_id == session_id)

    if order_by_no:
        query = query.order_by(AssessmentItem.order_no)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_item_by_session_and_order(
    db: AsyncSession, session_id: UUID, order_no: int
) -> Optional[AssessmentItem]:
    """
    根据会话ID和题号查询题目

    Args:
        db: 数据库会话
        session_id: 会话ID
        order_no: 题号

    Returns:
        题目对象，不存在返回 None

    Example:
        >>> # 查询第3题
        >>> item = await get_item_by_session_and_order(
        ...     db, session_id=session_id, order_no=3
        ... )
    """
    result = await db.execute(
        select(AssessmentItem).where(
            and_(
                AssessmentItem.session_id == session_id,
                AssessmentItem.order_no == order_no,
            )
        )
    )
    return result.scalar_one_or_none()


async def verify_item_belongs_to_session(
    db: AsyncSession, item_id: UUID, session_id: UUID
) -> bool:
    """
    验证题目是否属于指定会话（权限检查）

    Args:
        db: 数据库会话
        item_id: 题目ID
        session_id: 会话ID

    Returns:
        True 表示属于该会话

    Example:
        >>> # 在保存答案前验证
        >>> if not await verify_item_belongs_to_session(db, item_id, session_id):
        ...     raise BizError(403, BizCode.FORBIDDEN, "invalid_item")
    """
    result = await db.execute(
        select(func.count())
        .select_from(AssessmentItem)
        .where(
            and_(AssessmentItem.id == item_id, AssessmentItem.session_id == session_id)
        )
    )
    count = result.scalar() or 0
    return count > 0


# ========================================
# 三、统计查询
# ========================================


async def count_session_items(db: AsyncSession, session_id: UUID) -> int:
    """
    统计会话的题目数量

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        题目数量
    """
    result = await db.execute(
        select(func.count())
        .select_from(AssessmentItem)
        .where(AssessmentItem.session_id == session_id)
    )
    return result.scalar() or 0


async def get_session_question_types_distribution(
    db: AsyncSession, session_id: UUID
) -> dict[str, int]:
    """
    统计会话的题型分布

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        题型分布字典 {"single": 15, "multi": 3, "short": 2}

    Example:
        >>> dist = await get_session_question_types_distribution(db, session_id)
        >>> print(f"单选题: {dist.get('single', 0)}")
    """
    items = await get_session_items(db, session_id, order_by_no=False)

    distribution = {}
    for item in items:
        qtype = item.question_snapshot.get("qtype", "unknown")
        distribution[qtype] = distribution.get(qtype, 0) + 1

    return distribution


# ========================================
# 四、更新（Update）
# ========================================
# 注意：assessment_items 通常不需要更新，因为是快照
# 如果需要修正题目内容，应该：
# 1. 在 questions 表修正源数据
# 2. 对于已生成的会话，保持快照不变（保证评测一致性）


# ========================================
# 五、删除（Delete）
# ========================================
# 注意：不直接删除 items，通过级联删除实现：
# 删除 assessment_sessions 时自动删除关联的 items


# ========================================
# 六、辅助转换函数
# ========================================


def snapshot_to_schema(item: AssessmentItem) -> QuestionSnapshot:
    """
    将数据库的 JSONB 快照转换为 Pydantic Schema

    Args:
        item: 题目对象

    Returns:
        QuestionSnapshot 对象

    Example:
        >>> item = await get_item_by_id(db, item_id)
        >>> snapshot = snapshot_to_schema(item)
        >>> snapshot.stem
        'What is corporate governance?'
    """
    return QuestionSnapshot(**item.question_snapshot)


def question_dto_to_snapshot_dict(question: QuestionDTO) -> dict:
    """
    将 QuestionDTO 转换为快照字典（不含答案）

    Args:
        question: 完整题目对象（含答案）

    Returns:
        快照字典（供存储到 JSONB）

    Example:
        >>> question = await get_question_by_id(db, question_id)
        >>> snapshot = question_dto_to_snapshot_dict(question)
        >>> # snapshot 不包含 answer_key
    """
    return {
        "qtype": question.qtype,
        "stem": question.stem,
        "choices": question.choices,
        # 注意：不包含 answer_key、explanation
    }


async def get_items_with_snapshots_as_schema(
    db: AsyncSession, session_id: UUID
) -> List[tuple[AssessmentItem, QuestionSnapshot]]:
    """
    查询题目并转换为 Schema（便于 Service 层使用）

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        [(item, snapshot_schema), ...] 列表

    Example:
        >>> items_with_schemas = await get_items_with_snapshots_as_schema(
        ...     db, session_id
        ... )
        >>> for item, snapshot in items_with_schemas:
        ...     print(f"题 {item.order_no}: {snapshot.stem}")
    """
    items = await get_session_items(db, session_id)
    return [(item, snapshot_to_schema(item)) for item in items]


# ========================================
# 七、批量查询优化
# ========================================


async def get_items_by_ids(
    db: AsyncSession, item_ids: List[UUID]
) -> dict[UUID, AssessmentItem]:
    """
    批量查询题目（避免 N+1 查询）

    Args:
        db: 数据库会话
        item_ids: 题目ID列表

    Returns:
        {item_id: item} 字典

    Example:
        >>> item_ids = [uuid1, uuid2, uuid3]
        >>> items_map = await get_items_by_ids(db, item_ids)
        >>> item1 = items_map.get(uuid1)
    """
    if not item_ids:
        return {}

    result = await db.execute(
        select(AssessmentItem).where(AssessmentItem.id.in_(item_ids))
    )
    items = result.scalars().all()
    return {item.id: item for item in items}


async def get_items_by_session_ids(
    db: AsyncSession, session_ids: List[UUID]
) -> dict[UUID, List[AssessmentItem]]:
    """
    批量查询多个会话的题目（用于历史记录列表）

    Args:
        db: 数据库会话
        session_ids: 会话ID列表

    Returns:
        {session_id: [items]} 字典

    Example:
        >>> # 查询用户的多个历史会话
        >>> sessions = await get_user_history(db, user_id)
        >>> session_ids = [s.id for s in sessions]
        >>> items_map = await get_items_by_session_ids(db, session_ids)
        >>> for session in sessions:
        ...     items = items_map.get(session.id, [])
        ...     print(f"会话 {session.id} 有 {len(items)} 题")
    """
    if not session_ids:
        return {}

    result = await db.execute(
        select(AssessmentItem)
        .where(AssessmentItem.session_id.in_(session_ids))
        .order_by(AssessmentItem.session_id, AssessmentItem.order_no)
    )
    items = result.scalars().all()

    # 按 session_id 分组
    items_map = {}
    for item in items:
        if item.session_id not in items_map:
            items_map[item.session_id] = []
        items_map[item.session_id].append(item)

    return items_map


# ========================================
# 八、数据完整性检查
# ========================================


async def validate_session_items_integrity(
    db: AsyncSession, session_id: UUID
) -> tuple[bool, Optional[str]]:
    """
    检查会话题目的完整性（用于调试/管理端）

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        (is_valid, error_message) 元组

    检查项：
    - 题号是否连续（1, 2, 3...）
    - 是否有重复题号
    - snapshot 是否包含必需字段

    Example:
        >>> is_valid, error = await validate_session_items_integrity(
        ...     db, session_id
        ... )
        >>> if not is_valid:
        ...     logger.warning(f"Session {session_id} integrity issue: {error}")
    """
    items = await get_session_items(db, session_id)

    if not items:
        return False, "No items found"

    # 检查题号连续性
    order_nos = sorted([item.order_no for item in items])
    expected = list(range(1, len(items) + 1))
    if order_nos != expected:
        return False, f"Order numbers not consecutive: {order_nos}"

    # 检查 snapshot 必需字段
    required_fields = {"qtype", "stem"}
    for item in items:
        snapshot = item.question_snapshot
        if not isinstance(snapshot, dict):
            return False, f"Invalid snapshot type for order_no {item.order_no}"

        missing = required_fields - set(snapshot.keys())
        if missing:
            return False, f"Missing fields {missing} in order_no {item.order_no}"

    return True, None
