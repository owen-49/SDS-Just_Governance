# backend/app/repositories/assessment_responses.py
"""
评测答题记录（AssessmentResponse）数据访问层
负责 assessment_responses 表的 CRUD 操作
"""
from __future__ import annotations
from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, update, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import AssessmentResponse


# ========================================
# 一、创建（Create）
# ========================================


async def create_response(
    db: AsyncSession,
    *,
    session_id: UUID,
    item_id: UUID,
    answer: str,
    is_correct: Optional[bool] = None,
    score: Optional[float] = None,
) -> AssessmentResponse:
    """
    创建答题记录

    Args:
        db: 数据库会话
        session_id: 评测会话ID
        item_id: 题目实例ID
        answer: 用户答案（标准化格式）
        is_correct: 是否正确（客观题）
        score: 得分

    Returns:
        创建的答题记录对象

    Example:
        >>> response = await create_response(
        ...     db,
        ...     session_id=session_id,
        ...     item_id=item_id,
        ...     answer="B",
        ...     is_correct=True,
        ...     score=1.0
        ... )
    """
    response = AssessmentResponse(
        session_id=session_id,
        item_id=item_id,
        answer=answer,
        is_correct=is_correct,
        score=score,
    )
    db.add(response)
    await db.flush()
    return response


async def create_responses_batch(
    db: AsyncSession,
    *,
    session_id: UUID,
    responses_data: List[dict],
) -> List[AssessmentResponse]:
    """
    批量创建答题记录（用于提交评测时）

    Args:
        db: 数据库会话
        session_id: 评测会话ID
        responses_data: 答题数据列表
            [
                {
                    "item_id": UUID,
                    "answer": "B",
                    "is_correct": True,
                    "score": 1.0
                },
                ...
            ]

    Returns:
        创建的答题记录列表

    Example:
        >>> responses = await create_responses_batch(
        ...     db,
        ...     session_id=session_id,
        ...     responses_data=[
        ...         {"item_id": item1_id, "answer": "B", "is_correct": True, "score": 1.0},
        ...         {"item_id": item2_id, "answer": "A,C", "is_correct": False, "score": 0.5},
        ...     ]
        ... )
    """
    responses = []
    for data in responses_data:
        response = AssessmentResponse(
            session_id=session_id,
            item_id=data["item_id"],
            answer=data["answer"],
            is_correct=data.get("is_correct"),
            score=data.get("score"),
        )
        db.add(response)
        responses.append(response)

    await db.flush()
    return responses


# ========================================
# 二、查询（Read）
# ========================================


async def get_response_by_id(
    db: AsyncSession, response_id: UUID
) -> Optional[AssessmentResponse]:
    """
    根据ID查询答题记录

    Args:
        db: 数据库会话
        response_id: 答题记录ID

    Returns:
        答题记录对象，不存在返回 None
    """
    result = await db.execute(
        select(AssessmentResponse).where(AssessmentResponse.id == response_id)
    )
    return result.scalar_one_or_none()


async def get_response_by_item(
    db: AsyncSession, item_id: UUID
) -> Optional[AssessmentResponse]:
    """
    根据题目实例ID查询答题记录

    Args:
        db: 数据库会话
        item_id: 题目实例ID

    Returns:
        答题记录对象，不存在返回 None

    Note:
        item_id 有唯一约束，一题只能有一条答题记录

    Example:
        >>> # 检查用户是否已答该题
        >>> response = await get_response_by_item(db, item_id)
        >>> if response:
        ...     print(f"已答: {response.answer}")
    """
    result = await db.execute(
        select(AssessmentResponse).where(AssessmentResponse.item_id == item_id)
    )
    return result.scalar_one_or_none()


async def get_session_responses(
    db: AsyncSession, session_id: UUID, order_by_item: bool = True
) -> List[AssessmentResponse]:
    """
    查询会话的所有答题记录

    Args:
        db: 数据库会话
        session_id: 会话ID
        order_by_item: 是否按题号排序（默认True）

    Returns:
        答题记录列表

    Example:
        >>> responses = await get_session_responses(db, session_id)
        >>> for resp in responses:
        ...     print(f"题 {resp.item.order_no}: {resp.answer}")
    """
    query = select(AssessmentResponse).where(
        AssessmentResponse.session_id == session_id
    )

    if order_by_item:
        # JOIN assessment_items 按 order_no 排序
        from app.models.assessment import AssessmentItem

        query = query.join(
            AssessmentItem, AssessmentResponse.item_id == AssessmentItem.id
        ).order_by(AssessmentItem.order_no)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_responses_by_items(
    db: AsyncSession, item_ids: List[UUID]
) -> dict[UUID, AssessmentResponse]:
    """
    批量查询答题记录（避免N+1查询）

    Args:
        db: 数据库会话
        item_ids: 题目实例ID列表

    Returns:
        {item_id: response} 字典

    Example:
        >>> item_ids = [uuid1, uuid2, uuid3]
        >>> responses_map = await get_responses_by_items(db, item_ids)
        >>> resp1 = responses_map.get(uuid1)
    """
    if not item_ids:
        return {}

    result = await db.execute(
        select(AssessmentResponse).where(AssessmentResponse.item_id.in_(item_ids))
    )
    responses = result.scalars().all()

    return {resp.item_id: resp for resp in responses}


# ========================================
# 三、更新（Update）
# ========================================


async def update_response_answer(
    db: AsyncSession,
    item_id: UUID,
    answer: str,
    is_correct: Optional[bool] = None,
    score: Optional[float] = None,
) -> int:
    """
    更新答题记录（用于改答案场景）

    Args:
        db: 数据库会话
        item_id: 题目实例ID
        answer: 新答案
        is_correct: 是否正确（可选）
        score: 得分（可选）

    Returns:
        受影响的行数（应为1）

    Example:
        >>> # 用户修改答案
        >>> await update_response_answer(
        ...     db, item_id=item_id, answer="C", is_correct=False, score=0.0
        ... )
    """
    values = {"answer": answer}
    if is_correct is not None:
        values["is_correct"] = is_correct
    if score is not None:
        values["score"] = score

    stmt = (
        update(AssessmentResponse)
        .where(AssessmentResponse.item_id == item_id)
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    result = await db.execute(stmt)
    return result.rowcount or 0


async def upsert_response(
    db: AsyncSession,
    *,
    session_id: UUID,
    item_id: UUID,
    answer: str,
    is_correct: Optional[bool] = None,
    score: Optional[float] = None,
) -> AssessmentResponse:
    """
    创建或更新答题记录（自动保存场景）

    Args:
        db: 数据库会话
        session_id: 会话ID
        item_id: 题目实例ID
        answer: 答案
        is_correct: 是否正确（可选）
        score: 得分（可选）

    Returns:
        答题记录对象

    Note:
        如果已存在，则更新；否则创建

    Example:
        >>> # 自动保存：不用判断是否存在，直接upsert
        >>> response = await upsert_response(
        ...     db, session_id=session_id, item_id=item_id, answer="B"
        ... )
    """
    existing = await get_response_by_item(db, item_id)

    if existing:
        # 更新
        existing.answer = answer
        if is_correct is not None:
            existing.is_correct = is_correct
        if score is not None:
            existing.score = score
        await db.flush()
        return existing
    else:
        # 创建
        return await create_response(
            db,
            session_id=session_id,
            item_id=item_id,
            answer=answer,
            is_correct=is_correct,
            score=score,
        )


async def batch_update_scores(db: AsyncSession, item_scores: dict[UUID, dict]) -> int:
    """
    批量更新答题记录的判分结果（用于提交后统一判分）

    Args:
        db: 数据库会话
        item_scores: {item_id: {"is_correct": bool, "score": float}}

    Returns:
        受影响的行数

    Example:
        >>> # 批量判分后更新
        >>> scores = {
        ...     item1_id: {"is_correct": True, "score": 1.0},
        ...     item2_id: {"is_correct": False, "score": 0.5},
        ... }
        >>> await batch_update_scores(db, scores)
    """
    if not item_scores:
        return 0

    count = 0
    for item_id, score_data in item_scores.items():
        stmt = (
            update(AssessmentResponse)
            .where(AssessmentResponse.item_id == item_id)
            .values(
                is_correct=score_data.get("is_correct"),
                score=score_data.get("score"),
            )
            .execution_options(synchronize_session=False)
        )
        result = await db.execute(stmt)
        count += result.rowcount or 0

    return count


# ========================================
# 四、删除（Delete）
# ========================================
# 注意：不直接删除 responses，通过级联删除实现：
# 删除 assessment_sessions 时自动删除关联的 responses


# ========================================
# 五、统计查询（Statistics）
# ========================================


async def count_session_responses(db: AsyncSession, session_id: UUID) -> int:
    """
    统计会话的答题数量

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        答题数量

    Example:
        >>> answered = await count_session_responses(db, session_id)
        >>> print(f"已答 {answered} 题")
    """
    result = await db.execute(
        select(func.count())
        .select_from(AssessmentResponse)
        .where(AssessmentResponse.session_id == session_id)
    )
    return result.scalar() or 0


async def calculate_session_total_score(db: AsyncSession, session_id: UUID) -> float:
    """
    计算会话的总分

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        总分（保留2位小数）

    Note:
        只统计已判分的题目（score IS NOT NULL）

    Example:
        >>> total = await calculate_session_total_score(db, session_id)
        >>> print(f"总分: {total}")
    """
    result = await db.execute(
        select(func.sum(AssessmentResponse.score)).where(
            and_(
                AssessmentResponse.session_id == session_id,
                AssessmentResponse.score.is_not(None),
            )
        )
    )
    total = result.scalar() or 0.0
    return round(float(total), 2)


async def get_session_correct_count(db: AsyncSession, session_id: UUID) -> int:
    """
    统计会话的答对题数

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        答对题数

    Example:
        >>> correct = await get_session_correct_count(db, session_id)
        >>> total = await count_session_responses(db, session_id)
        >>> print(f"正确率: {correct}/{total}")
    """
    result = await db.execute(
        select(func.count())
        .select_from(AssessmentResponse)
        .where(
            and_(
                AssessmentResponse.session_id == session_id,
                AssessmentResponse.is_correct == True,
            )
        )
    )
    return result.scalar() or 0


async def get_responses_by_correctness(
    db: AsyncSession, session_id: UUID, is_correct: bool
) -> List[AssessmentResponse]:
    """
    查询会话中答对/答错的题目

    Args:
        db: 数据库会话
        session_id: 会话ID
        is_correct: True=答对的题，False=答错的题

    Returns:
        答题记录列表

    Example:
        >>> # 查询所有答错的题
        >>> wrong_responses = await get_responses_by_correctness(
        ...     db, session_id, is_correct=False
        ... )
    """
    result = await db.execute(
        select(AssessmentResponse).where(
            and_(
                AssessmentResponse.session_id == session_id,
                AssessmentResponse.is_correct == is_correct,
            )
        )
    )
    return list(result.scalars().all())


# ========================================
# 六、校验函数
# ========================================


async def verify_response_belongs_to_session(
    db: AsyncSession, item_id: UUID, session_id: UUID
) -> bool:
    """
    验证答题记录是否属于指定会话（权限检查）

    Args:
        db: 数据库会话
        item_id: 题目实例ID
        session_id: 会话ID

    Returns:
        True 表示属于该会话

    Example:
        >>> # 保存答案前验证
        >>> if not await verify_response_belongs_to_session(db, item_id, session_id):
        ...     raise BizError(403, BizCode.FORBIDDEN, "invalid_item")
    """
    result = await db.execute(
        select(func.count())
        .select_from(AssessmentResponse)
        .where(
            and_(
                AssessmentResponse.item_id == item_id,
                AssessmentResponse.session_id == session_id,
            )
        )
    )
    count = result.scalar() or 0
    return count > 0


async def check_all_items_answered(
    db: AsyncSession, session_id: UUID, total_items: int
) -> tuple[bool, int]:
    """
    检查会话是否所有题目都已答

    Args:
        db: 数据库会话
        session_id: 会话ID
        total_items: 总题数

    Returns:
        (是否全部已答, 已答题数) 元组

    Example:
        >>> is_complete, answered = await check_all_items_answered(
        ...     db, session_id, total_items=20
        ... )
        >>> if not is_complete:
        ...     raise BizError(422, BizCode.VALIDATION_ERROR,
        ...                    f"unanswered_questions: {total_items - answered}")
    """
    answered = await count_session_responses(db, session_id)
    return answered >= total_items, answered


# ========================================
# 七、高级查询（带关联）
# ========================================


async def get_responses_with_items(
    db: AsyncSession, session_id: UUID
) -> List[tuple[AssessmentResponse, dict]]:
    """
    查询答题记录并带上题目快照（用于详情回放）

    Args:
        db: 数据库会话
        session_id: 会话ID

    Returns:
        [(response, item_snapshot)] 列表

    Note:
        使用 joinedload 预加载关联，避免 N+1 查询

    Example:
        >>> results = await get_responses_with_items(db, session_id)
        >>> for response, snapshot in results:
        ...     print(f"题 {snapshot['order_no']}: 答案={response.answer}")
    """
    from sqlalchemy.orm import joinedload
    from app.models.assessment import AssessmentItem

    result = await db.execute(
        select(AssessmentResponse)
        .options(joinedload(AssessmentResponse.item))
        .where(AssessmentResponse.session_id == session_id)
        .join(AssessmentItem, AssessmentResponse.item_id == AssessmentItem.id)
        .order_by(AssessmentItem.order_no)
    )
    responses = result.unique().scalars().all()

    return [(resp, resp.item.question_snapshot) for resp in responses if resp.item]
