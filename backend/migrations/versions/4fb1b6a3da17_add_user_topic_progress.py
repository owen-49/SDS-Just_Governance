"""create user topic progress table

Revision ID: 4fb1b6a3da17
Revises: 8b0f2ef2bda9
Create Date: 2025-10-18 16:58:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "4fb1b6a3da17"
down_revision: Union[str, Sequence[str], None] = "3f5d0c4c8a9c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

progress_status_enum = sa.Enum(
    "not_started",
    "in_progress",
    "completed",
    name="progress_status",
    create_type=False,
)
quiz_state_enum = sa.Enum(
    "none", "pending", "completed", name="quiz_state", create_type=False
)


def upgrade() -> None:
    op.create_table(
        "user_topic_progress",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "topic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("learning_topics.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "progress_status",
            progress_status_enum,
            server_default=sa.text("'not_started'"),
            nullable=False,
        ),
        sa.Column("last_score", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "attempt_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("best_score", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "last_quiz_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assessment_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("pending_quiz", postgresql.JSONB(), nullable=True),
        sa.Column(
            "quiz_state",
            quiz_state_enum,
            server_default=sa.text("'none'"),
            nullable=False,
        ),
        sa.Column(
            "marked_complete",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "last_visited_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
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
        sa.PrimaryKeyConstraint("user_id", "topic_id", name=op.f("pk_user_topic_progress")),
    )


def downgrade() -> None:
    op.drop_table("user_topic_progress")
