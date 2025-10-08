from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.db import get_db
from app.deps.auth import get_current_user

from app.schemas.api_response import ApiResponse, ok, fail

from app.schemas.onboarding import SubmitPayload, SubmitResult
from app.services.old.onboarding import calculate_score
from app.repositories.onboarding import get_user_survey, create_full_survey

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])

# backend/app/api/routes/onboarding.py

SURVEY_DEFINITION = {
    "version": 1,
    "title": "Just Governance Onboarding Survey",
    "locale": "en-AU",
    "questions": [
        {
            "number": 1,
            "key": "confidence_in_boards",
            "text": "How confident do you feel in knowing what boards do?",
            "type": "single_choice",
            "options": [
                {"label": "Not at all confident", "value": "not_confident"},
                {"label": "Somewhat confident", "value": "somewhat_confident"},
                {"label": "Very confident", "value": "very_confident"},
            ],
        },
        {
            "number": 2,
            "key": "familiar_terms",
            "text": "Which of these terms are you familiar with?",
            "type": "multi_choice",
            "options": [
                {"label": "Incorporated bodies", "value": "incorporated_bodies"},
                {"label": "Companies", "value": "companies"},
                {"label": "Not for profits", "value": "not_for_profits"},
                {"label": "Community organisations", "value": "community_orgs"},
                {"label": "Social enterprises", "value": "social_enterprises"},
            ],
        },
        {
            "number": 3,
            "key": "interest_motivation",
            "text": "What interests you most about learning what boards do? (choose up to 2)",
            "type": "multi_choice",
            "max_select": 2,
            "options": [
                {"label": "Making a difference on an issue I care about", "value": "impact"},
                {"label": "Getting a board role", "value": "get_board_role"},
                {"label": "Learning new skills", "value": "learn_new_skills"},
                {"label": "Understanding how key decisions get made", "value": "understand_decisions"},
                {"label": "Meeting people and building networks", "value": "meet_and_network"},
                {"label": "Furthering my career", "value": "further_career"},
                {"label": "Other", "value": "other", "has_text_input": True},
            ],
        },
        {
            "number": 4,
            "key": "legal_familiarity",
            "text": "How familiar are you with Australia’s legal system, including the difference between legislation and case law?",
            "type": "single_choice",
            "options": [
                {"label": "Not familiar at all", "value": "not_familiar"},
                {"label": "Somewhat familiar", "value": "somewhat_familiar"},
                {"label": "Very familiar", "value": "very_familiar"},
            ],
        },
        {
            "number": 5,
            "key": "governance_idea",
            "text": "When you hear the word 'governance', what comes to mind?",
            "type": "single_choice",
            "options": [
                {"label": "Not sure yet", "value": "not_sure"},
                {"label": "A rough idea", "value": "rough_idea"},
                {"label": "Clear idea", "value": "clear_idea"},
            ],
        },
        {
            "number": 6,
            "key": "decision_experience",
            "text": "Have you ever been part of a group responsible for making decisions for other people?",
            "type": "single_choice",
            "options": [
                {"label": "No, never", "value": "never"},
                {"label": "Yes, a few times", "value": "few_times"},
                {"label": "Yes, often", "value": "often"},
            ],
        },
        {
            "number": 7,
            "key": "interest_areas",
            "text": "Which areas interest you most?",
            "type": "multi_choice",
            "options": [
                {"label": "Community and social justice", "value": "social_justice"},
                {"label": "Sport and recreation", "value": "sport"},
                {"label": "Arts and culture", "value": "arts"},
                {"label": "Health", "value": "health"},
                {"label": "Housing and homelessness", "value": "housing"},
                {"label": "Gender", "value": "gender"},
                {"label": "Women’s safety", "value": "womens_safety"},
                {"label": "Environment", "value": "environment"},
                {"label": "Other", "value": "other", "has_text_input": True},
            ],
        },
        {
            "number": 8,
            "key": "financial_experience",
            "text": "Have you ever read basic financial documents (like budgets, annual reports or profit and loss statements)?",
            "type": "single_choice",
            "options": [
                {"label": "Never", "value": "never"},
                {"label": "Occasionally", "value": "occasionally"},
                {"label": "Often", "value": "often"},
            ],
        },
        {
            "number": 9,
            "key": "new_terms",
            "text": "Which of these words are new to you?",
            "type": "multi_choice",
            "options": [
                {"label": "Constitution", "value": "constitution"},
                {"label": "Director", "value": "director"},
                {"label": "Nominee", "value": "nominee"},
                {"label": "Conflict of interest", "value": "conflict_of_interest"},
                {"label": "Agenda", "value": "agenda"},
                {"label": "Minutes", "value": "minutes"},
                {"label": "Fiduciary duties", "value": "fiduciary_duties"},
            ],
        },
        {
            "number": 10,
            "key": "group_comfort",
            "text": "How comfortable do you feel speaking up in a group?",
            "type": "single_choice",
            "options": [
                {"label": "Very comfortable", "value": "very_comfortable"},
                {"label": "Sometimes comfortable", "value": "sometimes_comfortable"},
                {"label": "Not very comfortable", "value": "not_very_comfortable"},
                {"label": "Not sure", "value": "not_sure"},
            ],
        },
        {
            "number": 11,
            "key": "learning_interest",
            "text": "Which of these do you most want to learn more about? (choose up to 2)",
            "type": "multi_choice",
            "max_select": 2,
            "options": [
                {"label": "What boards actually do", "value": "what_boards_do"},
                {"label": "How board decisions are made", "value": "decision_process"},
                {"label": "The legal duties and responsibilities of board members", "value": "legal_duties"},
                {"label": "How to get on a board", "value": "join_board"},
                {"label": "The different types of boards in Australia", "value": "board_types"},
                {"label": "When a board is needed and how to set one up", "value": "setup_board"},
                {"label": "Something else", "value": "other", "has_text_input": True},
            ],
        },
        {
            "number": 12,
            "key": "training_barriers",
            "text": "Is there anything that might make it difficult for you to fully take part in this training?",
            "type": "multi_choice",
            "options": [
                {"label": "Confidence or feeling unsure about what I know and don’t know", "value": "confidence"},
                {"label": "Time or family commitments", "value": "time_commitments"},
                {"label": "Access to internet or computer", "value": "internet_access"},
                {"label": "Accessibility needs (please share)", "value": "accessibility_needs", "has_text_input": True},
                {"label": "Other", "value": "other", "has_text_input": True},
                {"label": "Nothing comes to mind", "value": "none"},
            ],
        },
    ],
}

@router.get("/survey")
async def get_survey(request:Request):
    return ok(data=SURVEY_DEFINITION, request=request)

@router.post("/survey/submit")
async def submit_survey(payload: SubmitPayload,
                        session: AsyncSession = Depends(get_db),
                        user=Depends(get_current_user),
                        request:Request=None):
    existed = await get_user_survey(session, user.id)
    if existed:
        return fail(http_status=status.HTTP_409_CONFLICT,
                    code=4001, message="already_submitted",
                    request=request)

    total, level = calculate_score(payload.answers)
    async with session.begin():
        await create_full_survey(session, user.id, payload.answers, total, level)

    return ok(data=SubmitResult(score=total, level=level).model_dump(), request=request)

@router.get("/survey/result")
async def get_my_result(session: AsyncSession = Depends(get_db),
                        user=Depends(get_current_user),
                        request=None):
    rec = await get_user_survey(session, user.id)
    if not rec:
        return fail(http_status=status.HTTP_404_NOT_FOUND,
                    code=3001, message="not_found",
                    request=request)
    data = {
        "submitted_at": rec.submitted_at.isoformat(),
        "score": rec.total_score,
        "level": rec.level,
    }
    return ok(data=data, request=request)