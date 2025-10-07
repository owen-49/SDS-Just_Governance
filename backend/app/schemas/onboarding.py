from pydantic import BaseModel, conlist
from typing import Any, List, Optional, Literal
from typing import Annotated
from pydantic import Field


QuestionType = Literal["single_choice", "multi_choice", "text", "rating"]

class AnswerItem(BaseModel):
    question_number: int
    question_key: str
    question_type: QuestionType
    value: Any
    text: Optional[str] = None

class SubmitPayload(BaseModel):
    answers: Annotated[list[AnswerItem], Field(min_length=1)]

class SubmitResult(BaseModel):
    score: int
    level: Literal["new", "developing", "strong"]
