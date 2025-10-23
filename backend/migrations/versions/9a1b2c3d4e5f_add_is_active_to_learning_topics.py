"""add is_active to learning_topics

Revision ID: 9a1b2c3d4e5f
Revises: 4fb1b6a3da17
Create Date: 2025-10-16 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "9a1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "4fb1b6a3da17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add is_active column to learning_topics."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {
        column["name"] for column in inspector.get_columns("learning_topics")
    }
    if "is_active" not in existing_columns:
        op.add_column(
            "learning_topics",
            sa.Column(
                "is_active",
                sa.Boolean(),
                server_default=sa.text("true"),
                nullable=False,
            ),
        )
    else:
        # Ensure the column matches the expected definition if it was added manually earlier.
        op.alter_column(
            "learning_topics",
            "is_active",
            existing_type=sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema - remove is_active column from learning_topics."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {
        column["name"] for column in inspector.get_columns("learning_topics")
    }
    if "is_active" in existing_columns:
        op.drop_column("learning_topics", "is_active")
