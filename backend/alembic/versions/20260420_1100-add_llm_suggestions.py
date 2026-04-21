"""add_llm_suggestions

Revision ID: llm_suggestions_01
Revises: vuln_info_count_01
Create Date: 2026-04-20 11:00:00.000000

로컬 LLM(Qwen2.5-VL)이 생성한 보완조치내역서 초안을 저장하는 테이블.
- 부적합(non_conformities)에 1:N으로 연결
- 비동기 Celery 태스크로 생성되므로 task_id 폴링 키 제공
"""
from alembic import op
import sqlalchemy as sa


revision = 'llm_suggestions_01'
down_revision = 'vuln_info_count_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'llm_suggestions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column(
            'non_conformity_id',
            sa.Integer(),
            sa.ForeignKey('non_conformities.id', ondelete='CASCADE'),
            nullable=False,
            comment='부적합 ID',
        ),
        sa.Column(
            'task_id',
            sa.String(length=64),
            nullable=False,
            comment='Celery task ID',
        ),
        sa.Column(
            'status',
            sa.String(length=20),
            nullable=False,
            server_default='pending',
            comment='상태 (pending/running/succeeded/failed)',
        ),
        sa.Column(
            'model_name',
            sa.String(length=100),
            nullable=False,
            comment='사용한 LLM 모델명',
        ),
        sa.Column(
            'evidence_ids',
            sa.Text(),
            nullable=True,
            comment='첨부 증적 ID 목록 (JSON)',
        ),
        sa.Column('result_text', sa.Text(), nullable=True, comment='생성된 초안 본문'),
        sa.Column(
            'error_message', sa.Text(), nullable=True, comment='실패 시 사용자용 메시지'
        ),
        sa.Column(
            'created_by',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
            comment='생성 요청자',
        ),
        sa.Column('completed_at', sa.DateTime(), nullable=True, comment='완료 또는 실패 시각'),
    )
    op.create_unique_constraint(
        'uq_llm_suggestions_task_id', 'llm_suggestions', ['task_id']
    )
    op.create_index(
        'ix_llm_suggestions_non_conformity_id',
        'llm_suggestions',
        ['non_conformity_id'],
    )
    op.create_index(
        'ix_llm_suggestions_task_id', 'llm_suggestions', ['task_id']
    )


def downgrade() -> None:
    op.drop_index('ix_llm_suggestions_task_id', table_name='llm_suggestions')
    op.drop_index('ix_llm_suggestions_non_conformity_id', table_name='llm_suggestions')
    op.drop_constraint(
        'uq_llm_suggestions_task_id', 'llm_suggestions', type_='unique'
    )
    op.drop_table('llm_suggestions')
