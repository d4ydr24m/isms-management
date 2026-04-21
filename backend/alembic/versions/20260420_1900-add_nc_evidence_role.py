"""add_nc_evidence_role

Revision ID: nc_evidence_role_01
Revises: evidence_source_01
Create Date: 2026-04-20 19:00:00.000000

nc_evidence_mappings 에 role 컬럼 추가. 기존 레코드는 reference 로 채워
사용자가 이후 UI 에서 원하는 역할로 재분류할 수 있도록 한다.
"""
from alembic import op
import sqlalchemy as sa


revision = "nc_evidence_role_01"
down_revision = "evidence_source_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nc_evidence_mappings",
        sa.Column(
            "role",
            sa.String(length=20),
            nullable=False,
            server_default="reference",
            comment="증적 역할 (before/after/support/reference)",
        ),
    )
    op.create_index(
        "ix_nc_evidence_mappings_role",
        "nc_evidence_mappings",
        ["role"],
    )


def downgrade() -> None:
    op.drop_index("ix_nc_evidence_mappings_role", table_name="nc_evidence_mappings")
    op.drop_column("nc_evidence_mappings", "role")
