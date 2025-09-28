"""apply server_default and nullable updates

Revision ID: d8c20fb8e06b
Revises: e459d63c012b
Create Date: 2025-09-28 13:20:04.481976
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd8c20fb8e06b'
down_revision: Union[str, Sequence[str], None] = 'e459d63c012b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema (assumes tables are empty so we can set NOT NULL / defaults directly)."""

    # 0) PG 扩展：用于数据库端生成 UUID
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # 1) 新表 user_sessions：主键/时间默认值数据库端生成
    op.create_table(
        'user_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('jti', sa.String(length=36), nullable=False),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('refresh_token_hash', sa.String(length=128), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('replaced_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['replaced_by_id'], ['user_sessions.id'],
                                name=op.f('fk_user_sessions_replaced_by_id_user_sessions'),
                                ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],
                                name=op.f('fk_user_sessions_user_id_users'),
                                ondelete='CASCADE'),
        sa.UniqueConstraint('jti', name=op.f('uq_user_sessions_jti')),
        sa.UniqueConstraint('refresh_token_hash', name=op.f('uq_user_sessions_refresh_token_hash')),
    )
    op.create_index(op.f('ix_user_sessions_family_id'), 'user_sessions', ['family_id'], unique=False)
    op.create_index(op.f('ix_user_sessions_user_id'), 'user_sessions', ['user_id'], unique=False)

    # 2) 统一将时间列改为 timestamptz，并加数据库默认（你说库里无数据行，直接改最简单）
    # oauth_accounts
    op.execute("""
        ALTER TABLE oauth_accounts
        ALTER COLUMN created_at TYPE timestamptz,
        ALTER COLUMN updated_at TYPE timestamptz;
    """)
    op.alter_column('oauth_accounts', 'created_at', server_default=sa.text('CURRENT_TIMESTAMP'), existing_nullable=False)
    op.alter_column('oauth_accounts', 'updated_at', server_default=sa.text('CURRENT_TIMESTAMP'), existing_nullable=False)

    # topic_contents
    op.execute("""
        ALTER TABLE topic_contents
        ALTER COLUMN created_at TYPE timestamptz,
        ALTER COLUMN updated_at TYPE timestamptz;
    """)
    op.alter_column('topic_contents', 'created_at', server_default=sa.text('CURRENT_TIMESTAMP'), existing_nullable=False)
    op.alter_column('topic_contents', 'updated_at', server_default=sa.text('CURRENT_TIMESTAMP'), existing_nullable=False)

    # users
    op.execute("""
        ALTER TABLE users
        ALTER COLUMN created_at TYPE timestamptz,
        ALTER COLUMN updated_at TYPE timestamptz;
    """)
    op.alter_column('users', 'created_at', server_default=sa.text('CURRENT_TIMESTAMP'), existing_nullable=False)
    op.alter_column('users', 'updated_at', server_default=sa.text('CURRENT_TIMESTAMP'), existing_nullable=False)

    # 3) topic_contents.body_format：设为 NOT NULL 且默认 'markdown'
    op.alter_column('topic_contents', 'body_format',
                    existing_type=sa.VARCHAR(),
                    server_default=sa.text("'markdown'"),
                    nullable=False)

    # 4) topics.pass_threshold：改为 numeric(3,2)
    op.execute("""
        ALTER TABLE topics
        ALTER COLUMN pass_threshold TYPE numeric(3,2);
    """)

    # 5) users.is_active：直接 NOT NULL DEFAULT true（空表场景安全）
    op.add_column('users', sa.Column('is_active', sa.Boolean(),
                                     server_default=sa.text('true'), nullable=False))

    # 6) 触发器：让 updated_at 在行更新时自动刷新（覆盖 PG 无列级 on update 的限制）
    op.execute("""
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # 为包含 updated_at 的表创建触发器
    for table in ['oauth_accounts', 'topic_contents', 'users', 'user_sessions']:
        op.execute(f"""
        DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};
        CREATE TRIGGER trg_{table}_updated_at
        BEFORE UPDATE ON {table}
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """)


def downgrade() -> None:
    """Downgrade schema."""
    # 删除触发器
    for table in ['oauth_accounts', 'topic_contents', 'users', 'user_sessions']:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};")

    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")

    # users.is_active
    op.drop_column('users', 'is_active')

    # topics.pass_threshold 回退为 double precision
    op.execute("""
        ALTER TABLE topics
        ALTER COLUMN pass_threshold TYPE double precision;
    """)

    # topic_contents.body_format 回退为可空、去掉默认
    op.alter_column('topic_contents', 'body_format',
                    existing_type=sa.VARCHAR(),
                    server_default=None,
                    nullable=True)

    # users created_at/updated_at 回退为 timestamp (不带时区)，去掉默认
    op.alter_column('users', 'updated_at', server_default=None, existing_nullable=False)
    op.alter_column('users', 'created_at', server_default=None, existing_nullable=False)
    op.execute("""
        ALTER TABLE users
        ALTER COLUMN updated_at TYPE timestamp,
        ALTER COLUMN created_at TYPE timestamp;
    """)

    # topic_contents created_at/updated_at 回退
    op.alter_column('topic_contents', 'updated_at', server_default=None, existing_nullable=False)
    op.alter_column('topic_contents', 'created_at', server_default=None, existing_nullable=False)
    op.execute("""
        ALTER TABLE topic_contents
        ALTER COLUMN updated_at TYPE timestamp,
        ALTER COLUMN created_at TYPE timestamp;
    """)

    # oauth_accounts created_at/updated_at 回退
    op.alter_column('oauth_accounts', 'updated_at', server_default=None, existing_nullable=False)
    op.alter_column('oauth_accounts', 'created_at', server_default=None, existing_nullable=False)
    op.execute("""
        ALTER TABLE oauth_accounts
        ALTER COLUMN updated_at TYPE timestamp,
        ALTER COLUMN created_at TYPE timestamp;
    """)

    # user_sessions
    op.drop_index(op.f('ix_user_sessions_user_id'), table_name='user_sessions')
    op.drop_index(op.f('ix_user_sessions_family_id'), table_name='user_sessions')
    op.drop_table('user_sessions')

    # 回退扩展（通常不回滚扩展，保留）
    # op.execute("DROP EXTENSION IF EXISTS pgcrypto;")
