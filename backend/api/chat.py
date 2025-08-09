from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.gpt_call import explain_topic

router = APIRouter(tags=["ai"])

class ExplainIn(BaseModel):
    module_id: str = Field(..., description="课程模块ID，如 governance_basics")
    subtopic: str = Field(..., description="子主题，如 board_roles")
    known_points: list[str] = Field(default_factory=list, description="学员已知要点（可空）")
    level: str = Field(default="beginner", description="难度：beginner/intermediate/advanced")

class ExplainOut(BaseModel):
    outline: list[str]
    explanation: str
    checklist: list[str]

@router.post("/explain", response_model=ExplainOut)
async def ai_explain(payload: ExplainIn):
    try:
        res = await explain_topic(
            module_id=payload.module_id,
            subtopic=payload.subtopic,
            known_points=payload.known_points,
            level=payload.level,
        )
        return res
    except HTTPException:
        raise
    except Exception as e:
        # 不泄露内部错误
        raise HTTPException(status_code=500, detail="AI service error") from e
