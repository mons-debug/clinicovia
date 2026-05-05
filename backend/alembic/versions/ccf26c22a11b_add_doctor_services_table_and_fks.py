"""add doctor_services table and FKs

Revision ID: ccf26c22a11b
Revises: t6g2i5d1e3f8
Create Date: 2026-05-04 20:40:14.408248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'ccf26c22a11b'
down_revision: Union[str, None] = 't6g2i5d1e3f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('doctor_services',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('doctor_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('default_price', sa.Float(), nullable=False),
        sa.Column('consent_template', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('clinic_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doctor_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_doctor_services_clinic_id', 'doctor_services', ['clinic_id'])
    op.create_index('ix_doctor_services_clinic_doctor', 'doctor_services', ['clinic_id', 'doctor_id'])

    op.add_column('appointments', sa.Column('doctor_service_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_appointments_doctor_service', 'appointments', 'doctor_services', ['doctor_service_id'], ['id'], ondelete='SET NULL')

    op.add_column('treatment_plans', sa.Column('doctor_service_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_treatment_plans_doctor_service', 'treatment_plans', 'doctor_services', ['doctor_service_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_treatment_plans_doctor_service', 'treatment_plans', type_='foreignkey')
    op.drop_column('treatment_plans', 'doctor_service_id')

    op.drop_constraint('fk_appointments_doctor_service', 'appointments', type_='foreignkey')
    op.drop_column('appointments', 'doctor_service_id')

    op.drop_index('ix_doctor_services_clinic_doctor', table_name='doctor_services')
    op.drop_index('ix_doctor_services_clinic_id', table_name='doctor_services')
    op.drop_table('doctor_services')
