"""add WALK_IN value to appointmentkind enum + needs_confirmation column

Revision ID: j6c1d4f8e9b2
Revises: i5f9b3d8c2a4
Create Date: 2026-04-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j6c1d4f8e9b2"
down_revision: Union[str, None] = "i5f9b3d8c2a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE appointmentkind ADD VALUE IF NOT EXISTS 'WALK_IN' BEFORE 'OTHER'")
    op.add_column(
        "appointments",
        sa.Column(
            "needs_confirmation",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("appointments", "needs_confirmation")
    # Postgres can't DROP VALUE from an enum.
