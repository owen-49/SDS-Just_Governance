from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    String, Text, DateTime, UniqueConstraint, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, uuid_pk

# users（账号主表）
# 参考：数据库表结构.txt 的 users 字段与说明: contentReference[oaicite:0]{index=0}
class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    email: Mapped[Optional[str]] = mapped_column(String, unique=True)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    password_hash: Mapped[Optional[str]] = mapped_column(Text)

    name: Mapped[Optional[str]] = mapped_column(String)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    first_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    oauth_accounts: Mapped[List["OAuthAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

# 第三方账号绑定表 oauth_accounts
# 参考：数据库表结构.txt。:contentReference[oaicite:1]{index=1}
class OAuthAccount(TimestampMixin, Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_oauth_provider_account"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)    # google/microsoft/linkedin/apple
    provider_account_id: Mapped[str] = mapped_column(String, nullable=False)

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")

# 邮箱验证 token 表
# 参考：email_verification_tokens 结构。:contentReference[oaicite:2]{index=2}
class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

# 找回密码 token 表
# 参考：password_reset_tokens 结构。:contentReference[oaicite:3]{index=3}
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_pk)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
