# GPT interaction logic
import os
import json
from functools import lru_cache

# OpenAI v1 SDK
from openai import OpenAI
from typing import Sequence, Mapping, Tuple, List, Any

from app.core.config.config import OPENAI_API_KEY, PROMPT_PATH, OPENAI_MODEL
from app.schemas.old.explain import ExplainOut
import logging

logger = logging.getLogger(__name__)

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set in .env")

client = OpenAI(api_key=OPENAI_API_KEY)

# 读取prompt模板 (JSON格式)
@lru_cache()
def _load_prompt_template() -> dict:
    if not PROMPT_PATH.exists():
        raise RuntimeError(f"Prompt template not found: {PROMPT_PATH}")
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)



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
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_content, ensure_ascii=False)},
        ],
        temperature=0.5,
    )

    return resp.choices[0].message.content.strip()


def generate_assessment_feedback(
    total_score: float, breakdown: Sequence[Mapping[str, Any]]
) -> Tuple[str, List[str]]:
    """
    Generate a summary and suggested actions for an assessment result using OpenAI.
    """
    fallback_summary = (
        f"Your overall score is {total_score:.1f}. Keep practising the areas that scored lower."
    )
    fallback_actions = [
        "Review the weakest topics identified in this assessment.",
        "Schedule focused practice sessions to reinforce understanding.",
    ]

    if not OPENAI_API_KEY:
        return fallback_summary, fallback_actions

    payload = [
        {
            "topic_name": str(item.get("topic_name", "")),
            "score": float(item.get("score", 0.0)),
            "correct": int(item.get("correct", 0)),
            "total": int(item.get("total", 0)),
        }
        for item in breakdown
    ]

    prompt = (
        "You are a governance skills coach.\n"
        f"The learner's overall score is {total_score:.1f} out of 100.\n"
        "Topic breakdown (JSON):\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n\n"
        "Write a short encouragement summary (<= 60 words) and suggest two actionable next steps. "
        "Respond strictly as JSON with keys 'summary' and 'suggested_actions' (array of short strings)."
    )

    try:
        resp = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", OPENAI_MODEL or "gpt-4o"),
            messages=[
                {"role": "system", "content": "You provide concise coaching feedback for assessments."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content.strip()
        data = json.loads(text)
        summary = data.get("summary")
        actions = data.get("suggested_actions")

        if not summary or not isinstance(actions, list):
            raise ValueError("Invalid structure from model")

        actions = [str(action).strip() for action in actions if str(action).strip()]
        if not actions:
            actions = fallback_actions

        return summary.strip(), actions[:5]
    except Exception as exc:
        logger.warning("AI feedback generation failed: %s", exc)
        return fallback_summary, fallback_actions
