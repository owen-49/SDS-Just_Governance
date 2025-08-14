# GPT interaction logic
import os
import json
from pathlib import Path
from fastapi import HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# OpenAI v1 SDK
from openai import OpenAI

env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=env_path)  # 读取 .env
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set in .env")

client = OpenAI(api_key=OPENAI_API_KEY)

PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "governance.json"

def _load_prompt_template() -> dict:
    if not PROMPT_PATH.exists():
        raise RuntimeError(f"Prompt template not found: {PROMPT_PATH}")
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

class ExplainOut(BaseModel):
    outline: list[str]
    explanation: str
    checklist: list[str]

async def explain_topic(module_id: str, subtopic: str, known_points: list[str], level: str) -> dict:
    tmpl = _load_prompt_template()
    system_prompt = tmpl.get("system", "")
    style = tmpl.get("style", {})
    guardrails = tmpl.get("guardrails", "")

    user_content = {
        "task": "explain_subtopic",
        "module_id": module_id,
        "subtopic": subtopic,
        "known_points": known_points,
        "level": level,
        "style": style,
        "guardrails": guardrails,
    }

    # Chat Completions 风格（兼容性更好）
    resp = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_content, ensure_ascii=False)},
        ],
        temperature=0.4,
    )

    text = resp.choices[0].message.content.strip()

    # 约定：模型按 JSON 返回（模板中已提示），这里做兜底解析
    try:
        data = json.loads(text)
        return ExplainOut(**{
            "outline": data.get("outline", []),
            "explanation": data.get("explanation", ""),
            "checklist": data.get("checklist", []),
        }).model_dump()
    except Exception:
        # 如果模型没严格按JSON返回，做一个最小降级包装
        return ExplainOut(
            outline=[f"{module_id} / {subtopic}"],
            explanation=text,
            checklist=[],
        ).model_dump()


async def ask_question(question: str, level: str) -> str:
    """Simple question answering based on user level."""
    tmpl = _load_prompt_template()
    system_prompt = tmpl.get("system", "")
    style = tmpl.get("style", {})
    guardrails = tmpl.get("guardrails", "")

    user_content = {
        "task": "answer_question",
        "question": question,
        "level": level,
        "style": style,
        "guardrails": guardrails,
    }

    resp = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_content, ensure_ascii=False)},
        ],
        temperature=0.5,
    )

    return resp.choices[0].message.content.strip()
