"""add_nc_ai_hint

Revision ID: nc_ai_hint_01
Revises: drop_nc_evidence_01
Create Date: 2026-04-22 15:00:00.000000

NonConformity 에 AI 초안 생성 시 모델에게 전달할 심사원 추가 지시·용어 교정을
저장할 `ai_hint` 컬럼 (선택) 추가. 도메인 용어 혼동 (예: '이전 비밀번호 기억') 을
심사원이 직접 교정해 줄 수 있게 한다.
"""
from alembic import op
import sqlalchemy as sa


revision = "nc_ai_hint_01"
down_revision = "drop_nc_evidence_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "non_conformities",
        sa.Column(
            "ai_hint",
            sa.Text(),
            nullable=True,
            comment="AI 초안 생성용 추가 힌트 (선택)",
        ),
    )


def downgrade() -> None:
    op.drop_column("non_conformities", "ai_hint")
