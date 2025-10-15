from __future__ import annotations
import os
import uuid
from datetime import datetime
import sqlalchemy as sa
from typing import Any, Dict, Optional


import sqlalchemy as sa
from sqlalchemy import DateTime, MetaData, func
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
        server_default=sa.text("CURRENT_TIMESTAMP"),  # 插入时初值
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=sa.text("CURRENT_TIMESTAMP"),  # 插入时初值
        server_onupdate=sa.text("CURRENT_TIMESTAMP"),  # 在 UPDATE 时自动刷新
        nullable=False,
    )

# 统一 UUID 主键（数据库生成）
# ！需要为Post过热时SQL手动开启扩展：CREATE EXTENSION IF NOT EXISTS pgcrypto;
_SQLITE_UUID_EXPR = (
    "lower(hex(randomblob(4))) || '-' || "
    "lower(hex(randomblob(2))) || '-' || "
    "lower(hex(randomblob(2))) || '-' || "
    "lower(hex(randomblob(2))) || '-' || "
    "lower(hex(randomblob(6)))"
)

def uuid_pk_db() -> sa.TextClause:
    url = os.getenv("DATABASE_URL_ASYNC", "")
    if url.startswith("sqlite"):
        return sa.text(_SQLITE_UUID_EXPR)
    return sa.text("gen_random_uuid()")          # sqlalchemy.text() 方法，用来写“原生 SQL 表达式”。


# 弃用：
# 统一的 UUID 主键字段（只作用于采用ORM操作数据库的情况，手动填数据库无法自动生成uuid
def uuid_pk() -> uuid.UUID:
    return uuid.uuid4()
