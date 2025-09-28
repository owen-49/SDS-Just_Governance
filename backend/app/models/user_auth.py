# backend/app/models/user_auth.py
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy import String, Text, DateTime, UniqueConstraint, ForeignKey, Enum, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Boolean

from .base import Base, TimestampMixin, uuid_pk_db

if TYPE_CHECKING:
    from .user_sessions import UserSession  # 仅类型检查，避免循环导入

ChatScope = Enum("global", "topic", name="chat_scope")
MsgRole = Enum("user", "ai", name="role")

class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db()
    )
    # 注册邮箱
    email: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    # 邮箱验证时间
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # 密码哈希值
    password_hash: Mapped[Optional[str]] = mapped_column(Text)
    # 名字
    name: Mapped[Optional[str]] = mapped_column(String)
    # 头像url
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    # 首次登录时间
    first_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # 是否活跃
    is_active: Mapped[bool] = mapped_column(Boolean)

    # 关联多个第三方账号
    oauth_accounts: Mapped[List["OAuthAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
                      #  back_populates要填的是对方模型中用于“互相关联”的字段名，第69行可以看到属性OAuthAccount.user，故填user。
                        # 对应地，第69行的back_populates都要填本属性名字oauth_accounts
                      #  all：包括所有操作（保存、更新、删除等）
                      #  delete-orphan：当 OAuthAccount 不再属于任何 User 时，自动删除（成为“孤儿”）

    # 关联对应的用户会话
    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession", back_populates="user", lazy="noload"
    )


class OAuthAccount(TimestampMixin, Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_oauth_provider_account"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db()
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True, nullable=False
    )
    provider: Mapped[str] = mapped_column(String, nullable=False)  # google/microsoft/...
    provider_account_id: Mapped[str] = mapped_column(String, nullable=False)

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")


class EmailVerifyToken(Base, TimestampMixin):
    __tablename__ = "email_verify_tokens"
    __table_args__ = (
        sa.UniqueConstraint("token_hash", name="uq_email_verify_token_hash"),
        sa.Index("ix_evt_user_id_issued_at", "user_id", "issued_at"),  # 常用查询：某用户最新一条
    )

    # 主键：数据库端生成 UUID（pgcrypto）
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=uuid_pk_db(),
        nullable=False,
    )

    # 外键：必填 + 索引
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # 仅存哈希（不可逆）：唯一且必填
    token_hash: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
    )

    # 签发时间：数据库级默认，带时区
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    # 过期时间：必填（由业务计算写入；不设默认）
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # 使用/撤销时间：可空，带时区
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # 追踪信息：可空
    used_ip: Mapped[Optional[str]] = mapped_column(String(45))
    used_user_agent: Mapped[Optional[str]] = mapped_column(String(255))

    # 关系：避免循环导入，目标用字符串
    user: Mapped["User"] = relationship(
        "User",
        lazy="joined",
        viewonly=True,
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=uuid_pk_db()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True, nullable=False
    )
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
