"""merge_heads

Revision ID: 0ba445d7a031
Revises: fe4587ef7d6f, 6d3a2e1c4b75
Create Date: 2025-10-23 16:53:03.634648

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0ba445d7a031'
down_revision: Union[str, Sequence[str], None] = ('fe4587ef7d6f', '6d3a2e1c4b75')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
