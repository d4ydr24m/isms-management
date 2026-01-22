"""
데이터베이스 초기화 및 시드 데이터 로딩
"""
import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models import (
    ControlDomain,
    ControlCategory,
    ControlItem,
    Role,
    User,
    Department,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_isms_controls(db: Session) -> None:
    """
    ISMS-P 통제항목 시드 데이터 로딩
    """
    logger.info("Loading ISMS-P control items...")

    # 시드 데이터 파일 읽기
    seeds_path = Path(__file__).parent / "seeds" / "isms_controls.json"
    with open(seeds_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 통제영역 로딩
    domain_map = {}
    for domain_data in data["domains"]:
        domain = db.query(ControlDomain).filter_by(code=domain_data["code"]).first()
        if not domain:
            domain = ControlDomain(**domain_data)
            db.add(domain)
            db.flush()
            logger.info(f"Created domain: {domain.code} - {domain.name}")
        domain_map[domain.code] = domain

    # 통제항목 카테고리 로딩
    category_map = {}
    for category_data in data["categories"]:
        domain_code = category_data.pop("domain_code")
        category = db.query(ControlCategory).filter_by(code=category_data["code"]).first()
        if not category:
            category = ControlCategory(
                domain_id=domain_map[domain_code].id,
                **category_data
            )
            db.add(category)
            db.flush()
            logger.info(f"Created category: {category.code} - {category.name}")
        category_map[category.code] = category

    # 통제항목 로딩
    for control_data in data["control_items"]:
        category_code = control_data.pop("category_code")
        control = db.query(ControlItem).filter_by(code=control_data["code"]).first()
        if not control:
            control = ControlItem(
                category_id=category_map[category_code].id,
                **control_data
            )
            db.add(control)
            logger.info(f"Created control item: {control.code} - {control.title}")

    db.commit()
    logger.info("ISMS-P control items loaded successfully!")


def create_default_roles(db: Session) -> None:
    """
    기본 역할 생성
    """
    logger.info("Creating default roles...")

    roles_data = [
        {
            "name": "CISO",
            "description": "최고정보보호책임자 (Chief Information Security Officer)",
            "permissions": "all",
            "is_system_role": True,
        },
        {
            "name": "보안담당자",
            "description": "정보보호 업무 담당자",
            "permissions": "evidence:*,audit:*,control:read,user:read,dashboard:read",
            "is_system_role": True,
        },
        {
            "name": "부서담당자",
            "description": "각 부서의 정보보호 담당자",
            "permissions": "evidence:create,evidence:read,evidence:update,control:read,dashboard:read",
            "is_system_role": True,
        },
        {
            "name": "일반직원",
            "description": "일반 직원",
            "permissions": "evidence:read,control:read,dashboard:read",
            "is_system_role": True,
        },
        {
            "name": "내부감사인",
            "description": "내부 감사 수행자",
            "permissions": "audit:*,evidence:read,control:read,dashboard:read",
            "is_system_role": True,
        },
        {
            "name": "외부심사원",
            "description": "외부 인증심사원 (읽기 전용)",
            "permissions": "evidence:read,control:read,audit:read,dashboard:read",
            "is_system_role": True,
        },
    ]

    for role_data in roles_data:
        role = db.query(Role).filter_by(name=role_data["name"]).first()
        if not role:
            role = Role(**role_data)
            db.add(role)
            logger.info(f"Created role: {role.name}")

    db.commit()
    logger.info("Default roles created successfully!")


def create_default_department(db: Session) -> Department:
    """
    기본 부서 생성
    """
    logger.info("Creating default department...")

    dept = db.query(Department).filter_by(code="ROOT").first()
    if not dept:
        dept = Department(
            name="본사",
            code="ROOT",
            description="기본 조직",
            is_active=True,
        )
        db.add(dept)
        db.commit()
        logger.info(f"Created department: {dept.name}")

    return dept


def create_admin_user(db: Session, dept: Department) -> None:
    """
    관리자 계정 생성
    """
    logger.info("Creating admin user...")

    admin = db.query(User).filter_by(email="admin@example.com").first()
    if not admin:
        ciso_role = db.query(Role).filter_by(name="CISO").first()

        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("Admin123!@#"),
            name="시스템 관리자",
            phone="010-0000-0000",
            department_id=dept.id,
            is_active=True,
            is_superuser=True,
            is_mfa_enabled=False,
        )
        db.add(admin)
        db.flush()

        if ciso_role:
            admin.roles.append(ciso_role)

        db.commit()
        logger.info("Admin user created: admin@example.com / Admin123!@#")
    else:
        logger.info("Admin user already exists")


def init_db() -> None:
    """
    데이터베이스 초기화 메인 함수
    """
    logger.info("Starting database initialization...")

    db = SessionLocal()
    try:
        # 1. ISMS-P 통제항목 로딩
        load_isms_controls(db)

        # 2. 기본 역할 생성
        create_default_roles(db)

        # 3. 기본 부서 생성
        dept = create_default_department(db)

        # 4. 관리자 계정 생성
        create_admin_user(db, dept)

        logger.info("Database initialization completed successfully!")

    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
