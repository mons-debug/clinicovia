"""add message_routed to agenteventtype enum

Revision ID: f4b8c0d2e5f7
Revises: e3a7b9f1c2d4
Create Date: 2026-04-13 10:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "f4b8c0d2e5f7"
down_revision: Union[str, None] = "e3a7b9f1c2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE agenteventtype ADD VALUE IF NOT EXISTS 'message_routed'"
        )


def downgrade() -> None:
    pass
