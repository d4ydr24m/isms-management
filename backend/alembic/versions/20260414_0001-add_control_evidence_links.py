"""add_control_evidence_links

Revision ID: a1b2c3d4e5f6
Revises: fa39c4e08b59
Create Date: 2026-04-14 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'j3k4l5m6n7o8'
down_revision = 'fa39c4e08b59'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'control_evidence_links',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('control_item_id', sa.Integer(), nullable=False, comment='통제항목 ID'),
        sa.Column('source_type', sa.String(50), nullable=False, comment='출처 모듈'),
        sa.Column('source_id', sa.Integer(), nullable=True, comment='출처 레코드 ID'),
        sa.Column('source_label', sa.String(200), nullable=False, comment='출처 표시명'),
        sa.Column('source_url', sa.String(500), nullable=False, comment='프론트엔드 라우트'),
        sa.Column('description', sa.Text(), nullable=True, comment='증적 출처 설명'),
        sa.Column('created_by', sa.Integer(), nullable=True, comment='생성자 ID'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['control_item_id'], ['control_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_control_evidence_links_control_item_id', 'control_evidence_links', ['control_item_id'])
    op.create_index('ix_control_evidence_links_source_type', 'control_evidence_links', ['source_type'])


def downgrade() -> None:
    op.drop_index('ix_control_evidence_links_source_type')
    op.drop_index('ix_control_evidence_links_control_item_id')
    op.drop_table('control_evidence_links')
