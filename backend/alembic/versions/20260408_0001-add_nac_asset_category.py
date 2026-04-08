"""add_nac_asset_category

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-04-08 00:01:00.000000

보안 장비(HW-SEC) 하위에 NAC(Network Access Control) 카테고리 추가
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f8a9b0c1d2e3'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # HW-SEC 부모 카테고리의 id 조회
    result = conn.execute(
        sa.text("SELECT id FROM asset_categories WHERE code = 'HW-SEC'")
    ).fetchone()

    if result is None:
        return  # HW-SEC가 없으면 스킵 (seed가 아직 안 돌았을 수 있음)

    parent_id = result[0]

    # 이미 존재하는지 확인
    existing = conn.execute(
        sa.text("SELECT id FROM asset_categories WHERE code = 'HW-SEC-NAC'")
    ).fetchone()

    if existing is None:
        conn.execute(
            sa.text(
                "INSERT INTO asset_categories (code, name, level, parent_id, is_active, sort_order, created_at, updated_at) "
                "VALUES (:code, :name, :level, :parent_id, :is_active, :sort_order, NOW(), NOW())"
            ),
            {
                "code": "HW-SEC-NAC",
                "name": "NAC",
                "level": 3,
                "parent_id": parent_id,
                "is_active": True,
                "sort_order": 5,
            },
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM asset_categories WHERE code = 'HW-SEC-NAC'")
    )
