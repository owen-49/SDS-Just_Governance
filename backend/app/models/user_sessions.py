
# backend/app/models/session.py
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, ForeignKey, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin, uuid_pk
if TYPE_CHECKING:
    # 只为类型检查用；运行时不会真的 import
    from .user_auth import User

class UserSession(Base, TimestampMixin):
    """
    用户会话（Refresh Token）记录：
    - access token 不入库；
    - refresh token 仅存哈希（不可逆）
    - family_id 将同一条刷新链路串起来，便于检测“被盗复用”
    - replaced_by_id 用于刷新轮转（旧→新），快速吊销整条链
    """
    __tablename__ = "user_sessions"

    # 用户会话id （主键）
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid_pk)

    # 用户id （外键）
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    # refresh token的唯一ID
    jti: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)

    # 轮转家族ID
    family_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)

    # 仅存哈希（SHA-256）
    refresh_token_hash: Mapped[str] = mapped_column(String(128), unique=True)

    # 签发时间
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),  nullable=False)

    # 过期时间
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # 上一次使用时间
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # 上一次撤销时间
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # 被哪一个新会话替换（轮转时填写）
    replaced_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("user_sessions.id", ondelete="SET NULL"),
        default=None
    )
    # 设备信息
    user_agent: Mapped[Optional[str]] = mapped_column(String(255))
    # IP地址
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))

    # 关系（如果需要从 Session 取 User）
    user: Mapped["User"] = relationship(back_populates="sessions", lazy="joined", viewonly=True)

    # 便捷只读属性
    @property
    def is_revoked(self) -> bool:           # 判断这个对象是否被撤销
        return self.revoked_at is not None

    @property
    def is_expired(self) -> bool:           # 判断这个对象是否过期
        return datetime.now(timezone.utc) > self.expires_at
