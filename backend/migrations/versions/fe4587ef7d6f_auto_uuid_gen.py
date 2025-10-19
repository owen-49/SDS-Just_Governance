"""auto_Uuid_gen2

Revision ID: fe4587ef7d6f
Revises: f9f7930a42f7
Create Date: 2025-10-20 09:37:22.229802

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'fe4587ef7d6f'
down_revision: Union[str, Sequence[str], None] = 'f9f7930a42f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UUID_TABLES = [
    "assessment_items",
    "assessment_responses",
    "assessment_sessions",
    "boards",
    "chat_messages",
    "chat_sessions",
    "document_chunks",
    "documents",
    "email_verify_tokens",
    "learning_topic_contents",
    "learning_topics",
    "modules",
    "oauth_accounts",
    "onboarding_survey_answers",
    "onboarding_survey_options",
    "onboarding_surveys",
    "password_reset_tokens",
    "questions",
    "user_sessions",
    "users",
]


def upgrade() -> None:
    # 用 gen_random_uuid() 需要 pgcrypto；幂等，不会重复报错
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    for t in UUID_TABLES:
        op.alter_column(
            t, "id",
            existing_type=postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            existing_nullable=False,
        )


def downgrade() -> None:
    for table in UUID_TABLES:
        op.alter_column(
            table,
            "id",
            existing_type=postgresql.UUID(as_uuid=True),
            server_default=None,
            existing_nullable=False,
        )
