"""add_asset_eol_date

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-04-14 00:02:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'k4l5m6n7o8p9'
down_revision = 'j3k4l5m6n7o8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('assets', sa.Column('eol_date', sa.Date(), nullable=True, comment='EoL (End of Life) 만료일'))


def downgrade() -> None:
    op.drop_column('assets', 'eol_date')
