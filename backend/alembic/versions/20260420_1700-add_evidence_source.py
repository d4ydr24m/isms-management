"""add_evidence_source

Revision ID: evidence_source_01
Revises: nc_evidence_map_01
Create Date: 2026-04-20 17:00:00.000000

증적 출처 분리: '증적 관리'(library) vs '결함 증적 관리'(nc_finding).
기존 행은 모두 library 로 채운다 (NOT NULL 제약 전에 backfill).
"""
from alembic import op
import sqlalchemy as sa


revision = "evidence_source_01"
down_revision = "nc_evidence_map_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) 먼저 nullable=True 로 컬럼 추가
    op.add_column(
        "evidences",
        sa.Column(
            "source",
            sa.String(length=20),
            nullable=True,
            server_default="library",
            comment="증적 출처 (library: 일반 증적 / nc_finding: 결함 증적)",
        ),
    )
    # 2) 기존 데이터는 모두 library 로 백필
    op.execute("UPDATE evidences SET source = 'library' WHERE source IS NULL")
    # 3) NOT NULL 로 잠그고 인덱스 생성
    op.alter_column("evidences", "source", nullable=False)
    op.create_index("ix_evidences_source", "evidences", ["source"])


def downgrade() -> None:
    op.drop_index("ix_evidences_source", table_name="evidences")
    op.drop_column("evidences", "source")
