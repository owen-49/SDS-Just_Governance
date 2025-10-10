import os
import unittest
import uuid

from decimal import Decimal

os.environ.setdefault("DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///:memory:")

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.models import (  # noqa: E402
    AssessmentItem,
    Base,
    Board,
    Module,
    Question,
    QuestionTopic,
    Topic,
    User,
    UserTopicProgress,
)
from app.services.topic_quiz import TopicQuizService  # noqa: E402


class TopicQuizServiceTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.SessionLocal = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        self.user = User(id=uuid.uuid4(), email="quiz@example.com", is_active=True, name="Quizzer")
        self.board = Board(id=uuid.uuid4(), name="Foundations", sort_order=1)
        self.module = Module(id=uuid.uuid4(), board_id=self.board.id, name="Module", sort_order=1)
        self.topic = Topic(
            id=uuid.uuid4(),
            module_id=self.module.id,
            name="Trust",
            pass_threshold=Decimal("0.70"),
            sort_order=1,
            is_active=True,
        )

        choices = [
            {"id": "A", "label": "Share context"},
            {"id": "B", "label": "Hide decisions"},
            {"id": "C", "label": "Delay"},
        ]
        self.questions = [
            Question(id=uuid.uuid4(), qtype="single", stem="First step?", choices=choices, answer_key={"correct_options": ["A"]}),
            Question(id=uuid.uuid4(), qtype="single", stem="Worst action?", choices=choices, answer_key={"correct_options": ["B"]}),
            Question(id=uuid.uuid4(), qtype="single", stem="Best habit?", choices=choices, answer_key={"correct_options": ["A"]}),
        ]
        self.question_topics = [QuestionTopic(question_id=q.id, topic_id=self.topic.id) for q in self.questions]

        async with self.SessionLocal() as session:
            session.add_all([self.user, self.board, self.module, self.topic, *self.questions, *self.question_topics])
            await session.commit()

        self.service = TopicQuizService()

    async def asyncTearDown(self) -> None:
        await self.engine.dispose()

    async def test_quiz_flow_updates_progress(self) -> None:
        async with self.SessionLocal() as session:
            quiz_session, quiz_questions = await self.service.start_quiz(session, user=self.user, topic_id=self.topic.id)
            self.assertEqual(len(quiz_questions), 3)
            await session.commit()

        async with self.SessionLocal() as session:
            result = await session.execute(
                select(AssessmentItem).where(AssessmentItem.session_id == quiz_session.id)
            )
            items = result.scalars().all()
            answers = {str(item.id): "A" for item in items}

        async with self.SessionLocal() as session:
            summary = await self.service.submit(
                session,
                user=self.user,
                topic_id=self.topic.id,
                session_id=quiz_session.id,
                answers=answers,
            )
            await session.commit()

        self.assertGreaterEqual(summary.score, 0)
        self.assertEqual(summary.total_questions, 3)

        async with self.SessionLocal() as session:
            progress = await session.get(UserTopicProgress, (self.user.id, self.topic.id))
            assert progress is not None
            self.assertEqual(progress.quiz_state, "completed")
            self.assertAlmostEqual(float(progress.best_score or 0), summary.score, places=4)


if __name__ == "__main__":
    unittest.main()
