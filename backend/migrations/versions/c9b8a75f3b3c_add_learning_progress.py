"""add learning progress tracking"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c9b8a75f3b3c"
down_revision: Union[str, Sequence[str], None] = "d57c99a3d012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply learning progress schema updates."""
    op.alter_column(
        "topics",
        "pass_threshold",
        existing_type=sa.Numeric(3, 2),
        server_default=sa.text("0.80"),
        existing_nullable=False,
    )
    op.add_column(
        "topics",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )

    bind = op.get_bind()
    progress_status_enum = sa.Enum(
        "not_started", "in_progress", "completed", name="progress_status"
    )
    quiz_state_enum = sa.Enum("none", "pending", "completed", name="quiz_state")
    progress_status_enum.create(bind, checkfirst=True)
    quiz_state_enum.create(bind, checkfirst=True)

    op.create_table(
        "user_topic_progress",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.Column("last_quiz_session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "pending_quiz",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
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
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_topic_progress_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["topic_id"],
            ["topics.id"],
            name=op.f("fk_user_topic_progress_topic_id_topics"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["last_quiz_session_id"],
            ["assessment_sessions.id"],
            name=op.f("fk_user_topic_progress_last_quiz_session_id_assessment_sessions"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("user_id", "topic_id", name=op.f("pk_user_topic_progress")),
    )
    op.create_index(
        op.f("ix_user_topic_progress_topic_id"),
        "user_topic_progress",
        ["topic_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_topic_progress_last_quiz_session_id"),
        "user_topic_progress",
        ["last_quiz_session_id"],
        unique=False,
    )

    op.execute(
        """
        CREATE TRIGGER trg_user_topic_progress_updated_at
        BEFORE UPDATE ON user_topic_progress
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
        """
    )


def downgrade() -> None:
    """Revert learning progress schema updates."""
    op.execute("DROP TRIGGER IF EXISTS trg_user_topic_progress_updated_at ON user_topic_progress;")
    op.drop_index(
        op.f("ix_user_topic_progress_last_quiz_session_id"),
        table_name="user_topic_progress",
    )
    op.drop_index(op.f("ix_user_topic_progress_topic_id"), table_name="user_topic_progress")
    op.drop_table("user_topic_progress")

    op.drop_column("topics", "is_active")
    op.alter_column(
        "topics",
        "pass_threshold",
        existing_type=sa.Numeric(3, 2),
        server_default=None,
        existing_nullable=False,
    )

    bind = op.get_bind()
    quiz_state_enum = sa.Enum("none", "pending", "completed", name="quiz_state")
    progress_status_enum = sa.Enum(
        "not_started", "in_progress", "completed", name="progress_status"
    )
    quiz_state_enum.drop(bind, checkfirst=True)
    progress_status_enum.drop(bind, checkfirst=True)
