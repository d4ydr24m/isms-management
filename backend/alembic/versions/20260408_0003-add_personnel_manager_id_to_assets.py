"""cleanup_personnel_manager_id

Revision ID: h1i2j3k4l5m6
Revises: g9h0i1j2k3l4
Create Date: 2026-04-08 11:30:00.000000

personnel_manager_id 컬럼 정리 (담당자는 AssetAssignment으로 관리)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'h1i2j3k4l5m6'
down_revision = 'g9h0i1j2k3l4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # personnel_manager_id가 있으면 제거 (담당자는 asset_assignments 테이블로 관리)
    op.execute("""
        ALTER TABLE assets DROP COLUMN IF EXISTS personnel_manager_id CASCADE
    """)


def downgrade() -> None:
    op.add_column('assets', sa.Column(
        'personnel_manager_id', sa.Integer(), nullable=True,
        comment='자산 담당자 ID (담당자)'
    ))
    op.create_foreign_key(
        'fk_assets_personnel_manager_id',
        'assets', 'personnel',
        ['personnel_manager_id'], ['id']
    )
