"""drop_nc_evidence_column

Revision ID: drop_nc_evidence_01
Revises: nc_evidence_role_01
Create Date: 2026-04-20 21:00:00.000000

부적합(non_conformities) 테이블의 자유서술 `evidence` (근거) 컬럼 제거.
구조화된 증적 연결은 nc_evidence_mappings + NcEvidenceAttachments UI 로 일원화했으며,
상단 상세 테이블의 '증적' 행도 함께 제거되어 이 컬럼은 더 이상 참조되지 않는다.

downgrade 에서는 NULL 허용으로 원복한다 (데이터는 복구되지 않음 — 돌이킬 수 없는 삭제).
"""
from alembic import op
import sqlalchemy as sa


revision = "drop_nc_evidence_01"
down_revision = "nc_evidence_role_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("non_conformities", "evidence")


def downgrade() -> None:
    op.add_column(
        "non_conformities",
        sa.Column("evidence", sa.Text(), nullable=True, comment="근거"),
    )
