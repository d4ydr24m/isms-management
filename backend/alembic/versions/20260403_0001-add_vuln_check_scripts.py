"""add_vuln_check_scripts

Revision ID: a1b2c3d4e5f6
Revises: 20260326_0001
Create Date: 2026-04-03 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5e6f7a8b9c0'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 취약점 점검 스크립트 테이블
    op.create_table('vuln_check_scripts',
        sa.Column('name', sa.String(length=200), nullable=False, comment='스크립트명'),
        sa.Column('description', sa.Text(), nullable=True, comment='스크립트 설명'),
        sa.Column('script_type', sa.String(length=50), nullable=False, comment='스크립트 유형 (python/shell/powershell/custom)'),
        sa.Column('file_path', sa.String(length=500), nullable=False, comment='스크립트 파일 저장 경로 (MinIO)'),
        sa.Column('file_name', sa.String(length=255), nullable=False, comment='원본 파일명'),
        sa.Column('file_size', sa.Integer(), nullable=True, comment='파일 크기 (bytes)'),
        sa.Column('version', sa.String(length=50), nullable=False, server_default='1.0', comment='스크립트 버전'),
        sa.Column('category_id', sa.Integer(), nullable=True, comment='취약점 분류 ID'),
        sa.Column('target_asset_type_id', sa.Integer(), nullable=True, comment='대상 자산 유형 ID'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', comment='활성 상태'),
        sa.Column('uploaded_by', sa.Integer(), nullable=False, comment='업로더 ID'),
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['vulnerability_categories.id']),
        sa.ForeignKeyConstraint(['target_asset_type_id'], ['asset_types.id']),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vuln_check_scripts_id'), 'vuln_check_scripts', ['id'], unique=False)

    # 취약점 점검 스케줄 테이블
    op.create_table('vuln_check_schedules',
        sa.Column('script_id', sa.Integer(), nullable=False, comment='스크립트 ID'),
        sa.Column('name', sa.String(length=200), nullable=False, comment='스케줄명'),
        sa.Column('description', sa.Text(), nullable=True, comment='스케줄 설명'),
        sa.Column('cron_expression', sa.String(length=100), nullable=False, comment='Cron 표현식'),
        sa.Column('target_asset_ids', sa.Text(), nullable=True, comment='대상 자산 ID 목록 (JSON)'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', comment='활성 상태'),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True, comment='마지막 실행 일시'),
        sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True, comment='다음 실행 예정 일시'),
        sa.Column('created_by', sa.Integer(), nullable=False, comment='생성자 ID'),
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['script_id'], ['vuln_check_scripts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vuln_check_schedules_id'), 'vuln_check_schedules', ['id'], unique=False)
    op.create_index(op.f('ix_vuln_check_schedules_script_id'), 'vuln_check_schedules', ['script_id'], unique=False)

    # 취약점 점검 실행 결과 테이블
    op.create_table('vuln_check_executions',
        sa.Column('script_id', sa.Integer(), nullable=False, comment='스크립트 ID'),
        sa.Column('schedule_id', sa.Integer(), nullable=True, comment='스케줄 ID'),
        sa.Column('asset_id', sa.Integer(), nullable=False, comment='대상 자산 ID'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending', comment='실행 상태'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True, comment='실행 시작 일시'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True, comment='실행 완료 일시'),
        sa.Column('result_summary', sa.Text(), nullable=True, comment='결과 요약'),
        sa.Column('result_detail', sa.Text(), nullable=True, comment='상세 결과 (JSON)'),
        sa.Column('vulnerabilities_found', sa.Integer(), nullable=True, server_default='0', comment='발견된 취약점 수'),
        sa.Column('severity_high', sa.Integer(), nullable=True, server_default='0', comment='고위험 취약점 수'),
        sa.Column('severity_medium', sa.Integer(), nullable=True, server_default='0', comment='중위험 취약점 수'),
        sa.Column('severity_low', sa.Integer(), nullable=True, server_default='0', comment='저위험 취약점 수'),
        sa.Column('executed_by', sa.Integer(), nullable=True, comment='실행자 ID'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='에러 메시지'),
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['script_id'], ['vuln_check_scripts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['vuln_check_schedules.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.ForeignKeyConstraint(['executed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vuln_check_executions_id'), 'vuln_check_executions', ['id'], unique=False)
    op.create_index(op.f('ix_vuln_check_executions_script_id'), 'vuln_check_executions', ['script_id'], unique=False)
    op.create_index(op.f('ix_vuln_check_executions_schedule_id'), 'vuln_check_executions', ['schedule_id'], unique=False)
    op.create_index(op.f('ix_vuln_check_executions_asset_id'), 'vuln_check_executions', ['asset_id'], unique=False)


def downgrade() -> None:
    op.drop_table('vuln_check_executions')
    op.drop_table('vuln_check_schedules')
    op.drop_table('vuln_check_scripts')
