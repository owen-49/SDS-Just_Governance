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


JSON_VARIANT = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table("document_chunks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("embedding", JSON_VARIANT, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("document_chunks", schema=None) as batch_op:
        batch_op.drop_column("embedding")
