"""add_asset_multi_category_and_pms

Revision ID: a1b2c3d4e5f6
Revises: f8a9b0c1d2e3
Create Date: 2026-04-08 00:02:00.000000

자산-분류 다대다(M2M) 관계로 전환:
- asset_category_mappings 테이블 생성
- 기존 assets.category_id 데이터를 매핑 테이블로 이전
- assets.category_id 컬럼 제거
- PMS(Patch Management System) 카테고리 추가
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g9h0i1j2k3l4'
down_revision = 'f8a9b0c1d2e3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. asset_category_mappings 테이블 생성
    op.create_table(
        'asset_category_mappings',
        sa.Column('asset_id', sa.Integer(), sa.ForeignKey('assets.id'), primary_key=True),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('asset_categories.id'), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    conn = op.get_bind()

    # 2. 기존 category_id 데이터를 매핑 테이블로 이전
    conn.execute(
        sa.text(
            "INSERT INTO asset_category_mappings (asset_id, category_id, created_at) "
            "SELECT id, category_id, NOW() "
            "FROM assets WHERE category_id IS NOT NULL"
        )
    )

    # 3. assets.category_id 컬럼 제거
    op.drop_constraint(
        'assets_category_id_fkey', 'assets', type_='foreignkey'
    )
    op.drop_column('assets', 'category_id')

    # 4. PMS 카테고리 추가
    result = conn.execute(
        sa.text("SELECT id FROM asset_categories WHERE code = 'HW-SEC'")
    ).fetchone()

    if result:
        parent_id = result[0]
        existing = conn.execute(
            sa.text("SELECT id FROM asset_categories WHERE code = 'HW-SEC-PMS'")
        ).fetchone()

        if existing is None:
            conn.execute(
                sa.text(
                    "INSERT INTO asset_categories (code, name, level, parent_id, is_active, sort_order, created_at, updated_at) "
                    "VALUES (:code, :name, :level, :parent_id, :is_active, :sort_order, NOW(), NOW())"
                ),
                {
                    "code": "HW-SEC-PMS",
                    "name": "PMS",
                    "level": 3,
                    "parent_id": parent_id,
                    "is_active": True,
                    "sort_order": 6,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()

    # 1. assets.category_id 컬럼 재추가
    op.add_column(
        'assets',
        sa.Column('category_id', sa.Integer(), nullable=True, comment='자산 분류 ID')
    )
    op.create_foreign_key(
        'assets_category_id_fkey', 'assets', 'asset_categories',
        ['category_id'], ['id']
    )

    # 2. 매핑 테이블에서 첫 번째 분류를 category_id로 복원
    conn.execute(
        sa.text(
            "UPDATE assets SET category_id = m.category_id "
            "FROM ( "
            "  SELECT DISTINCT ON (asset_id) asset_id, category_id "
            "  FROM asset_category_mappings "
            "  ORDER BY asset_id, created_at "
            ") m "
            "WHERE assets.id = m.asset_id"
        )
    )

    # 3. 매핑 테이블 제거
    op.drop_table('asset_category_mappings')

    # 4. PMS 카테고리 제거
    conn.execute(
        sa.text("DELETE FROM asset_categories WHERE code = 'HW-SEC-PMS'")
    )
