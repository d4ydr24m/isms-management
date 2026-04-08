"""add_url_and_service_version_to_assets

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-04-08 12:00:00.000000

자산 테이블에 URL, 버전 정보 컬럼 추가
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('assets', sa.Column(
        'url', sa.String(500), nullable=True, comment='URL'
    ))
    op.add_column('assets', sa.Column(
        'service_version', sa.String(100), nullable=True, comment='버전 정보'
    ))


def downgrade() -> None:
    op.drop_column('assets', 'service_version')
    op.drop_column('assets', 'url')
