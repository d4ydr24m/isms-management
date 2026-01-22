"""
테스트 설정 및 공통 픽스처
"""
import os
import pytest
from typing import Generator, Dict, Any
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.core.deps import get_db
from app.core.security import get_password_hash
from app.models.user import User, Role, user_roles
from app.models.department import Department


# 테스트용 SQLite 인메모리 데이터베이스
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator[Session, None, None]:
    """테스트용 DB 세션 오버라이드"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """각 테스트마다 새로운 DB 세션 제공"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """테스트용 FastAPI 클라이언트"""
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_department(db: Session) -> Department:
    """테스트용 부서 생성"""
    dept = Department(
        name="테스트부서",
        code="TEST",
        description="테스트용 부서",
        is_active=True,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@pytest.fixture
def test_role_ciso(db: Session) -> Role:
    """CISO 역할 생성"""
    role = Role(
        name="CISO",
        description="최고정보보호책임자",
        permissions="all",
        is_system_role=True,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@pytest.fixture
def test_role_security_manager(db: Session) -> Role:
    """보안담당자 역할 생성"""
    role = Role(
        name="보안담당자",
        description="정보보호 업무 담당자",
        permissions="evidence:*,audit:*,control:read,user:read,dashboard:read",
        is_system_role=True,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@pytest.fixture
def test_role_employee(db: Session) -> Role:
    """일반직원 역할 생성"""
    role = Role(
        name="일반직원",
        description="일반 직원",
        permissions="evidence:read,control:read,dashboard:read",
        is_system_role=True,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@pytest.fixture
def test_user(db: Session, test_department: Department, test_role_employee: Role) -> User:
    """테스트용 일반 사용자 생성"""
    user = User(
        email="testuser@example.com",
        hashed_password=get_password_hash("TestPass123!"),
        name="테스트 사용자",
        phone="010-1234-5678",
        department_id=test_department.id,
        is_active=True,
        is_superuser=False,
        is_mfa_enabled=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    user.roles.append(test_role_employee)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_admin_user(db: Session, test_department: Department, test_role_ciso: Role) -> User:
    """테스트용 관리자 사용자 생성"""
    user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("Admin123!@#"),
        name="관리자",
        phone="010-0000-0000",
        department_id=test_department.id,
        is_active=True,
        is_superuser=True,
        is_mfa_enabled=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    user.roles.append(test_role_ciso)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_locked_user(db: Session, test_department: Department, test_role_employee: Role) -> User:
    """잠긴 테스트 사용자 생성"""
    user = User(
        email="locked@example.com",
        hashed_password=get_password_hash("TestPass123!"),
        name="잠긴 사용자",
        department_id=test_department.id,
        is_active=True,
        is_superuser=False,
        failed_login_attempts=5,
        locked_until=datetime.utcnow() + timedelta(minutes=30),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    user.roles.append(test_role_employee)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_inactive_user(db: Session, test_department: Department) -> User:
    """비활성 테스트 사용자 생성"""
    user = User(
        email="inactive@example.com",
        hashed_password=get_password_hash("TestPass123!"),
        name="비활성 사용자",
        department_id=test_department.id,
        is_active=False,
        is_superuser=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client: TestClient, test_user: User) -> Dict[str, str]:
    """인증된 사용자 헤더 반환"""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "TestPass123!"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(client: TestClient, test_admin_user: User) -> Dict[str, str]:
    """인증된 관리자 헤더 반환"""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Admin123!@#"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
