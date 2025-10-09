import os
import uuid
from decimal import Decimal
import unittest

# Ensure models pick up SQLite-friendly UUID defaults before importing them
os.environ.setdefault("DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///:memory:")

from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.main import app  # noqa: E402
from app.core.db import db as db_module  # noqa: E402
from app.core.db.db import get_db  # noqa: E402
from app.deps.auth import get_current_user  # noqa: E402
from app.models import (  # noqa: E402
    Base,
    Board,
    Module,
    Topic,
    TopicContent,
    User,
    UserTopicProgress,
)


class LearningTopicFlowTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
        self.SessionLocal = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)

        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        self._orig_engine = db_module.engine
        self._orig_sessionmaker = db_module.AsyncSessionLocal
        db_module.engine = self.engine
        db_module.AsyncSessionLocal = self.SessionLocal

        self._orig_overrides = dict(app.dependency_overrides)

        async with self.SessionLocal() as session:
            self.user = User(
                id=uuid.uuid4(),
                email="learner@example.com",
                is_active=True,
                name="Learner",
            )
            board = Board(id=uuid.uuid4(), name="Foundations", sort_order=1)
            module = Module(id=uuid.uuid4(), board_id=board.id, name="Governance 101", sort_order=1)
            topic = Topic(
                id=uuid.uuid4(),
                module_id=module.id,
                name="Building Trust",
                pass_threshold=Decimal("0.80"),
                sort_order=1,
                is_active=True,
            )
            topic_extra = Topic(
                id=uuid.uuid4(),
                module_id=module.id,
                name="Engagement Basics",
                pass_threshold=Decimal("0.60"),
                sort_order=2,
                is_active=True,
            )
            topic_content = TopicContent(
                topic_id=topic.id,
                body_markdown="# Welcome to the topic",
                summary="Learn how to build durable trust with stakeholders.",
                resources={
                    "Toolkit": "https://example.com/toolkit",
                    "Checklist": {"url": "https://example.com/checklist", "title": "Readiness Checklist"},
                },
            )
            progress = UserTopicProgress(
                user_id=self.user.id,
                topic_id=topic.id,
                progress_status="in_progress",
                best_score=Decimal("0.90"),
                last_score=Decimal("0.82"),
            )

            session.add_all([self.user, board, module, topic, topic_extra, topic_content, progress])
            await session.commit()

            self.board_id = str(board.id)
            self.module_id = str(module.id)
            self.topic_id = str(topic.id)
            self.topic_extra_id = str(topic_extra.id)

        async def override_get_db():
            async with self.SessionLocal() as session:
                yield session

        async def override_get_current_user():
            return self.user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user

        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self._orig_overrides)
        db_module.AsyncSessionLocal = self._orig_sessionmaker
        db_module.engine = self._orig_engine
        await self.engine.dispose()

    async def test_structure_endpoints_return_topic_tree(self) -> None:
        boards_resp = await self.client.get("/api/v1/boards")
        self.assertEqual(boards_resp.status_code, 200)
        boards = boards_resp.json()["data"]["items"]
        self.assertEqual(len(boards), 1)
        self.assertEqual(boards[0]["board_id"], self.board_id)

        modules_resp = await self.client.get(f"/api/v1/boards/{self.board_id}/modules")
        self.assertEqual(modules_resp.status_code, 200)
        modules = modules_resp.json()["data"]["items"]
        self.assertEqual(len(modules), 1)
        self.assertEqual(modules[0]["module_id"], self.module_id)

        topics_resp = await self.client.get(f"/api/v1/modules/{self.module_id}/topics")
        self.assertEqual(topics_resp.status_code, 200)
        topics = topics_resp.json()["data"]["items"]
        self.assertEqual({t["topic_id"] for t in topics}, {self.topic_id, self.topic_extra_id})

    async def test_topic_detail_progress_and_completion_flow(self) -> None:
        detail_resp = await self.client.get(f"/api/v1/topics/{self.topic_id}")
        self.assertEqual(detail_resp.status_code, 200)
        detail = detail_resp.json()["data"]
        self.assertEqual(detail["topic"]["topic_id"], self.topic_id)
        self.assertEqual(detail["progress_summary"]["best_score"], 0.9)

        content_resp = await self.client.get(f"/api/v1/topics/{self.topic_id}/content")
        self.assertEqual(content_resp.status_code, 200)
        content = content_resp.json()["data"]
        self.assertEqual(len(content["resources"]), 2)
        self.assertEqual(content["resources"][0]["title"], "Toolkit")

        progress_resp = await self.client.get(f"/api/v1/topics/{self.topic_id}/progress")
        self.assertEqual(progress_resp.status_code, 200)
        progress_payload = progress_resp.json()["data"]
        self.assertEqual(progress_payload["progress_status"], "in_progress")

        visit_resp = await self.client.post(f"/api/v1/topics/{self.topic_id}/visit")
        self.assertEqual(visit_resp.status_code, 200)

        complete_resp = await self.client.post(f"/api/v1/topics/{self.topic_id}/complete")
        self.assertEqual(complete_resp.status_code, 200)
        complete_data = complete_resp.json()["data"]
        self.assertTrue(complete_data["marked_complete"])

        async with self.SessionLocal() as session:
            refreshed = await session.get(UserTopicProgress, (self.user.id, uuid.UUID(self.topic_id)))
            self.assertIsNotNone(refreshed)
            assert refreshed is not None
            self.assertEqual(refreshed.progress_status, "completed")
            self.assertTrue(refreshed.marked_complete)
            self.assertIsNotNone(refreshed.completed_at)

    async def test_visit_creates_progress_for_new_topic(self) -> None:
        visit_resp = await self.client.post(f"/api/v1/topics/{self.topic_extra_id}/visit")
        self.assertEqual(visit_resp.status_code, 200)

        async with self.SessionLocal() as session:
            progress = await session.get(UserTopicProgress, (self.user.id, uuid.UUID(self.topic_extra_id)))
            self.assertIsNotNone(progress)
            assert progress is not None
            self.assertEqual(progress.progress_status, "in_progress")
            self.assertIsNotNone(progress.last_visited_at)


if __name__ == "__main__":
    unittest.main()
