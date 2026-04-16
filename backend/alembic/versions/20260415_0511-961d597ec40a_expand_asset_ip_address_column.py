"""expand_asset_ip_address_column

Revision ID: 961d597ec40a
Revises: b7d1dfc17e75
Create Date: 2026-04-15 05:11:15.039073

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '961d597ec40a'
down_revision = 'b7d1dfc17e75'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('assets', 'ip_address',
               existing_type=sa.VARCHAR(length=50),
               type_=sa.String(length=200),
               comment='IP 주소 (단일, 범위, CIDR 지원)',
               existing_comment='IP 주소',
               existing_nullable=True)


def downgrade() -> None:
    op.alter_column('assets', 'ip_address',
               existing_type=sa.String(length=200),
               type_=sa.VARCHAR(length=50),
               comment='IP 주소',
               existing_comment='IP 주소 (단일, 범위, CIDR 지원)',
               existing_nullable=True)
