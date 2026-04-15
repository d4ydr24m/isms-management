"""change treatment plan assignee FK from users to personnel

Revision ID: b7d1dfc17e75
Revises: k4l5m6n7o8p9
Create Date: 2026-04-15 02:09:20.886694

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b7d1dfc17e75'
down_revision = 'k4l5m6n7o8p9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 기존 FK 제거 후 personnel 테이블로 변경
    op.drop_constraint('risk_treatment_plans_assignee_id_fkey', 'risk_treatment_plans', type_='foreignkey')
    # 기존 데이터 NULL 처리 (users.id → personnel.id 매핑 불일치 방지)
    op.execute("UPDATE risk_treatment_plans SET assignee_id = NULL WHERE assignee_id IS NOT NULL")
    op.create_foreign_key(
        'risk_treatment_plans_assignee_id_fkey',
        'risk_treatment_plans', 'personnel',
        ['assignee_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('risk_treatment_plans_assignee_id_fkey', 'risk_treatment_plans', type_='foreignkey')
    op.execute("UPDATE risk_treatment_plans SET assignee_id = NULL WHERE assignee_id IS NOT NULL")
    op.create_foreign_key(
        'risk_treatment_plans_assignee_id_fkey',
        'risk_treatment_plans', 'users',
        ['assignee_id'], ['id'],
    )
