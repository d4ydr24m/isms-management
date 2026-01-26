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

from app.main import app as fastapi_app
from app.db.base import Base
from app.core.deps import get_db
from app.core.security import get_password_hash
# 모든 모델을 로드하여 테이블 생성
import app.models  # noqa: F401 - 모든 모델 로드
from app.models.user import User, Role, user_roles
from app.models.department import Department
from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.audit import AuditPlan, NonConformity


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
    fastapi_app.dependency_overrides[get_db] = lambda: db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


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


# ========== 감사 관련 픽스처 ==========

@pytest.fixture
def sample_control_domain(db: Session) -> ControlDomain:
    """테스트용 통제영역 생성"""
    domain = ControlDomain(
        code="1",
        name="관리체계 수립 및 운영",
        description="ISMS 관리체계 수립",
        sort_order=1,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@pytest.fixture
def sample_control_category(db: Session, sample_control_domain: ControlDomain) -> ControlCategory:
    """테스트용 통제항목 카테고리 생성"""
    category = ControlCategory(
        domain_id=sample_control_domain.id,
        code="1.1",
        name="관리체계 기반 마련",
        description="관리체계 기반 마련",
        sort_order=1,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@pytest.fixture
def sample_control_items(db: Session, sample_control_category: ControlCategory) -> list:
    """테스트용 통제항목 목록 생성"""
    items = []
    for i in range(1, 4):
        item = ControlItem(
            category_id=sample_control_category.id,
            code=f"1.1.{i}",
            title=f"통제항목 {i}",
            description=f"통제항목 {i} 설명",
            is_required=True,
            sort_order=i,
        )
        db.add(item)
        items.append(item)
    db.commit()
    for item in items:
        db.refresh(item)
    return items


@pytest.fixture
def sample_audit_plan(db: Session, test_admin_user: User) -> AuditPlan:
    """테스트용 감사 계획 생성"""
    from datetime import date
    plan = AuditPlan(
        title="2024년 1차 내부감사",
        description="연간 내부감사",
        audit_type="internal",
        start_date=date(2024, 3, 1),
        end_date=date(2024, 3, 15),
        scope="전사 정보보호 관리체계",
        control_domains="1,2",
        lead_auditor_id=test_admin_user.id,
        status="planning",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@pytest.fixture
def sample_non_conformity(
    db: Session, sample_audit_plan: AuditPlan,
    sample_control_items: list, test_user: User
) -> NonConformity:
    """테스트용 부적합 생성"""
    from datetime import date
    nc = NonConformity(
        audit_plan_id=sample_audit_plan.id,
        control_item_id=sample_control_items[0].id,
        nc_type="major",
        severity="high",
        title="테스트 부적합",
        description="테스트",
        requirement="테스트",
        responsible_person_id=test_user.id,
        detected_at=date.today(),
        due_date=date(2024, 4, 30),
        status="open",
    )
    db.add(nc)
    db.commit()
    db.refresh(nc)
    return nc


# ========== 자산 관련 픽스처 (Phase 2) ==========

@pytest.fixture
def test_asset_type(db: Session):
    """테스트용 자산 유형 생성"""
    from app.models.asset import AssetType

    asset_type = AssetType(
        code="SRV",
        name="서버",
        description="서버 자산",
        is_custom=False,
        is_active=True,
        sort_order=1,
    )
    db.add(asset_type)
    db.commit()
    db.refresh(asset_type)
    return asset_type


@pytest.fixture
def test_asset(db: Session, test_asset_type, test_department: Department, test_user: User):
    """테스트용 자산 생성"""
    from app.models.asset import Asset

    asset = Asset(
        asset_code="AST-SRV-2024-001",
        name="테스트 서버",
        description="테스트용 서버 자산",
        asset_type_id=test_asset_type.id,
        department_id=test_department.id,
        owner_id=test_user.id,
        location="서버실 A",
        ip_address="192.168.1.100",
        status="운영",
        is_active=True,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


# ========== 위험 관련 픽스처 (Phase 2) ==========

@pytest.fixture
def test_threat_category(db: Session):
    """테스트용 위협 분류 생성"""
    from app.models.risk import ThreatCategory

    category = ThreatCategory(
        code="TC-TEST",
        name="테스트 위협 분류",
        description="테스트용 위협 분류",
        sort_order=1,
        is_active=True,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@pytest.fixture
def test_threat(db: Session, test_threat_category):
    """테스트용 위협 생성"""
    from app.models.risk import Threat

    threat = Threat(
        code="T-TEST-001",
        name="테스트 위협",
        description="테스트용 위협",
        category_id=test_threat_category.id,
        threat_level=2,  # 중
        is_custom=False,
        is_active=True,
    )
    db.add(threat)
    db.commit()
    db.refresh(threat)
    return threat


@pytest.fixture
def test_vulnerability_category(db: Session):
    """테스트용 취약점 분류 생성"""
    from app.models.risk import VulnerabilityCategory

    category = VulnerabilityCategory(
        code="VC-TEST",
        name="테스트 취약점 분류",
        description="테스트용 취약점 분류",
        sort_order=1,
        is_active=True,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@pytest.fixture
def test_vulnerability(db: Session, test_vulnerability_category):
    """테스트용 취약점 생성"""
    from app.models.risk import Vulnerability

    vulnerability = Vulnerability(
        code="V-TEST-001",
        name="테스트 취약점",
        description="테스트용 취약점",
        category_id=test_vulnerability_category.id,
        vulnerability_level=2,  # 중
        is_custom=False,
        is_active=True,
    )
    db.add(vulnerability)
    db.commit()
    db.refresh(vulnerability)
    return vulnerability


@pytest.fixture
def test_risk_scenario(db: Session, test_user: User):
    """테스트용 위험 평가 시나리오 생성"""
    from datetime import date
    from app.models.risk import RiskScenario

    scenario = RiskScenario(
        name="테스트 위험 시나리오",
        description="테스트용 위험 평가 시나리오",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=30),
        status="in_progress",
        created_by=test_user.id,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@pytest.fixture
def test_risk_assessment(
    db: Session, test_risk_scenario, test_asset, test_threat, test_vulnerability
):
    """테스트용 위험 평가 생성"""
    from app.models.risk import RiskAssessment

    assessment = RiskAssessment(
        scenario_id=test_risk_scenario.id,
        asset_id=test_asset.id,
        threat_id=test_threat.id,
        vulnerability_id=test_vulnerability.id,
        asset_value=2,  # 중
        threat_level=2,  # 중
        vulnerability_level=2,  # 중
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@pytest.fixture
def test_doa_config(db: Session, test_admin_user: User):
    """테스트용 DoA 설정 생성"""
    from datetime import date
    from app.models.risk import DoAConfig

    config = DoAConfig(
        threshold_value=12,  # DoR >= 12인 경우 DoA 초과
        effective_date=date.today(),
        approved_by=test_admin_user.id,
        approval_date=date.today(),
        remarks="테스트 DoA 기준",
        is_active=True,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@pytest.fixture
def test_risk_treatment_plan(db: Session, test_risk_assessment, test_user: User):
    """테스트용 위험 처리 계획 생성"""
    from datetime import date
    from app.models.risk import RiskTreatmentPlan

    plan = RiskTreatmentPlan(
        risk_assessment_id=test_risk_assessment.id,
        strategy="reduce",
        description="테스트 위험 처리 계획",
        assignee_id=test_user.id,
        due_date=date.today() + timedelta(days=90),
        budget=1000000,
        status="planned",
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan
