"""add_personnel_table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-25 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 담당자 테이블 생성
    op.create_table(
        'personnel',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False, comment='이름'),
        sa.Column('email', sa.String(length=255), nullable=True, comment='이메일'),
        sa.Column('phone', sa.String(length=20), nullable=True, comment='전화번호'),
        sa.Column('position', sa.String(length=100), nullable=True, comment='직위/직책'),
        sa.Column('department_id', sa.Integer(), nullable=True, comment='부서 ID'),
        sa.Column('user_id', sa.Integer(), nullable=True, comment='연결된 시스템 사용자 ID'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True, comment='활성 상태'),
        sa.Column('note', sa.Text(), nullable=True, comment='비고'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_personnel_id'), 'personnel', ['id'])

    # Asset 테이블에 personnel_owner_id 추가
    op.add_column(
        'assets',
        sa.Column(
            'personnel_owner_id',
            sa.Integer(),
            sa.ForeignKey('personnel.id'),
            nullable=True,
            comment='담당자 소유자 ID',
        ),
    )


def downgrade() -> None:
    op.drop_column('assets', 'personnel_owner_id')
    op.drop_index(op.f('ix_personnel_id'), table_name='personnel')
    op.drop_table('personnel')
