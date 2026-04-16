"""add importance_score column to asset_valuations

Revision ID: importance_score_01
Revises: role_perm_202604
Create Date: 2026-04-16 16:00:00.000000

Changes importance calculation from MAX(C,I,A) to C+I+A sum method.
Adds importance_score column and backfills existing data.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'importance_score_01'
down_revision = 'role_perm_202604'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. importance_score 컬럼 추가
    op.add_column(
        'asset_valuations',
        sa.Column('importance_score', sa.Integer(), nullable=True,
                  comment='자산 중요도 점수 (C+I+A, 3~9)')
    )

    # 2. 기존 데이터 백필: importance_score = C + I + A
    op.execute("""
        UPDATE asset_valuations
        SET importance_score = confidentiality + integrity + availability
        WHERE confidentiality IS NOT NULL
          AND integrity IS NOT NULL
          AND availability IS NOT NULL
    """)

    # 3. importance_level 재계산: 3-5→1(하), 6-7→2(중), 8-9→3(상)
    op.execute("""
        UPDATE asset_valuations
        SET importance_level = CASE
            WHEN importance_score >= 8 THEN 3
            WHEN importance_score >= 6 THEN 2
            ELSE 1
        END
        WHERE importance_score IS NOT NULL
    """)


def downgrade() -> None:
    # importance_level을 MAX 방식으로 복원
    op.execute("""
        UPDATE asset_valuations
        SET importance_level = GREATEST(confidentiality, integrity, availability)
        WHERE confidentiality IS NOT NULL
          AND integrity IS NOT NULL
          AND availability IS NOT NULL
    """)

    # importance_score 컬럼 제거
    op.drop_column('asset_valuations', 'importance_score')
