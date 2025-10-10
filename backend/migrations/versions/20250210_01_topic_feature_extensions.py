"""Add embedding column for topic RAG.

Revision ID: 20250210_01
Revises: 8b0f2ef2bda9
Create Date: 2025-02-10 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20250210_01"
down_revision: Union[str, Sequence[str], None] = "8b0f2ef2bda9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "document_chunks",
        sa.Column("embedding", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("document_chunks", "embedding")
