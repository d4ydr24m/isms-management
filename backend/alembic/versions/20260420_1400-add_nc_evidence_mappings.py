"""add_nc_evidence_mappings

Revision ID: nc_evidence_map_01
Revises: llm_suggestions_01
Create Date: 2026-04-20 14:00:00.000000

부적합-증적 연결 테이블. 같은 (non_conformity_id, evidence_id) 조합은 한 번만
존재해야 하므로 UniqueConstraint 를 둔다. 양측 FK 는 CASCADE 로 삭제 전파.
"""
from alembic import op
import sqlalchemy as sa


revision = "nc_evidence_map_01"
down_revision = "llm_suggestions_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nc_evidence_mappings",
        sa.Column("id", sa.Integer(), primary_key=True, index=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column(
            "non_conformity_id",
            sa.Integer(),
            sa.ForeignKey("non_conformities.id", ondelete="CASCADE"),
            nullable=False,
            comment="부적합 ID",
        ),
        sa.Column(
            "evidence_id",
            sa.Integer(),
            sa.ForeignKey("evidences.id", ondelete="CASCADE"),
            nullable=False,
            comment="증적 ID",
        ),
        sa.Column(
            "mapped_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            comment="매핑한 사용자 ID",
        ),
        sa.Column("mapping_note", sa.Text(), nullable=True, comment="매핑 메모"),
    )
    op.create_unique_constraint(
        "uq_nc_evidence_mappings_nc_evidence",
        "nc_evidence_mappings",
        ["non_conformity_id", "evidence_id"],
    )
    op.create_index(
        "ix_nc_evidence_mappings_non_conformity_id",
        "nc_evidence_mappings",
        ["non_conformity_id"],
    )
    op.create_index(
        "ix_nc_evidence_mappings_evidence_id",
        "nc_evidence_mappings",
        ["evidence_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_nc_evidence_mappings_evidence_id", table_name="nc_evidence_mappings"
    )
    op.drop_index(
        "ix_nc_evidence_mappings_non_conformity_id", table_name="nc_evidence_mappings"
    )
    op.drop_constraint(
        "uq_nc_evidence_mappings_nc_evidence",
        "nc_evidence_mappings",
        type_="unique",
    )
    op.drop_table("nc_evidence_mappings")
