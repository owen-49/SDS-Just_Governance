# backend/app/repositories/users.py
from __future__ import annotations
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

# 根据 user_id 查找用户
async def get_user_by_id(db: AsyncSession, user_id: UUID | str) -> Optional[User]:
    try:
        if isinstance(user_id, str):
            user_id = UUID(user_id)  # 可能抛出 ValueError
    except ValueError:
        return None  # 或者 return InvalidUserIdError()
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


# 根据 email查找用户
async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    res = await db.execute(select(User).where(User.email == email))
    return res.scalar_one_or_none()

# 创建一个用户
async def create_user(db: AsyncSession, *, email: str, password_hash: str,
                      name: str | None = None, is_active: bool = True) -> User:
    user = User(email=email, password_hash=password_hash, name=name, is_active=is_active)
    db.add(user)
    # 在仓库种不自动提交，由服务/路由层决定何时提交。
    return user

# 标记某个用户的邮箱为已验证（只在该用户尚未验证时）
    # 返回类型为 int，表示受影响的行数（即是否真的更新过）
async def mark_email_verified(db: AsyncSession, user_id: UUID) -> int:
    stmt = (
        update(User).where(User.id == user_id, User.email_verified_at.is_(None))
        .values(email_verified_at=func.now())  # noqa: F821; from sqlalchemy import func
        .execution_options(synchronize_session=False)
    )
    res = await db.execute(stmt)
    return res.rowcount or 0
