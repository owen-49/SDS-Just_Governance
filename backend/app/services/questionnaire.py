"""Questionnaire loading and assessment utilities."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Dict, List

from fastapi import HTTPException
from core.config import QUESTION_PATH


# Path to questionnaire definitions

@lru_cache()
def _load_all() -> Dict[str, List[Dict[str, object]]]:
    # Load the questionnaire JSON data.
    if not QUESTION_PATH.exists():
        raise HTTPException(status_code=500, detail="Questionnaire definitions not found")
    with QUESTION_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_questionnaire(module_id: str) -> List[Dict[str, object]]:
    """Return questionnaire for a module without exposing answers."""
    data = _load_all()
    if module_id not in data:
        raise HTTPException(status_code=404, detail="Module not found")
    # Strip answers before returning to client
    questions = []
    for q in data[module_id]:
        q_copy = {k: v for k, v in q.items() if k != "answer"}
        questions.append(q_copy)
    return questions


def evaluate_answers(module_id: str, answers: Dict[str, str]) -> Dict[str, object]:
    """Evaluate user's answers and assign a level."""
    data = _load_all()
    if module_id not in data:
        raise HTTPException(status_code=404, detail="Module not found")

    questions = data[module_id]
    total = len(questions)
    correct = 0
    weak_topics = []

    # Index questions by id for quick lookup
    q_map = {q["id"]: q for q in questions}

    for qid, user_answer in answers.items():
        q = q_map.get(qid)
        if not q:
            continue
        if user_answer.strip().upper() == q["answer"].strip().upper():
            correct += 1
        else:
            weak_topics.append(q.get("topic", qid))

    score = (correct / total) * 100 if total else 0
    if score >= 70:
        level = "advanced"
    elif score >= 40:
        level = "intermediate"
    else:
        level = "beginner"

    recommendations = [f"Review topic: {t}" for t in weak_topics]

    return {
        "score": round(score, 2),
        "level": level,
        "weak_topics": weak_topics,
        "recommendations": recommendations,
    }

