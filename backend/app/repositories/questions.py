# backend/app/repositories/questions.py
"""
题库（Questions）数据访问层
负责 questions 和 question_topics 表的查询操作
注意：本模块只做查询，题目的增删改由管理端负责
"""
from __future__ import annotations
from typing import Optional, List, Literal
from uuid import UUID

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import Question, QuestionTopic
from app.schemas.assessment import QuestionDTO


# ========================================
# 一、基础查询（Read）
# ========================================


async def get_question_by_id(
    db: AsyncSession, question_id: UUID, include_inactive: bool = False
) -> Optional[QuestionDTO]:
    """
    根据ID查询题目（含答案，仅后端使用）

    Args:
        db: 数据库会话
        question_id: 题目ID
        include_inactive: 是否包含已停用的题目

    Returns:
        QuestionDTO 对象（含 answer_key），不存在返回 None

    Example:
        >>> question = await get_question_by_id(db, question_id)
        >>> if question:
        ...     print(f"正确答案: {question.answer_key}")
    """
    conditions = [Question.id == question_id]
    if not include_inactive:
        conditions.append(Question.is_active == True)

    result = await db.execute(select(Question).where(and_(*conditions)))
    question = result.scalar_one_or_none()

    if question:
        return QuestionDTO.model_validate(question)
    return None


async def get_questions_by_ids(
    db: AsyncSession, question_ids: List[UUID], include_inactive: bool = False
) -> dict[UUID, QuestionDTO]:
    """
    批量查询题目（避免N+1查询）

    Args:
        db: 数据库会话
        question_ids: 题目ID列表
        include_inactive: 是否包含已停用的题目

    Returns:
        {question_id: QuestionDTO} 字典

    Example:
        >>> ids = [uuid1, uuid2, uuid3]
        >>> questions_map = await get_questions_by_ids(db, ids)
        >>> q1 = questions_map.get(uuid1)
    """
    if not question_ids:
        return {}

    conditions = [Question.id.in_(question_ids)]
    if not include_inactive:
        conditions.append(Question.is_active == True)

    result = await db.execute(select(Question).where(and_(*conditions)))
    questions = result.scalars().all()

    return {q.id: QuestionDTO.model_validate(q) for q in questions}


# ========================================
# 二、按主题查询
# ========================================


async def get_questions_by_topic(
    db: AsyncSession,
    topic_id: UUID,
    qtype: Optional[Literal["single", "multi", "short"]] = None,
    limit: Optional[int] = None,
    include_inactive: bool = False,
) -> List[QuestionDTO]:
    """
    查询某主题的题目

    Args:
        db: 数据库会话
        topic_id: 主题ID
        qtype: 题型过滤（可选）
        limit: 限制数量（可选）
        include_inactive: 是否包含已停用的题目

    Returns:
        题目列表

    Example:
        >>> # 查询主题的所有单选题
        >>> questions = await get_questions_by_topic(
        ...     db, topic_id=topic_id, qtype='single'
        ... )
    """
    # JOIN question_topics
    query = (
        select(Question)
        .join(QuestionTopic, Question.id == QuestionTopic.question_id)
        .where(QuestionTopic.topic_id == topic_id)
    )

    if not include_inactive:
        query = query.where(Question.is_active == True)

    if qtype:
        query = query.where(Question.qtype == qtype)

    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    questions = result.scalars().all()

    return [QuestionDTO.model_validate(q) for q in questions]


async def get_random_questions_by_topic(
    db: AsyncSession,
    topic_id: UUID,
    count: int = 5,
    qtype: Optional[Literal["single", "multi", "short"]] = None,
) -> List[QuestionDTO]:
    """
    随机抽取某主题的题目（用于主题小测）

    Args:
        db: 数据库会话
        topic_id: 主题ID
        count: 抽取数量
        qtype: 题型过滤（可选）

    Returns:
        随机题目列表

    Example:
        >>> # 主题小测：抽5道单选题
        >>> questions = await get_random_questions_by_topic(
        ...     db, topic_id=topic_id, count=5, qtype='single'
        ... )
    """
    query = (
        select(Question)
        .join(QuestionTopic, Question.id == QuestionTopic.question_id)
        .where(and_(QuestionTopic.topic_id == topic_id, Question.is_active == True))
    )

    if qtype:
        query = query.where(Question.qtype == qtype)

    # PostgreSQL 随机排序
    query = query.order_by(func.random()).limit(count)

    result = await db.execute(query)
    questions = result.scalars().all()

    return [QuestionDTO.model_validate(q) for q in questions]


async def count_questions_by_topic(
    db: AsyncSession,
    topic_id: UUID,
    qtype: Optional[Literal["single", "multi", "short"]] = None,
    include_inactive: bool = False,
) -> int:
    """
    统计某主题的题目数量

    Args:
        db: 数据库会话
        topic_id: 主题ID
        qtype: 题型过滤（可选）
        include_inactive: 是否包含已停用的题目

    Returns:
        题目数量

    Example:
        >>> count = await count_questions_by_topic(
        ...     db, topic_id=topic_id, qtype='single'
        ... )
        >>> print(f"该主题有 {count} 道单选题")
    """
    query = (
        select(func.count())
        .select_from(Question)
        .join(QuestionTopic, Question.id == QuestionTopic.question_id)
        .where(QuestionTopic.topic_id == topic_id)
    )

    if not include_inactive:
        query = query.where(Question.is_active == True)

    if qtype:
        query = query.where(Question.qtype == qtype)

    result = await db.execute(query)
    return result.scalar() or 0


# ========================================
# 三、全局随机抽题（整体评测）
# ========================================


async def get_random_questions(
    db: AsyncSession,
    count: int = 20,
    qtype_distribution: Optional[dict[str, int]] = None,
    topic_ids: Optional[List[UUID]] = None,
) -> List[QuestionDTO]:
    """
    全局随机抽题（用于整体评测）

    Args:
        db: 数据库会话
        count: 总题数
        qtype_distribution: 题型分布，如 {"single": 15, "multi": 3, "short": 2}
        topic_ids: 限定主题范围（可选）

    Returns:
        随机题目列表

    Example:
        >>> # 抽20题：15单选+3多选+2简答
        >>> questions = await get_random_questions(
        ...     db, count=20,
        ...     qtype_distribution={"single": 15, "multi": 3, "short": 2}
        ... )
    """
    if qtype_distribution:
        # 按题型分别抽题
        all_questions = []
        for qtype, num in qtype_distribution.items():
            questions = await _get_random_questions_by_type(
                db, qtype=qtype, count=num, topic_ids=topic_ids
            )
            all_questions.extend(questions)

        # 打乱顺序（避免题型集中）
        import random

        random.shuffle(all_questions)
        return all_questions[:count]  # 确保不超过总数

    else:
        # 不区分题型，随机抽取
        return await _get_random_questions_by_type(
            db, qtype=None, count=count, topic_ids=topic_ids
        )


async def _get_random_questions_by_type(
    db: AsyncSession,
    qtype: Optional[str],
    count: int,
    topic_ids: Optional[List[UUID]] = None,
) -> List[QuestionDTO]:
    """
    按题型随机抽题（内部辅助函数）

    Args:
        db: 数据库会话
        qtype: 题型（None表示不限）
        count: 数量
        topic_ids: 限定主题范围（可选）

    Returns:
        题目列表
    """
    conditions = [Question.is_active == True]

    if qtype:
        conditions.append(Question.qtype == qtype)

    query = select(Question).where(and_(*conditions))

    # 如果限定主题范围，需要 JOIN question_topics
    if topic_ids:
        query = (
            query.join(QuestionTopic, Question.id == QuestionTopic.question_id)
            .where(QuestionTopic.topic_id.in_(topic_ids))
            .distinct()  # 去重（一题可能属于多个主题）
        )

    # 随机排序并限制数量
    query = query.order_by(func.random()).limit(count)

    result = await db.execute(query)
    questions = result.scalars().all()

    return [QuestionDTO.model_validate(q) for q in questions]


async def get_balanced_random_questions(
    db: AsyncSession, count: int = 20, topic_weights: Optional[dict[UUID, float]] = None
) -> List[QuestionDTO]:
    """
    按主题权重抽题（确保主题覆盖均衡）

    Args:
        db: 数据库会话
        count: 总题数
        topic_weights: 主题权重，如 {topic1_id: 0.3, topic2_id: 0.5, topic3_id: 0.2}

    Returns:
        题目列表

    Example:
        >>> # 20题，按主题分配：主题A 6题，主题B 10题，主题C 4题
        >>> questions = await get_balanced_random_questions(
        ...     db, count=20,
        ...     topic_weights={
        ...         topic_a_id: 0.3,
        ...         topic_b_id: 0.5,
        ...         topic_c_id: 0.2
        ...     }
        ... )
    """
    if not topic_weights:
        # 无权重，随机抽取
        return await get_random_questions(db, count=count)

    # 按权重分配每个主题的题数
    all_questions = []
    remaining = count

    for topic_id, weight in topic_weights.items():
        # 计算该主题应抽的题数
        topic_count = int(count * weight)
        topic_count = min(topic_count, remaining)  # 不超过剩余数

        if topic_count > 0:
            questions = await get_random_questions_by_topic(
                db, topic_id=topic_id, count=topic_count
            )
            all_questions.extend(questions)
            remaining -= len(questions)

    # 如果题数不足，补充随机题
    if remaining > 0:
        extra_questions = await get_random_questions(
            db, count=remaining, topic_ids=list(topic_weights.keys())
        )
        all_questions.extend(extra_questions)

    # 打乱顺序
    import random

    random.shuffle(all_questions)

    return all_questions[:count]


# ========================================
# 四、统计查询
# ========================================


async def count_total_questions(
    db: AsyncSession, include_inactive: bool = False
) -> int:
    """
    统计题库总题数

    Args:
        db: 数据库会话
        include_inactive: 是否包含已停用的题目

    Returns:
        题目总数
    """
    conditions = []
    if not include_inactive:
        conditions.append(Question.is_active == True)

    query = select(func.count()).select_from(Question)
    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    return result.scalar() or 0


async def get_question_types_distribution(
    db: AsyncSession, topic_id: Optional[UUID] = None, include_inactive: bool = False
) -> dict[str, int]:
    """
    统计题型分布

    Args:
        db: 数据库会话
        topic_id: 限定主题（可选，None表示全局统计）
        include_inactive: 是否包含已停用的题目

    Returns:
        题型分布字典 {"single": 150, "multi": 30, "short": 20}

    Example:
        >>> # 统计全库题型分布
        >>> dist = await get_question_types_distribution(db)
        >>> print(f"单选题: {dist.get('single', 0)}")

        >>> # 统计某主题题型分布
        >>> dist = await get_question_types_distribution(db, topic_id=topic_id)
    """
    query = select(Question.qtype, func.count()).group_by(Question.qtype)

    if topic_id:
        query = query.join(
            QuestionTopic, Question.id == QuestionTopic.question_id
        ).where(QuestionTopic.topic_id == topic_id)

    if not include_inactive:
        query = query.where(Question.is_active == True)

    result = await db.execute(query)
    rows = result.all()

    return {qtype: count for qtype, count in rows}


async def get_topics_coverage(
    db: AsyncSession, question_ids: List[UUID]
) -> dict[UUID, int]:
    """
    统计题目覆盖的主题分布（用于评测分项统计）

    Args:
        db: 数据库会话
        question_ids: 题目ID列表

    Returns:
        {topic_id: 题数} 字典

    Example:
        >>> # 某次评测的题目覆盖了哪些主题
        >>> items = await get_session_items(db, session_id)
        >>> question_ids = [...]  # 从 items 提取
        >>> coverage = await get_topics_coverage(db, question_ids)
        >>> # {topic1_id: 5, topic2_id: 8, topic3_id: 7}
    """
    if not question_ids:
        return {}

    query = (
        select(QuestionTopic.topic_id, func.count())
        .where(QuestionTopic.question_id.in_(question_ids))
        .group_by(QuestionTopic.topic_id)
    )

    result = await db.execute(query)
    rows = result.all()

    return {topic_id: count for topic_id, count in rows}


# ========================================
# 五、题目验证
# ========================================


async def validate_question_exists(db: AsyncSession, question_id: UUID) -> bool:
    """
    验证题目是否存在（且激活）

    Args:
        db: 数据库会话
        question_id: 题目ID

    Returns:
        True 表示存在且激活
    """
    result = await db.execute(
        select(func.count())
        .select_from(Question)
        .where(and_(Question.id == question_id, Question.is_active == True))
    )
    count = result.scalar() or 0
    return count > 0


async def check_topic_has_enough_questions(
    db: AsyncSession, topic_id: UUID, required_count: int, qtype: Optional[str] = None
) -> tuple[bool, int]:
    """
    检查主题是否有足够的题目（用于生成小测前验证）

    Args:
        db: 数据库会话
        topic_id: 主题ID
        required_count: 需要的题数
        qtype: 题型（可选）

    Returns:
        (是否足够, 实际题数) 元组

    Example:
        >>> # 生成小测前检查
        >>> is_enough, actual = await check_topic_has_enough_questions(
        ...     db, topic_id=topic_id, required_count=5
        ... )
        >>> if not is_enough:
        ...     raise BizError(400, BizCode.INVALID_REQUEST,
        ...                    f"insufficient_questions: need {required_count}, has {actual}")
    """
    actual_count = await count_questions_by_topic(
        db, topic_id=topic_id, qtype=qtype, include_inactive=False
    )
    return actual_count >= required_count, actual_count


# ========================================
# 六、答案提取（判分用）
# ========================================


def extract_correct_answer(question: QuestionDTO) -> Optional[str]:
    """
    从 QuestionDTO 提取正确答案（标准化格式）

    Args:
        question: 题目对象

    Returns:
        标准化的正确答案（单选: 'A', 多选: 'A,C', 简答: None）

    Example:
        >>> question = await get_question_by_id(db, question_id)
        >>> correct = extract_correct_answer(question)
        >>> # 单选: 'B'
        >>> # 多选: 'A,C,D'
    """
    if not question.answer_key:
        return None

    answer_key = question.answer_key

    if question.qtype == "single":
        # 假设 answer_key 格式: {"correct": "B"}
        return answer_key.get("correct", "").strip().upper()

    elif question.qtype == "multi":
        # 假设 answer_key 格式: {"correct": ["A", "C", "D"]}
        correct_list = answer_key.get("correct", [])
        if isinstance(correct_list, list):
            sorted_answers = sorted([c.strip().upper() for c in correct_list])
            return ",".join(sorted_answers)
        return None

    else:  # short
        # 简答题需要人工判分或AI判分，这里返回 None
        return None


def get_explanation(question: QuestionDTO) -> Optional[str]:
    """
    获取题目解析

    Args:
        question: 题目对象

    Returns:
        解析文本
    """
    return question.explanation


# ========================================
# 七、调试/管理功能
# ========================================


async def get_questions_without_topics(
    db: AsyncSession, limit: int = 100
) -> List[QuestionDTO]:
    """
    查询未关联任何主题的题目（数据质量检查）

    Args:
        db: 数据库会话
        limit: 限制数量

    Returns:
        孤立题目列表

    Note:
        用于管理端检查数据完整性
    """
    # 左外连接，找出没有关联的题目
    subquery = (
        select(Question.id)
        .outerjoin(QuestionTopic, Question.id == QuestionTopic.question_id)
        .where(QuestionTopic.question_id.is_(None))
        .limit(limit)
    )

    result = await db.execute(select(Question).where(Question.id.in_(subquery)))
    questions = result.scalars().all()

    return [QuestionDTO.model_validate(q) for q in questions]
