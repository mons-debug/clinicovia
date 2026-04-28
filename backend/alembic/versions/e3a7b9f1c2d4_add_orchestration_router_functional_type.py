"""add orchestration_router to functionaltype enum

Revision ID: e3a7b9f1c2d4
Revises: d2f3a1b4c5e6
Create Date: 2026-04-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "e3a7b9f1c2d4"
down_revision: Union[str, None] = "d2f3a1b4c5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Must be outside a transaction for ADD VALUE in older PG versions.
    # With autocommit_block it is safe in all supported versions.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE functionaltype ADD VALUE IF NOT EXISTS 'orchestration_router'"
        )


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the type.
    # Leaving the label in place is harmless.
    pass
