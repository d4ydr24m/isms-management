"""change_responsible_person_fk_to_personnel

Revision ID: 8fbb7c965416
Revises: i2j3k4l5m6n7
Create Date: 2026-04-09 05:17:39.148705

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '8fbb7c965416'
down_revision = 'i2j3k4l5m6n7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old FK constraints first
    op.drop_constraint('non_conformities_responsible_person_id_fkey', 'non_conformities', type_='foreignkey')
    op.drop_constraint('corrective_actions_responsible_person_id_fkey', 'corrective_actions', type_='foreignkey')

    # Map existing user IDs to personnel IDs by matching email
    op.execute("""
        UPDATE non_conformities nc
        SET responsible_person_id = p.id
        FROM users u
        JOIN personnel p ON u.email = p.email
        WHERE nc.responsible_person_id = u.id
    """)

    op.execute("""
        UPDATE corrective_actions ca
        SET responsible_person_id = p.id
        FROM users u
        JOIN personnel p ON u.email = p.email
        WHERE ca.responsible_person_id = u.id
    """)

    # Create new FK constraints pointing to personnel
    op.create_foreign_key(
        'non_conformities_responsible_person_id_fkey',
        'non_conformities', 'personnel',
        ['responsible_person_id'], ['id']
    )

    op.create_foreign_key(
        'corrective_actions_responsible_person_id_fkey',
        'corrective_actions', 'personnel',
        ['responsible_person_id'], ['id']
    )


def downgrade() -> None:
    # Map personnel IDs back to user IDs by matching email
    op.execute("""
        UPDATE non_conformities nc
        SET responsible_person_id = u.id
        FROM personnel p
        JOIN users u ON p.email = u.email
        WHERE nc.responsible_person_id = p.id
    """)

    op.execute("""
        UPDATE corrective_actions ca
        SET responsible_person_id = u.id
        FROM personnel p
        JOIN users u ON p.email = u.email
        WHERE ca.responsible_person_id = p.id
    """)

    op.drop_constraint('non_conformities_responsible_person_id_fkey', 'non_conformities', type_='foreignkey')
    op.create_foreign_key(
        'non_conformities_responsible_person_id_fkey',
        'non_conformities', 'users',
        ['responsible_person_id'], ['id']
    )

    op.drop_constraint('corrective_actions_responsible_person_id_fkey', 'corrective_actions', type_='foreignkey')
    op.create_foreign_key(
        'corrective_actions_responsible_person_id_fkey',
        'corrective_actions', 'users',
        ['responsible_person_id'], ['id']
    )
