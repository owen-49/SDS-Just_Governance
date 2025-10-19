"""add assessment responses table

Revision ID: 3f5d0c4c8a9c
Revises: 8b0f2ef2bda9
Create Date: 2025-10-17 14:25:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "3f5d0c4c8a9c"
down_revision: Union[str, Sequence[str], None] = "8b0f2ef2bda9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create assessment_responses table."""
    op.create_table(
        "assessment_responses",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.Column("score", sa.Numeric(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["assessment_sessions.id"],
            name=op.f("fk_assessment_responses_session_id_assessment_sessions"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["assessment_items.id"],
            name=op.f("fk_assessment_responses_item_id_assessment_items"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assessment_responses")),
        sa.UniqueConstraint(
            "item_id",
            name="uq_assessment_responses_item_id",
        ),
    )
    op.create_index(
        op.f("ix_assessment_responses_session_id"),
        "assessment_responses",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_assessment_responses_item_id"),
        "assessment_responses",
        ["item_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop assessment_responses table."""
    op.drop_index(
        op.f("ix_assessment_responses_item_id"), table_name="assessment_responses"
    )
    op.drop_index(
        op.f("ix_assessment_responses_session_id"), table_name="assessment_responses"
    )
    op.drop_table("assessment_responses")
