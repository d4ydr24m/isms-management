"""add_info_count_to_vuln_check_executions

Revision ID: vuln_info_count_01
Revises: importance_score_01
Create Date: 2026-04-17 17:00:00.000000

INFO 항목(참조용 점검 결과)을 별도 컬럼에 저장한다.
기존 severity_low 컬럼은 유지하되 현행 점검 스크립트가 Low 티어를
사용하지 않으므로 항상 0으로 채워진다.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'vuln_info_count_01'
down_revision = 'importance_score_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'vuln_check_executions',
        sa.Column(
            'info_count',
            sa.Integer(),
            nullable=True,
            server_default='0',
            comment='정보 (INFO) 항목 수 - 참조용, 취약점 카운트에 미반영',
        ),
    )


def downgrade() -> None:
    op.drop_column('vuln_check_executions', 'info_count')
