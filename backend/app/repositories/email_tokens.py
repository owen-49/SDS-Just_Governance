from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models import EmailVerifyToken

async def create_email_token(
    db: AsyncSession, *, user_id: UUID, token_hash: str, ttl_hours: int
) -> EmailVerifyToken:
    row = EmailVerifyToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
    )
    db.add(row)
    return row

async def get_token_by_hash(db: AsyncSession, token_hash: str) -> Optional[EmailVerifyToken]:
    res = await db.execute(select(EmailVerifyToken).where(EmailVerifyToken.token_hash == token_hash))
    return res.scalar_one_or_none()

async def revoke_unusued_tokens_of_user(db: AsyncSession, user_id: UUID) -> int:
    stmt = (
        update(EmailVerifyToken)
        .where(
            EmailVerifyToken.user_id == user_id,
            EmailVerifyToken.used_at.is_(None),
            EmailVerifyToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.utcnow())
        .execution_options(synchronize_session=False)
    )
    res = await db.execute(stmt)
    return res.rowcount or 0
