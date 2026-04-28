"""add enabled_agents to whatsapp_conversations

Revision ID: d2f3a1b4c5e6
Revises: b1a2c3d4e5f6
Create Date: 2026-04-12 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d2f3a1b4c5e6"
down_revision: Union[str, None] = "b1a2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "whatsapp_conversations",
        sa.Column("enabled_agents", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("whatsapp_conversations", "enabled_agents")
