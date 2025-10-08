from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EmailVerifyToken

# 创建一个email_token：
#   设置用户id，token哈希值，过期时间
async def create_email_token(
    db: AsyncSession, *, user_id: UUID, token_hash: str, ttl_hours: int
) -> EmailVerifyToken:
    row = EmailVerifyToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
    )
    db.add(row)
    return row

async def get_token_by_hash(db: AsyncSession, token_hash: str) -> Optional[EmailVerifyToken]:
    res = await db.execute(select(EmailVerifyToken).where(EmailVerifyToken.token_hash == token_hash))
    return res.scalar_one_or_none()

# 撤销该用户所有未使用的邮箱验证 token
#   返回：受影响的token记录条数
async def revoke_unusued_tokens_of_user(db: AsyncSession, user_id: UUID) -> int:
    stmt = (
        update(EmailVerifyToken)
        .where(
            EmailVerifyToken.user_id == user_id,
            EmailVerifyToken.used_at.is_(None),         # 还没点过链接
            EmailVerifyToken.revoked_at.is_(None),      # 没被系统撤销
        )
        .values(revoked_at=datetime.now(timezone.utc))      # 设置撤销时间：现在
        .execution_options(synchronize_session=False)       # 提升性能：不需要ORM同步更新
    )
    res = await db.execute(stmt)
    return res.rowcount or 0
