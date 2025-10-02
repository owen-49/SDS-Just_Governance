"""revise EmailVerifyToken

Revision ID: d57c99a3d012
Revises: d8c20fb8e06b
Create Date: 2025-09-28 15:13:39.641995
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd57c99a3d012'
down_revision: Union[str, Sequence[str], None] = 'd8c20fb8e06b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 新表：email_verify_tokens（规范：方言UUID，单一唯一约束，数据库级默认）
    op.create_table(
        'email_verify_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True),
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token_hash', sa.String(length=128), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('used_ip', sa.String(length=45), nullable=True),
        sa.Column('used_user_agent', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'],
            name=op.f('fk_email_verify_tokens_user_id_users'),
            ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_email_verify_tokens')),
        sa.UniqueConstraint('token_hash', name=op.f('uq_email_verify_tokens_token_hash')),
    )
    # 索引：user_id、以及 (user_id, issued_at) 复合索引
    op.create_index(op.f('ix_email_verify_tokens_user_id'),
                    'email_verify_tokens', ['user_id'], unique=False)
    op.create_index('ix_evt_user_id_issued_at',
                    'email_verify_tokens', ['user_id', 'issued_at'], unique=False)

    # 移除旧表/索引（你说库里无数据，这里直接DROP）
    op.drop_index(op.f('ix_email_verification_tokens_user_id'),
                  table_name='email_verification_tokens')
    op.drop_table('email_verification_tokens')


def downgrade() -> None:
    """Downgrade schema."""
    # 还原老表结构（按你之前的定义；如需 token_hash → token 的映射，按需调整）
    op.create_table(
        'email_verification_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.VARCHAR(), nullable=False),
        sa.Column('expires_at', postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('used_at', postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'],
            name=op.f('fk_email_verification_tokens_user_id_users'),
            ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_email_verification_tokens')),
        sa.UniqueConstraint('token', name=op.f('uq_email_verification_tokens_token')),
    )
    op.create_index(op.f('ix_email_verification_tokens_user_id'),
                    'email_verification_tokens', ['user_id'], unique=False)

    # 删除新表及索引
    op.drop_index('ix_evt_user_id_issued_at', table_name='email_verify_tokens')
    op.drop_index(op.f('ix_email_verify_tokens_user_id'),
                  table_name='email_verify_tokens')
    op.drop_table('email_verify_tokens')
