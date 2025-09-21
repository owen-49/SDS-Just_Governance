# backend/app/core/db.py: 专门封装数据库的运行环境
# 给 FastAPI 提供数据库 Session 会话
# get_db() 是 FastAPI 的依赖注入入口（用 Depends()）
# backend/app/core/db.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,   # ✅ 2.0 推荐
)
from core.config import DATABASE_URL_ASYNC

engine: AsyncEngine = create_async_engine(
    DATABASE_URL_ASYNC,
    pool_pre_ping=True,   # 连接取出前 ping 一下，避免“僵尸连接”
    future=True,          # 统一 2.0 行为
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

