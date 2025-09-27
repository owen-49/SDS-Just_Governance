from __future__ import annotations
import uuid
from datetime import datetime
import sqlalchemy as sa
from typing import Optional, Dict, Any

from sqlalchemy import MetaData, func, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# 让 Alembic 生成外键/唯一索引的名字更稳定（避免不同机器上名字不同）
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",      # 索引
    "uq": "uq_%(table_name)s_%(column_0_name)s",     # 唯一约束
    "ck": "ck_%(table_name)s_%(constraint_name)s",      # 检查约束
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",    # 外键
    "pk": "pk_%(table_name)s",  # 主键
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

# 通用时间戳
class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),  # 由数据库填充，跨库可用
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),  # 插入时初值
        server_onupdate=sa.text("CURRENT_TIMESTAMP"),  # 由数据库在 UPDATE 时自动刷新
        nullable=False,
    )

# 统一的 UUID 主键字段
def uuid_pk() -> uuid.UUID:
    return uuid.uuid4()
