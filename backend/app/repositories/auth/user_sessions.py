# backend/app/repositories/sessions.py
from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.user_sessions import UserSession

# 创建一个用户会话
async def create_session(db: AsyncSession, *, user_id: UUID, jti: str,
                         family_id: UUID, refresh_hash: str,
                         issued_at: datetime, expires_at: datetime,
                         user_agent: str | None, ip_address: str | None) -> UserSession:
    sess = UserSession(
        user_id=user_id, jti=jti, family_id=family_id,
        refresh_token_hash=refresh_hash, issued_at=issued_at, expires_at=expires_at,
        user_agent=user_agent, ip_address=ip_address
    )
    db.add(sess)
    return sess

# 通过jti查询用户会话
async def get_session_by_jti(db: AsyncSession, jti: str) -> Optional[UserSession]:
    res = await db.execute(select(UserSession).where(UserSession.jti == jti))
    return res.scalar_one_or_none()

# 撤销一个会话
async def revoke_session(db: AsyncSession, jti: str) -> int:
    stmt = (
        update(UserSession)
        .where(UserSession.jti == jti, UserSession.revoked_at.is_(None))
        .values(revoked_at=func.now())
        .execution_options(synchronize_session=False)
    )
    res = await db.execute(stmt)
    return res.rowcount or 0

# 撤销整个会话链
async def revoke_family(db: AsyncSession, family_id: UUID) -> int:
    stmt = (
        update(UserSession)
        .where(UserSession.family_id == family_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=func.now())
        .execution_options(synchronize_session=False)
    )
    res = await db.execute(stmt)
    return res.rowcount or 0


# 参数说明：
    # old_jti: str：被替换掉的旧 refresh token 的唯一标识（JWT ID）
    # new_id: UUID：新 token 对应的 session 主键 ID（一般是 UserSession.id）
# 返回值：
    # int：表示更新了几条记录（理论上应该是 1）
async def link_rotation(db: AsyncSession, old_jti: str, new_id: UUID) -> int:
    stmt = (
        update(UserSession)
        .where(UserSession.jti == old_jti)
        .values(replaced_by_id=new_id)
        .execution_options(synchronize_session=False)
    )
    res = await db.execute(stmt)
    return res.rowcount or 0
