from typing import Iterable, Tuple
from app.schemas.onboarding import AnswerItem

SCORE_RULES = {
    "confidence_in_boards": {"very_confident": 3, "somewhat_confident": 2, "not_confident": 1},
    "legal_familiarity": {"very_familiar": 3, "somewhat_familiar": 2, "not_familiar": 1},
    "governance_idea": {"clear_idea": 3, "rough_idea": 2, "not_sure": 1},
}

def calculate_score(answers: Iterable[AnswerItem]) -> Tuple[int, str]:
    pts = []
    for a in answers:
        if a.question_key in SCORE_RULES:
            rule = SCORE_RULES[a.question_key]
            if a.question_type == "single_choice" and isinstance(a.value, str):
                pts.append(rule.get(a.value, 0))
    total = sum(pts)
    avg = total / len(pts) if pts else 0
    if avg >= 2.6:
        level = "strong"
    elif avg >= 1.8:
        level = "developing"
    else:
        level = "new"
    return total, level
