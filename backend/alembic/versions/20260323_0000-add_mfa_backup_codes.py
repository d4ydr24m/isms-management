"""add_mfa_backup_codes

Revision ID: a1b2c3d4e5f6
Revises: 4c61ee937a05
Create Date: 2026-03-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '4c61ee937a05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'mfa_backup_codes',
        sa.Text(),
        nullable=True,
        comment='MFA 백업 코드 (해시, JSON 배열)',
    ))


def downgrade() -> None:
    op.drop_column('users', 'mfa_backup_codes')
