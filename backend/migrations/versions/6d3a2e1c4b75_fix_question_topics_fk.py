"""Fix question_topics.topic_id foreign key

Revision ID: 6d3a2e1c4b75
Revises: f9f7930a42f7
Create Date: 2025-10-22 17:25:00.000000

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "6d3a2e1c4b75"
down_revision: Union[str, Sequence[str], None] = "f9f7930a42f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _fk_names(connection, table_name: str) -> set[str]:
    inspector = inspect(connection)
    return {fk["name"] for fk in inspector.get_foreign_keys(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    fk_names = _fk_names(bind, "question_topics")

    if "fk_question_topics_topic_id_topics" in fk_names:
        op.drop_constraint(
            "fk_question_topics_topic_id_topics",
            "question_topics",
            type_="foreignkey",
        )
        fk_names.remove("fk_question_topics_topic_id_topics")

    if "fk_question_topics_topic_id_learning_topics" not in fk_names:
        op.create_foreign_key(
            "fk_question_topics_topic_id_learning_topics",
            "question_topics",
            "learning_topics",
            ["topic_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    fk_names = _fk_names(bind, "question_topics")

    if "fk_question_topics_topic_id_learning_topics" in fk_names:
        op.drop_constraint(
            "fk_question_topics_topic_id_learning_topics",
            "question_topics",
            type_="foreignkey",
        )
        fk_names.remove("fk_question_topics_topic_id_learning_topics")

    if "fk_question_topics_topic_id_topics" not in fk_names:
        op.create_foreign_key(
            "fk_question_topics_topic_id_topics",
            "question_topics",
            "topics",
            ["topic_id"],
            ["id"],
            ondelete="CASCADE",
        )
