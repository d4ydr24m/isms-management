"""consolidate schema updates

Adds all schema changes that were previously applied manually:
- system_settings table
- control_items: key_checks, related_laws, evidence_examples columns
- users: ip_whitelist_enabled, allowed_ips columns
- assets: importance, personnel_owner_id columns
- asset_assignments: personnel_id column, user_id nullable

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-26 00:01:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- system_settings table ---
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'system_settings' not in inspector.get_table_names():
        op.create_table(
            'system_settings',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('key', sa.String(length=100), nullable=False),
            sa.Column('value', sa.Text(), nullable=False, server_default=''),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_system_settings_key', 'system_settings', ['key'], unique=True)

    # --- control_items: additional fields ---
    _add_column_if_not_exists('control_items', 'key_checks', sa.Text(), nullable=True)
    _add_column_if_not_exists('control_items', 'related_laws', sa.Text(), nullable=True)
    _add_column_if_not_exists('control_items', 'evidence_examples', sa.Text(), nullable=True)

    # --- users: IP whitelist fields ---
    _add_column_if_not_exists('users', 'ip_whitelist_enabled', sa.Boolean(), server_default='false', nullable=True)
    _add_column_if_not_exists('users', 'allowed_ips', sa.Text(), nullable=True)

    # --- assets: personnel owner ---
    _add_column_if_not_exists('assets', 'personnel_owner_id', sa.Integer(), nullable=True)
    # Add FK constraint for personnel_owner_id
    try:
        op.create_foreign_key(
            'fk_assets_personnel_owner_id',
            'assets', 'personnel',
            ['personnel_owner_id'], ['id'],
        )
    except Exception:
        pass  # FK may already exist

    # --- asset_assignments: make user_id nullable, add personnel_id ---
    try:
        op.alter_column('asset_assignments', 'user_id', nullable=True)
    except Exception:
        pass
    _add_column_if_not_exists('asset_assignments', 'personnel_id', sa.Integer(), nullable=True)
    try:
        op.create_foreign_key(
            'fk_asset_assignments_personnel_id',
            'asset_assignments', 'personnel',
            ['personnel_id'], ['id'],
        )
    except Exception:
        pass
    op.create_index('ix_asset_assignments_personnel_id', 'asset_assignments', ['personnel_id'], unique=False, if_not_exists=True)

    # --- risk_treatment_control_links table ---
    if 'risk_treatment_control_links' not in inspector.get_table_names():
        op.create_table(
            'risk_treatment_control_links',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('treatment_plan_id', sa.Integer(), nullable=False),
            sa.Column('control_item_id', sa.Integer(), nullable=False),
            sa.Column('link_type', sa.String(length=20), nullable=False, server_default='primary'),
            sa.Column('effectiveness_rating', sa.Float(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('remarks', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['treatment_plan_id'], ['risk_treatment_plans.id']),
            sa.ForeignKeyConstraint(['control_item_id'], ['control_items.id']),
            sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        )
        op.create_index('ix_risk_treatment_control_links_treatment_plan_id', 'risk_treatment_control_links', ['treatment_plan_id'])
        op.create_index('ix_risk_treatment_control_links_control_item_id', 'risk_treatment_control_links', ['control_item_id'])


def downgrade() -> None:
    # --- asset_assignments ---
    try:
        op.drop_constraint('fk_asset_assignments_personnel_id', 'asset_assignments', type_='foreignkey')
    except Exception:
        pass
    op.drop_index('ix_asset_assignments_personnel_id', table_name='asset_assignments', if_exists=True)
    op.drop_column('asset_assignments', 'personnel_id')
    op.alter_column('asset_assignments', 'user_id', nullable=False)

    # --- risk_treatment_control_links ---
    op.drop_table('risk_treatment_control_links')

    # --- assets ---
    try:
        op.drop_constraint('fk_assets_personnel_owner_id', 'assets', type_='foreignkey')
    except Exception:
        pass
    op.drop_column('assets', 'personnel_owner_id')

    # --- users ---
    op.drop_column('users', 'allowed_ips')
    op.drop_column('users', 'ip_whitelist_enabled')

    # --- control_items ---
    op.drop_column('control_items', 'evidence_examples')
    op.drop_column('control_items', 'related_laws')
    op.drop_column('control_items', 'key_checks')

    # --- system_settings ---
    op.drop_index('ix_system_settings_key', table_name='system_settings', if_exists=True)
    op.drop_table('system_settings')


def _add_column_if_not_exists(table_name: str, column_name: str, column_type, **kwargs):
    """Add a column only if it doesn't already exist."""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    if column_name not in columns:
        op.add_column(table_name, sa.Column(column_name, column_type, **kwargs))
