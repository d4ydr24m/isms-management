"""add_isms_scope_fields

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-04-07 00:01:00.000000

ISMS 인증 범위 관리를 위해 자산, 담당자, 부서 테이블에
in_isms_scope 컬럼 추가 및 인증 범위 이력 테이블 생성
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7f8a9b0c1d2'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 자산 테이블에 in_isms_scope 컬럼 추가
    op.add_column('assets', sa.Column(
        'in_isms_scope', sa.Boolean(), nullable=False,
        server_default='true', comment='ISMS 인증 범위 포함 여부',
    ))
    op.add_column('assets', sa.Column(
        'scope_reason', sa.String(length=500), nullable=True,
        comment='범위 포함/제외 사유',
    ))

    # 담당자 테이블에 in_isms_scope 컬럼 추가
    op.add_column('personnel', sa.Column(
        'in_isms_scope', sa.Boolean(), nullable=False,
        server_default='true', comment='ISMS 인증 범위 포함 여부',
    ))
    op.add_column('personnel', sa.Column(
        'scope_reason', sa.String(length=500), nullable=True,
        comment='범위 포함/제외 사유',
    ))

    # 부서 테이블에 in_isms_scope 컬럼 추가
    op.add_column('departments', sa.Column(
        'in_isms_scope', sa.Boolean(), nullable=False,
        server_default='true', comment='ISMS 인증 범위 포함 여부',
    ))
    op.add_column('departments', sa.Column(
        'scope_reason', sa.String(length=500), nullable=True,
        comment='범위 포함/제외 사유',
    ))

    # 인증 범위 변경 이력 테이블
    op.create_table('isms_scope_changes',
        sa.Column('entity_type', sa.String(length=20), nullable=False,
                  comment='대상 유형 (asset/personnel/department)'),
        sa.Column('entity_id', sa.Integer(), nullable=False,
                  comment='대상 ID'),
        sa.Column('old_scope', sa.Boolean(), nullable=False,
                  comment='이전 범위 상태'),
        sa.Column('new_scope', sa.Boolean(), nullable=False,
                  comment='새 범위 상태'),
        sa.Column('reason', sa.String(length=500), nullable=True,
                  comment='변경 사유'),
        sa.Column('changed_by', sa.Integer(), nullable=False,
                  comment='변경자 ID'),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False,
                  comment='변경 일시'),
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_isms_scope_changes_id'), 'isms_scope_changes', ['id'], unique=False)
    op.create_index('ix_isms_scope_changes_entity', 'isms_scope_changes', ['entity_type', 'entity_id'])


def downgrade() -> None:
    op.drop_table('isms_scope_changes')
    op.drop_column('departments', 'scope_reason')
    op.drop_column('departments', 'in_isms_scope')
    op.drop_column('personnel', 'scope_reason')
    op.drop_column('personnel', 'in_isms_scope')
    op.drop_column('assets', 'scope_reason')
    op.drop_column('assets', 'in_isms_scope')
