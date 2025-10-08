"""Assessment endpoints for delivering questionnaires and grading answers."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List

from app.services.old.questionnaire import load_questionnaire, evaluate_answers

router = APIRouter(prefix="/assessment", tags=["assessment"])


class Question(BaseModel):
    id: str
    question: str
    choices: List[str]


class AnswersIn(BaseModel):
    module_id: str = Field(..., description="课程模块ID")
    answers: Dict[str, str] = Field(..., description="qid -> user's choice")


class ScoreOut(BaseModel):
    score: float
    level: str
    weak_topics: List[str]
    recommendations: List[str]


@router.get("/{module_id}", response_model=List[Question])
async def get_questionnaire(module_id: str):
    """Return questionnaire for a given module."""
    try:
        return load_questionnaire(module_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to load questionnaire") from exc


@router.post("/grade", response_model=ScoreOut)
async def grade_answers(payload: AnswersIn):
    """Evaluate answers and compute user's level."""
    try:
        result = evaluate_answers(payload.module_id, payload.answers)
        return ScoreOut(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to evaluate answers") from exc

