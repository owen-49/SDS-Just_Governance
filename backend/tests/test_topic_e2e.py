import os
import uuid

import pytest

os.environ.setdefault("DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///:memory:")

from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.core.db import db as db_module  # noqa: E402
from app.core.db.db import get_db  # noqa: E402
from app.deps.auth import get_current_user  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, User  # noqa: E402


@pytest.mark.asyncio
async def test_admin_to_learner_topic_flow():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    original_engine = db_module.engine
    original_sessionmaker = db_module.AsyncSessionLocal
    db_module.engine = engine
    db_module.AsyncSessionLocal = session_factory

    async with session_factory() as session:
        user = User(id=uuid.uuid4(), email="admin@example.com", is_active=True, name="Admin")
        session.add(user)
        await session.commit()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_user():
        return user

    overrides_backup = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_user

    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")

    try:
        board_resp = await client.post(
            "/api/v1/admin/learning/boards",
            json={"name": "Integrity", "sort_order": 1},
        )
        assert board_resp.status_code == 201
        board_id = board_resp.json()["data"]["board_id"]

        module_resp = await client.post(
            "/api/v1/admin/learning/modules",
            json={"board_id": board_id, "name": "Module A", "sort_order": 1},
        )
        assert module_resp.status_code == 201
        module_id = module_resp.json()["data"]["module_id"]

        topic_resp = await client.post(
            "/api/v1/admin/learning/topics",
            json={
                "module_id": module_id,
                "name": "Building Trust",
                "sort_order": 1,
                "pass_threshold": 0.8,
            },
        )
        assert topic_resp.status_code == 201
        topic_id = topic_resp.json()["data"]["topic_id"]

        content_resp = await client.put(
            f"/api/v1/admin/learning/topics/{topic_id}/content",
            json={
                "body_markdown": "# Trust Basics\nTransparency is the baseline for legitimacy.",
                "summary": "Explain why transparency matters.",
                "resources": [{"title": "Toolkit", "url": "https://example.com/toolkit"}],
            },
        )
        assert content_resp.status_code == 200

        document_resp = await client.post(
            f"/api/v1/admin/learning/topics/{topic_id}/documents",
            json={
                "title": "Trust Handbook",
                "source": "https://example.com/handbook",
                "chunks": [
                    {"content": "Transparency creates accountability."},
                    {"content": "Regular updates reinforce legitimacy."},
                ],
            },
        )
        assert document_resp.status_code == 201

        question_payload = {
            "stem": "What improves trust?",
            "qtype": "single",
            "choices": [
                {"id": "A", "label": "Share accurate updates"},
                {"id": "B", "label": "Conceal feedback"},
                {"id": "C", "label": "Delay decisions"},
            ],
            "correct_options": ["A"],
        }
        for _ in range(3):
            q_resp = await client.post(
                f"/api/v1/admin/learning/topics/{topic_id}/quiz/questions",
                json=question_payload,
            )
            assert q_resp.status_code == 201

        boards_resp = await client.get("/api/v1/boards")
        assert boards_resp.status_code == 200

        topics_resp = await client.get(f"/api/v1/modules/{module_id}/topics")
        assert topics_resp.status_code == 200

        detail_resp = await client.get(f"/api/v1/topics/{topic_id}")
        assert detail_resp.status_code == 200

        rag_resp = await client.get(
            f"/api/v1/topics/{topic_id}/rag/search",
            params={"query": "transparency"},
        )
        assert rag_resp.status_code == 200
        assert rag_resp.json()["data"]["results"]

        start_resp = await client.post(f"/api/v1/topics/{topic_id}/quiz/start")
        assert start_resp.status_code == 200
        quiz_session_id = start_resp.json()["data"]["quiz_session_id"]
        questions = start_resp.json()["data"]["questions"]
        answers = {q["item_id"]: q["choices"][0]["id"] for q in questions}

        submit_resp = await client.post(
            f"/api/v1/topics/{topic_id}/quiz/{quiz_session_id}/submit",
            json={"answers": answers},
        )
        assert submit_resp.status_code == 200
        assert submit_resp.json()["data"]["passed"] is True

    finally:
        await client.aclose()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(overrides_backup)
        db_module.AsyncSessionLocal = original_sessionmaker
        db_module.engine = original_engine
        await engine.dispose()
