from pydantic import BaseModel


class ExplainOut(BaseModel):
    outline: list[str]
    explanation: str
    checklist: list[str]