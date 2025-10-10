import os
import unittest
import uuid

os.environ.setdefault("DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///:memory:")

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.models import Base, Board, Module, Topic, Document, DocumentChunk  # noqa: E402
from app.services.topic_rag import TopicRAGService  # noqa: E402


class TopicRagServiceTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.SessionLocal = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with self.SessionLocal() as session:
            board = Board(id=uuid.uuid4(), name="Governance", sort_order=1)
            module = Module(id=uuid.uuid4(), board_id=board.id, name="Foundations", sort_order=1)
            self.topic = Topic(id=uuid.uuid4(), module_id=module.id, name="Transparency", sort_order=1, is_active=True)
            document = Document(id=uuid.uuid4(), title="Transparency Playbook", topic_id=self.topic.id)
            chunk_a = DocumentChunk(
                document_id=document.id,
                chunk_index=0,
                content="Transparent reporting builds trust with communities.",
            )
            chunk_b = DocumentChunk(
                document_id=document.id,
                chunk_index=1,
                content="Ignoring feedback quickly erodes stakeholder confidence.",
            )
            session.add_all([board, module, self.topic, document, chunk_a, chunk_b])
            await session.commit()

        self.service = TopicRAGService()

    async def asyncTearDown(self) -> None:
        await self.engine.dispose()

    async def test_search_returns_ranked_results(self) -> None:
        async with self.SessionLocal() as session:
            results = await self.service.search(session, self.topic.id, "community trust", limit=5)
            self.assertGreaterEqual(len(results), 1)
            self.assertTrue(all(result.score >= 0 for result in results))
            # ensure embeddings persisted for subsequent queries
            await session.commit()

        async with self.SessionLocal() as session:
            # embeddings should already exist; ensure we still get consistent order
            second_results = await self.service.search(session, self.topic.id, "trust", limit=5)
            self.assertGreaterEqual(len(second_results), 1)
            scores = [result.score for result in second_results]
            self.assertEqual(scores, sorted(scores, reverse=True))


if __name__ == "__main__":
    unittest.main()
