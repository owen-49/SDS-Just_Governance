from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from typing import Iterable
import uuid
from app.models import OnboardingSurvey, OnboardingSurveyAnswer, OnboardingSurveyOption
from app.schemas.onboarding import AnswerItem

async def get_user_survey(session: AsyncSession, user_id):
    q = select(OnboardingSurvey).where(OnboardingSurvey.user_id == user_id)
    res = await session.execute(q)
    return res.scalar_one_or_none()

async def create_full_survey(session: AsyncSession, user_id, answers: Iterable[AnswerItem], total_score: int, level: str):
    now = datetime.now(timezone.utc)
    # 显式生成 UUID，避免依赖数据库的 gen_random_uuid() 扩展
    survey = OnboardingSurvey(id=uuid.uuid4(), user_id=user_id, submitted_at=now, total_score=total_score, level=level)
    session.add(survey)
    await session.flush()

    for a in answers:
        ans = OnboardingSurveyAnswer(
            id=uuid.uuid4(),
            survey_id=survey.id,
            question_number=a.question_number,
            question_key=a.question_key,
            question_type=a.question_type,
            answer_value=",".join(a.value) if isinstance(a.value, list) else str(a.value),
            answer_text=a.text,
            answer_score=None,
            created_at=now,
        )
        session.add(ans)
        await session.flush()

        if a.question_type == "multi_choice" and isinstance(a.value, list):
            for v in a.value:
                session.add(OnboardingSurveyOption(id=uuid.uuid4(), answer_id=ans.id, option_value=v, created_at=now))

    return survey
