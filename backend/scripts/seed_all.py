"""
Seed all default data: threats, vulnerabilities, roles, departments.
Also ensures all required DB columns exist.
Safe to run multiple times - skips existing data.
"""
import subprocess
import sys
import os

# Change to backend directory
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Schema is managed by Alembic migrations.
# The startup command runs 'alembic upgrade head' before this script.

# 1. Seed threats & vulnerabilities from SQL
sql_file = os.path.join("scripts", "seed_threats_vulnerabilities.sql")
if os.path.exists(sql_file):
    db_url = os.environ.get("DATABASE_URL", "postgresql://isms_user:isms_password@postgres:5432/isms_db")
    # Parse DB URL
    import re
    m = re.match(r"postgresql://(\w+):(\w+)@([\w.]+):(\d+)/(\w+)", db_url)
    if m:
        user, password, host, port, dbname = m.groups()
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        result = subprocess.run(
            ["psql", "-h", host, "-p", port, "-U", user, "-d", dbname, "-f", sql_file],
            env=env,
            capture_output=True,
            text=True,
        )
        # Count successes (INSERT lines)
        inserts = [l for l in result.stdout.split("\n") if l.startswith("INSERT")]
        errors = [l for l in result.stderr.split("\n") if "ERROR" in l and "duplicate" not in l.lower()]
        print(f"Threats/Vulnerabilities: {len(inserts)} inserts, {len(errors)} errors")
        if errors:
            for e in errors:
                print(f"  {e}")
    else:
        print(f"Could not parse DATABASE_URL: {db_url}")
else:
    print(f"SQL file not found: {sql_file}")

# 2. Seed additional roles and departments
try:
    sys.path.insert(0, os.getcwd())
    from app.core.deps import SessionLocal
    from app.models.user import Role
    from app.models.department import Department

    db = SessionLocal()

    # Ensure "시스템 관리자" role exists
    sys_admin_role = db.query(Role).filter(Role.name == "시스템 관리자").first()
    if not sys_admin_role:
        db.add(Role(
            name="시스템 관리자",
            permissions="system:admin,user:read,user:create,user:update,user:delete,role:read,role:create,role:update,role:delete,dashboard:read",
            is_system_role=True,
        ))
        print("Added role: 시스템 관리자")

    # Ensure default departments exist
    default_depts = [
        ("ROOT", "본사", "기본 조직", None),
    ]
    for code, name, desc, parent_code in default_depts:
        existing = db.query(Department).filter(Department.code == code).first()
        if not existing:
            parent_id = None
            if parent_code:
                parent = db.query(Department).filter(Department.code == parent_code).first()
                parent_id = parent.id if parent else None
            db.add(Department(code=code, name=name, description=desc, parent_id=parent_id, is_active=True))
            print(f"Added department: {name}")

    db.commit()
    db.close()
    print("Seed all completed.")
except Exception as e:
    print(f"Seed error: {e}")
