# backend/app/schemas/assessment.py
"""
测评模块 Pydantic Schemas
包含主题小测和整体评测的所有请求/响应模型
"""
from datetime import datetime
from typing import Optional, List, Literal, Any, Union
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

ChoicePayload = Union[
    List[str],
    List[dict[str, Any]],
    dict[str, Any],
]


# ========================================
# 一、题目相关 Schemas
# ========================================


class QuestionSnapshot(BaseModel):
    """
    题目快照（存储在 assessment_items.question_snapshot）
    """

    qtype: Literal["single", "multi", "short"]
    stem: str = Field(..., description="题干")
    choices: Optional[ChoicePayload] = Field(
        None, description="选项列表（客观题，支持字符串或对象形式）"
    )
    # 注意：不包含 answer_key，防止泄露答案

    model_config = ConfigDict(from_attributes=True)


class QuestionBase(BaseModel):
    """
    题目基础信息（返回给前端做题用）
    """

    item_id: UUID = Field(..., description="题目实例ID（assessment_items.id）")
    order_no: int = Field(..., description="题号")
    snapshot: QuestionSnapshot


class QuestionWithAnswer(QuestionBase):
    """
    题目+正确答案+解析（提交后返回）
    """

    your_answer: Optional[str] = Field(None, description="用户的答案")
    is_correct: Optional[bool] = Field(None, description="是否正确（客观题）")
    correct_answer: Optional[str] = Field(None, description="正确答案")
    explanation: Optional[str] = Field(None, description="解析")
    score: Optional[float] = Field(None, description="得分")


# ========================================
# 二、主题小测 Schemas
# ========================================


class QuizPendingOut(BaseModel):
    """
    GET /topics/{topic_id}/quiz/pending 响应
    """

    topic_id: UUID
    quiz_state: Literal["pending", "completed"]
    questions: List[QuestionBase]


class AnswerItem(BaseModel):
    """
    Payload for a single quiz item answer.
    """

    order_no: Optional[int] = Field(
        None, ge=1, description="Question order number (1-based)"
    )
    item_id: Optional[UUID] = Field(
        None,
        description=(
            "Optional question identifier (same as `question_id` in the pending quiz "
            "snapshot). Used when order is not supplied."
        ),
    )
    answer: str = Field(
        ..., min_length=1, description="Answer value (single: 'A', multi: 'A,C', text)"
    )

    @field_validator("answer")
    @classmethod
    def validate_answer_format(cls, v: str) -> str:
        """Trim whitespace from the answer payload."""
        return v.strip()

    @model_validator(mode="after")
    def ensure_identifier(cls, values: "AnswerItem") -> "AnswerItem":
        if values.order_no is None and values.item_id is None:
            raise ValueError("Either order_no or item_id must be provided.")
        return values


class QuizSubmitIn(BaseModel):
    """
    POST /topics/{topic_id}/quiz/submit 请求体
    """

    answers: List[AnswerItem] = Field(..., min_length=1, description="答案列表")


class QuizSubmitOut(BaseModel):
    """
    POST /topics/{topic_id}/quiz/submit 响应
    """

    session_id: UUID = Field(..., description="评测会话ID")
    total_score: float = Field(..., ge=0, le=100, description="总分（百分制）")
    items: List[QuestionWithAnswer] = Field(..., description="逐题结果")
    can_mark_complete: bool = Field(..., description="是否达到完成标准（≥80%）")
    threshold: float = Field(80.0, description="及格阈值")


# ========================================
# 三、整体评测 - 开始
# ========================================


class AssessmentStartIn(BaseModel):
    """
    POST /assessments/global/start 请求体（可选配置）
    """

    difficulty: Optional[Literal["beginner", "intermediate", "advanced", "mixed"]] = (
        Field("mixed", description="难度策略")
    )
    count: Optional[int] = Field(20, ge=5, le=50, description="题目数量")


class AssessmentProgress(BaseModel):
    """
    评测进度信息
    """

    total: int = Field(..., description="总题数")
    answered: int = Field(..., ge=0, description="已答题数")
    last_question_index: int = Field(..., ge=0, description="最后停留的题号")


class AssessmentStartOut(BaseModel):
    """
    POST /assessments/global/start 响应
    """

    session_id: UUID
    started_at: datetime
    items: List[QuestionBase] = Field(..., description="题目列表（可选择分批返回）")
    progress: AssessmentProgress


# ========================================
# 四、整体评测 - 答题过程
# ========================================


class AnswerSaveIn(BaseModel):
    """
    POST /assessments/{session_id}/answer 请求体
    """

    item_id: UUID = Field(..., description="题目实例ID")
    answer: str = Field(..., min_length=1, description="答案")
    last_question_index: Optional[int] = Field(
        None, ge=0, description="当前题号（用于进度追踪）"
    )

    @field_validator("answer")
    @classmethod
    def validate_answer_format(cls, v: str) -> str:
        return v.strip()


class AnswerSaveOut(BaseModel):
    """
    POST /assessments/{session_id}/answer 响应
    """

    saved: bool = Field(True, description="保存成功标志")
    progress: AssessmentProgress


# ========================================
# 五、整体评测 - 提交
# ========================================


class TopicBreakdown(BaseModel):
    """
    分主题得分统计
    """

    topic_id: UUID
    topic_name: str
    score: float = Field(..., ge=0, le=100, description="该主题得分（百分制）")
    correct: int = Field(..., ge=0, description="答对题数")
    total: int = Field(..., ge=1, description="该主题总题数")


class AIRecommendation(BaseModel):
    """
    AI生成的学习建议
    """

    level: Literal["beginner", "intermediate", "advanced"] = Field(
        ..., description="评估水平"
    )
    focus_topics: List[UUID] = Field(
        default_factory=list, description="需要重点学习的主题ID列表"
    )
    suggested_actions: List[str] = Field(
        default_factory=list, description="建议行动列表"
    )


class AssessmentSubmitOut(BaseModel):
    """
    POST /assessments/{session_id}/submit 响应
    """

    session_id: UUID
    total_score: float = Field(..., ge=0, le=100, description="总分")
    breakdown: List[TopicBreakdown] = Field(
        default_factory=list, description="分主题得分"
    )
    ai_summary: Optional[str] = Field(None, description="AI生成的总结")
    ai_recommendation: Optional[AIRecommendation] = Field(None, description="AI建议")
    submitted_at: datetime


# ========================================
# 六、整体评测 - 历史记录
# ========================================


class AssessmentHistoryItem(BaseModel):
    """
    历史记录单条
    """

    session_id: UUID
    kind: Literal["global", "topic_quiz"]
    started_at: datetime
    submitted_at: Optional[datetime] = None
    total_score: Optional[float] = Field(None, ge=0, le=100)
    question_count: int = Field(..., ge=0, description="题目数量")

    model_config = ConfigDict(from_attributes=True)


class PaginationMeta(BaseModel):
    """
    分页元数据
    """

    page: int = Field(..., ge=1)
    limit: int = Field(..., ge=1, le=50)
    total: int = Field(..., ge=0, description="总条数")
    total_pages: int = Field(..., ge=0, description="总页数")


class AssessmentHistoryOut(BaseModel):
    """
    GET /assessments/history 响应
    """

    items: List[AssessmentHistoryItem]
    pagination: PaginationMeta


# ========================================
# 七、整体评测 - 详情回放
# ========================================


class AssessmentSessionDetail(BaseModel):
    """
    评测会话详情
    """

    session_id: UUID
    kind: Literal["global", "topic_quiz"]
    topic_id: Optional[UUID] = None
    started_at: datetime
    submitted_at: Optional[datetime] = None
    total_score: Optional[float] = Field(None, ge=0, le=100)
    ai_summary: Optional[str] = None
    ai_recommendation: Optional[AIRecommendation] = None

    model_config = ConfigDict(from_attributes=True)


class ItemWithResponse(BaseModel):
    """
    题目+用户答案（用于详情回放）
    """

    order_no: int
    snapshot: QuestionSnapshot
    response: Optional[QuestionWithAnswer] = Field(
        None, description="用户作答记录（未答题时为null）"
    )


class AssessmentDetailOut(BaseModel):
    """
    GET /assessments/{session_id} 响应
    """

    session: AssessmentSessionDetail
    items: List[ItemWithResponse] = Field(..., description="按题号排序的题目+答案")


# ========================================
# 八、内部使用的 DTO (Data Transfer Objects)
# ========================================


class QuestionDTO(BaseModel):
    """
    从 questions 表读取的完整题目（含答案，仅内部使用）
    """

    id: UUID
    qtype: Literal["single", "multi", "short"]
    stem: str
    choices: Optional[ChoicePayload] = None  # JSONB 格式
    answer_key: Optional[dict] = None  # 正确答案
    explanation: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class GradingResult(BaseModel):
    """
    单题判分结果（Service 层内部使用）
    """

    item_id: UUID
    order_no: int
    is_correct: Optional[bool] = None
    score: float = Field(..., ge=0)
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None


# ========================================
# 九、工具函数
# ========================================


def calculate_total_pages(total: int, limit: int) -> int:
    """
    计算总页数

    Args:
        total: 总条数
        limit: 每页条数

    Returns:
        总页数（向上取整）

    Example:
        >>> calculate_total_pages(25, 10)
        3
    """
    if total <= 0 or limit <= 0:
        return 0
    return (total + limit - 1) // limit


def build_pagination_meta(page: int, limit: int, total: int) -> PaginationMeta:
    """
    构建分页元数据

    Example:
        >>> meta = build_pagination_meta(page=1, limit=10, total=45)
        >>> meta.total_pages
        5
    """
    return PaginationMeta(
        page=page,
        limit=limit,
        total=total,
        total_pages=calculate_total_pages(total, limit),
    )


# ========================================
# 十、答案格式化工具
# ========================================


def normalize_single_choice_answer(answer: str) -> str:
    """
    标准化单选答案：去空白、转大写

    Example:
        >>> normalize_single_choice_answer(" b ")
        'B'
    """
    return answer.strip().upper()


def normalize_multi_choice_answer(answer: str) -> str:
    """
    标准化多选答案：去空白、转大写、排序

    Example:
        >>> normalize_multi_choice_answer("C, A, B")
        'A,B,C'
    """
    choices = [c.strip().upper() for c in answer.split(",")]
    return ",".join(sorted(set(choices)))


def format_answer_for_storage(answer: str, qtype: str) -> str:
    """
    根据题型格式化答案

    Args:
        answer: 原始答案
        qtype: 题型 ('single' | 'multi' | 'short')

    Returns:
        格式化后的答案
    """
    if qtype == "single":
        return normalize_single_choice_answer(answer)
    elif qtype == "multi":
        return normalize_multi_choice_answer(answer)
    else:  # short
        return answer.strip()


# ========================================
# 十一、验证函数
# ========================================


def _extract_option_codes(choices: Optional[ChoicePayload]) -> List[str]:
    """
    将不同结构的选项统一提取为大写选项编码（如 A、B、C）
    """
    if not choices:
        return []

    codes: List[str] = []

    if isinstance(choices, dict):
        for key in choices.keys():
            key_str = str(key).strip().upper()
            if key_str:
                codes.append(key_str)
        return codes

    for item in choices:
        if isinstance(item, str):
            candidate = item.strip()
            if candidate:
                codes.append(candidate[0].upper())
        elif isinstance(item, dict):
            if item.get("id"):
                codes.append(str(item["id"]).strip().upper())
            elif item.get("value"):
                codes.append(str(item["value"]).strip().upper())
            elif item.get("label"):
                label = str(item["label"]).strip()
                if label:
                    codes.append(label[0].upper())
    return codes


def validate_answer_format(
    answer: str, qtype: str, choices: Optional[ChoicePayload] = None
) -> bool:
    """
    验证答案格式是否合法

    Args:
        answer: 用户答案
        qtype: 题型
        choices: 选项列表（客观题需要）

    Returns:
        是否合法

    Example:
        >>> validate_answer_format("B", "single", ["A", "B", "C", "D"])
        True
        >>> validate_answer_format("X", "single", ["A", "B", "C", "D"])
        False
        >>> validate_answer_format("A,C", "multi", ["A", "B", "C", "D"])
        True
    """
    if not answer or not answer.strip():
        return False

    option_codes = _extract_option_codes(choices)

    if qtype == "single":
        if not option_codes:
            return False
        normalized = normalize_single_choice_answer(answer)
        valid_options = set(option_codes)
        return normalized in valid_options

    elif qtype == "multi":
        if not option_codes:
            return False
        normalized = normalize_multi_choice_answer(answer)
        valid_options = set(option_codes)
        selected = set(normalized.split(","))
        return selected.issubset(valid_options) and len(selected) > 0

    else:  # short
        return len(answer.strip()) > 0


# ========================================
# 十二、用于 Service 层的辅助模型
# ========================================


class QuizConfig(BaseModel):
    """
    主题小测配置
    """

    question_count: int = Field(5, ge=3, le=20, description="题目数量")
    pass_threshold: float = Field(0.80, ge=0, le=1.0, description="及格阈值")
    include_difficulty: Optional[List[str]] = Field(None, description="包含的难度级别")


class GlobalAssessmentConfig(BaseModel):
    """
    整体评测配置
    """

    question_count: int = Field(20, ge=10, le=50)
    difficulty_distribution: dict[str, float] = Field(
        default_factory=lambda: {"beginner": 0.3, "intermediate": 0.4, "advanced": 0.3},
        description="难度分布权重",
    )
    topic_coverage: Optional[List[UUID]] = Field(
        None, description="覆盖的主题ID列表（None表示全部）"
    )
