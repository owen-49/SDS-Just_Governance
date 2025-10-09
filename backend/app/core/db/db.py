# backend/app/core/db.py: 专门封装数据库的运行环境
    # 给 FastAPI 提供数据库 Session 会话
    # get_db() 是 FastAPI 的依赖注入入口（用 Depends()）
    # backend/app/core/db.py
from typing import AsyncGenerator
from pathlib import Path


from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config.config import DATABASE_URL_ASYNC
def _ensure_sqlite_path(url: str) -> None:
    """Create parent directories for SQLite databases when needed."""

    if not url.startswith("sqlite"):
        return

    # Patterns: sqlite:///absolute/path.db or sqlite+aiosqlite:///absolute/path.db
    if url.endswith(":memory:"):
        return

    _, _, path = url.partition("///")
    if not path:
        return
    db_path = Path(path)
    if db_path.parent and not db_path.parent.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_path(DATABASE_URL_ASYNC)
engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    pool_pre_ping=True,   # 连接取出前 ping 一下，否则丢弃并重新建立连接。避免“僵尸连接”
    future=True,          # 统一 2.0 行为
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,   # 提交后对象仍能被访问属性
    autoflush=False,    # 手动flush
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()  # 自动回滚异常事务
            raise



