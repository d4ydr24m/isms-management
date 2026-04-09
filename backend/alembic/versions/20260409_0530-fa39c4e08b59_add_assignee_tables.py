"""add_assignee_tables

Revision ID: fa39c4e08b59
Revises: 8fbb7c965416
Create Date: 2026-04-09 05:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'fa39c4e08b59'
down_revision = '8fbb7c965416'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create nc_assignees junction table
    op.create_table(
        'nc_assignees',
        sa.Column('non_conformity_id', sa.Integer(), sa.ForeignKey('non_conformities.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('personnel_id', sa.Integer(), sa.ForeignKey('personnel.id', ondelete='CASCADE'), primary_key=True),
    )

    # Create ca_assignees junction table
    op.create_table(
        'ca_assignees',
        sa.Column('corrective_action_id', sa.Integer(), sa.ForeignKey('corrective_actions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('personnel_id', sa.Integer(), sa.ForeignKey('personnel.id', ondelete='CASCADE'), primary_key=True),
    )

    # Migrate existing responsible_person_id to assignees
    op.execute("""
        INSERT INTO nc_assignees (non_conformity_id, personnel_id)
        SELECT id, responsible_person_id FROM non_conformities
        WHERE responsible_person_id IS NOT NULL
    """)

    op.execute("""
        INSERT INTO ca_assignees (corrective_action_id, personnel_id)
        SELECT id, responsible_person_id FROM corrective_actions
        WHERE responsible_person_id IS NOT NULL
    """)

    # Make responsible_person_id nullable
    op.alter_column('non_conformities', 'responsible_person_id',
                     existing_type=sa.Integer(), nullable=True)
    op.alter_column('corrective_actions', 'responsible_person_id',
                     existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column('non_conformities', 'responsible_person_id',
                     existing_type=sa.Integer(), nullable=False)
    op.alter_column('corrective_actions', 'responsible_person_id',
                     existing_type=sa.Integer(), nullable=False)
    op.drop_table('ca_assignees')
    op.drop_table('nc_assignees')
