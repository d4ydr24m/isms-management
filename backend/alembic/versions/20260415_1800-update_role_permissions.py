"""update system role permissions with asset, risk, scope

Revision ID: role_perm_202604
Revises: ctrl_std_202604
Create Date: 2026-04-15 18:00:00.000000

Updates all system role permissions to include asset, risk, scope
permissions that were previously missing.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'role_perm_202604'
down_revision = 'ctrl_std_202604'
branch_labels = None
depends_on = None

# New permission sets per role
ROLE_PERMISSIONS = {
    "CISO": "all",
    "보안담당자": (
        "dashboard:read,"
        "scope:read,scope:update,"
        "control:read,control:update,"
        "evidence:*,"
        "asset:*,"
        "risk:*,"
        "audit:*,"
        "user:read"
    ),
    "부서담당자": (
        "dashboard:read,"
        "scope:read,"
        "control:read,"
        "evidence:create,evidence:read,evidence:update,"
        "asset:read,"
        "risk:read"
    ),
    "일반직원": (
        "dashboard:read,"
        "scope:read,"
        "control:read,"
        "evidence:read,"
        "asset:read,"
        "risk:read"
    ),
    "내부감사인": (
        "dashboard:read,"
        "scope:read,"
        "control:read,"
        "evidence:read,"
        "asset:read,"
        "risk:read,"
        "audit:*,"
        "user:read"
    ),
    "외부심사원": (
        "dashboard:read,"
        "scope:read,"
        "control:read,"
        "evidence:read,"
        "asset:read,"
        "risk:read,"
        "audit:read"
    ),
}

# Old permission sets for downgrade
OLD_ROLE_PERMISSIONS = {
    "CISO": "all",
    "보안담당자": "evidence:*,audit:*,control:read,user:read,dashboard:read",
    "부서담당자": "evidence:create,evidence:read,evidence:update,control:read,dashboard:read",
    "일반직원": "evidence:read,control:read,dashboard:read",
    "내부감사인": "audit:*,evidence:read,control:read,dashboard:read",
    "외부심사원": "evidence:read,control:read,audit:read,dashboard:read",
}


def upgrade() -> None:
    conn = op.get_bind()
    for role_name, permissions in ROLE_PERMISSIONS.items():
        conn.execute(
            sa.text(
                "UPDATE roles SET permissions = :perms WHERE name = :name AND is_system_role = true"
            ),
            {"perms": permissions, "name": role_name},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for role_name, permissions in OLD_ROLE_PERMISSIONS.items():
        conn.execute(
            sa.text(
                "UPDATE roles SET permissions = :perms WHERE name = :name AND is_system_role = true"
            ),
            {"perms": permissions, "name": role_name},
        )
