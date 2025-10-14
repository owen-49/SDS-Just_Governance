"""Align topic schema with application models.

Revision ID: 20250305_01
Revises: 20250210_01
Create Date: 2025-03-05 00:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20250305_01"
down_revision: Union[str, Sequence[str], None] = "20250210_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


progress_status = sa.Enum(
    "not_started",
    "in_progress",
    "completed",
    name="progress_status",
)

quiz_state = sa.Enum(
    "none",
    "pending",
    "completed",
    name="quiz_state",
)


def upgrade() -> None:
    bind = op.get_bind()
    progress_status.create(bind, checkfirst=True)
    quiz_state.create(bind, checkfirst=True)

    op.add_column(
        "topics",
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )

    op.create_table(
        "user_topic_progress",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("topic_id", sa.UUID(), nullable=False),
        sa.Column(
            "progress_status",
            progress_status,
            server_default=sa.text("'not_started'"),
            nullable=False,
        ),
        sa.Column("last_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column(
            "attempt_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("best_score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("last_quiz_session_id", sa.UUID(), nullable=True),
        sa.Column(
            "pending_quiz",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "quiz_state",
            quiz_state,
            server_default=sa.text("'none'"),
            nullable=False,
        ),
        sa.Column(
            "marked_complete",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_visited_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["last_quiz_session_id"],
            ["assessment_sessions.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("user_id", "topic_id"),
    )
    op.create_index(
        "ix_user_topic_progress_topic_id",
        "user_topic_progress",
        ["topic_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_topic_progress_topic_id", table_name="user_topic_progress"
    )
    op.drop_table("user_topic_progress")
    op.drop_column("topics", "is_active")

    bind = op.get_bind()
    quiz_state.drop(bind, checkfirst=True)
    progress_status.drop(bind, checkfirst=True)
