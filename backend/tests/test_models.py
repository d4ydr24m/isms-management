"""
Phase 2.0 - 데이터베이스 모델 테스트
SQLAlchemy 모델 관계, 제약조건, 기본값 테스트
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.department import Department
from app.models.user import User, Role, UserRole, AuditorAccount, user_roles
from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import Evidence, EvidenceVersion, EvidenceTemplate, ControlItemEvidence
from app.models.audit import AuditPlan, AuditChecklist, AuditChecklistResult, NonConformity, CorrectiveAction
from app.models.notification import Notification, NotificationSetting
from app.models.audit_log import AuditLog
from app.models.scheduled_task import ScheduledTask, TaskExecution


class TestCustomBase:
    """CustomBase 클래스 테스트"""

    def test_tablename_simple(self):
        """간단한 클래스명에서 테이블명 생성"""
        # User -> users
        assert User.__tablename__ == "users"

    def test_tablename_with_y_suffix(self):
        """y로 끝나는 클래스명에서 테이블명 생성"""
        # Category -> categories
        assert ControlCategory.__tablename__ == "control_categories"

    def test_tablename_camel_case(self):
        """카멜케이스 클래스명에서 테이블명 생성"""
        # ControlDomain -> control_domains
        assert ControlDomain.__tablename__ == "control_domains"
        # AuditPlan -> audit_plans
        assert AuditPlan.__tablename__ == "audit_plans"

    def test_to_dict_method(self, db: Session, test_department: Department):
        """to_dict 메서드 테스트"""
        dept_dict = test_department.to_dict()

        assert isinstance(dept_dict, dict)
        assert "id" in dept_dict
        assert "name" in dept_dict
        assert "code" in dept_dict
        assert dept_dict["name"] == "테스트부서"
        assert dept_dict["code"] == "TEST"


class TestDepartmentModel:
    """Department 모델 테스트"""

    def test_department_creation(self, db: Session):
        """부서 생성 테스트"""
        dept = Department(
            name="정보보호팀",
            code="SEC001",
            description="정보보호 담당 부서",
            is_active=True,
        )
        db.add(dept)
        db.commit()
        db.refresh(dept)

        assert dept.id is not None
        assert dept.name == "정보보호팀"
        assert dept.code == "SEC001"
        assert dept.is_active is True
        assert dept.created_at is not None
        assert dept.updated_at is not None

    def test_department_unique_code_constraint(self, db: Session, test_department: Department):
        """부서 코드 유니크 제약조건 테스트"""
        # 동일한 코드로 부서 생성 시도
        duplicate_dept = Department(
            name="중복부서",
            code=test_department.code,  # 같은 코드
            is_active=True,
        )
        db.add(duplicate_dept)

        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    def test_department_hierarchy(self, db: Session):
        """부서 계층 구조 테스트"""
        # 상위 부서 생성
        parent = Department(name="본부", code="HQ001", is_active=True)
        db.add(parent)
        db.commit()

        # 하위 부서 생성
        child = Department(
            name="개발팀",
            code="DEV001",
            parent_id=parent.id,
            is_active=True,
        )
        db.add(child)
        db.commit()
        db.refresh(child)

        assert child.parent_id == parent.id
        assert child.parent.name == "본부"
        assert parent.children[0].name == "개발팀"

    def test_department_repr(self, db: Session, test_department: Department):
        """부서 __repr__ 테스트"""
        repr_str = repr(test_department)
        assert "Department" in repr_str
        assert test_department.name in repr_str
        assert test_department.code in repr_str


class TestUserModel:
    """User 모델 테스트"""

    def test_user_creation(self, db: Session, test_department: Department):
        """사용자 생성 테스트"""
        user = User(
            email="newuser@example.com",
            hashed_password="hashed_password_123",
            name="새 사용자",
            phone="010-1111-2222",
            department_id=test_department.id,
            is_active=True,
            is_superuser=False,
            is_mfa_enabled=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        assert user.id is not None
        assert user.email == "newuser@example.com"
        assert user.failed_login_attempts == 0
        assert user.created_at is not None

    def test_user_unique_email_constraint(self, db: Session, test_user: User, test_department: Department):
        """사용자 이메일 유니크 제약조건 테스트"""
        duplicate_user = User(
            email=test_user.email,  # 같은 이메일
            hashed_password="password",
            name="중복 사용자",
            department_id=test_department.id,
        )
        db.add(duplicate_user)

        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    def test_user_department_relationship(self, db: Session, test_user: User, test_department: Department):
        """사용자-부서 관계 테스트"""
        assert test_user.department is not None
        assert test_user.department.id == test_department.id
        assert test_user in test_department.users

    def test_user_role_relationship(self, db: Session, test_user: User, test_role_employee: Role):
        """사용자-역할 다대다 관계 테스트"""
        assert len(test_user.roles) > 0
        assert test_role_employee in test_user.roles
        assert test_user in test_role_employee.users

    def test_user_default_values(self, db: Session, test_department: Department):
        """사용자 기본값 테스트"""
        user = User(
            email="defaults@example.com",
            hashed_password="password",
            name="기본값 테스트",
            department_id=test_department.id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        assert user.is_active is True
        assert user.is_superuser is False
        assert user.is_mfa_enabled is False
        assert user.failed_login_attempts == 0
        assert user.locked_until is None

    def test_user_repr(self, db: Session, test_user: User):
        """사용자 __repr__ 테스트"""
        repr_str = repr(test_user)
        assert "User" in repr_str
        assert test_user.email in repr_str


class TestRoleModel:
    """Role 모델 테스트"""

    def test_role_creation(self, db: Session):
        """역할 생성 테스트"""
        role = Role(
            name="테스트역할",
            description="테스트용 역할",
            permissions="read,write",
            is_system_role=False,
        )
        db.add(role)
        db.commit()
        db.refresh(role)

        assert role.id is not None
        assert role.name == "테스트역할"
        assert role.permissions == "read,write"

    def test_role_unique_name_constraint(self, db: Session, test_role_ciso: Role):
        """역할 이름 유니크 제약조건 테스트"""
        duplicate_role = Role(
            name=test_role_ciso.name,  # 같은 이름
            permissions="some:permissions",
        )
        db.add(duplicate_role)

        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    def test_role_repr(self, db: Session, test_role_ciso: Role):
        """역할 __repr__ 테스트"""
        repr_str = repr(test_role_ciso)
        assert "Role" in repr_str
        assert test_role_ciso.name in repr_str


class TestControlModels:
    """Control 관련 모델 테스트"""

    def test_control_domain_creation(self, db: Session):
        """통제영역 생성 테스트"""
        domain = ControlDomain(
            code="C",
            name="개인정보 처리 단계별 요구사항",
            description="개인정보 처리 관련 통제항목",
            sort_order=3,
        )
        db.add(domain)
        db.commit()
        db.refresh(domain)

        assert domain.id is not None
        assert domain.code == "C"
        assert domain.sort_order == 3

    def test_control_category_creation(self, db: Session, sample_control_domain: ControlDomain):
        """통제항목 카테고리 생성 테스트"""
        category = ControlCategory(
            domain_id=sample_control_domain.id,
            code="1.5",
            name="새 카테고리",
            description="테스트 카테고리",
            sort_order=5,
        )
        db.add(category)
        db.commit()
        db.refresh(category)

        assert category.id is not None
        assert category.domain_id == sample_control_domain.id
        assert category.domain.code == sample_control_domain.code

    def test_control_item_creation(self, db: Session, sample_control_category: ControlCategory):
        """통제항목 생성 테스트"""
        item = ControlItem(
            category_id=sample_control_category.id,
            code="1.1.5",
            title="새 통제항목",
            description="테스트 통제항목 설명",
            objective="테스트 목적",
            requirements="테스트 요구사항",
            is_required=True,
            is_personal_info=False,
            sort_order=5,
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        assert item.id is not None
        assert item.category_id == sample_control_category.id
        assert item.is_required is True

    def test_control_domain_category_cascade(self, db: Session):
        """통제영역 삭제 시 카테고리 cascade 테스트"""
        domain = ControlDomain(code="D", name="삭제테스트", sort_order=4)
        db.add(domain)
        db.commit()

        category = ControlCategory(
            domain_id=domain.id,
            code="D-1",
            name="삭제테스트 카테고리",
            sort_order=1,
        )
        db.add(category)
        db.commit()

        category_id = category.id

        # 도메인 삭제
        db.delete(domain)
        db.commit()

        # 카테고리도 삭제되어야 함
        assert db.query(ControlCategory).filter_by(id=category_id).first() is None

    def test_control_hierarchy(self, db: Session, sample_control_domain, sample_control_category, sample_control_items):
        """통제항목 계층 구조 테스트"""
        # Domain -> Categories
        assert len(sample_control_domain.categories) > 0

        # Category -> Domain
        assert sample_control_category.domain is not None
        assert sample_control_category.domain.id == sample_control_domain.id

        # Category -> Items
        assert len(sample_control_category.control_items) > 0

        # Item -> Category
        for item in sample_control_items:
            assert item.category is not None
            assert item.category.id == sample_control_category.id


class TestAuditModels:
    """Audit 관련 모델 테스트"""

    def test_audit_plan_creation(self, db: Session, test_admin_user: User):
        """감사 계획 생성 테스트"""
        from datetime import date

        plan = AuditPlan(
            title="2024년 2차 내부감사",
            description="2차 내부감사",
            audit_type="internal",
            start_date=date(2024, 6, 1),
            end_date=date(2024, 6, 15),
            scope="전사",
            control_domains="1,2,3",
            lead_auditor_id=test_admin_user.id,
            status="planning",
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        assert plan.id is not None
        assert plan.status == "planning"
        assert plan.lead_auditor_id == test_admin_user.id

    def test_non_conformity_creation(self, db: Session, sample_audit_plan: AuditPlan,
                                     sample_control_items: list, test_user: User):
        """부적합 생성 테스트"""
        from datetime import date

        nc = NonConformity(
            audit_plan_id=sample_audit_plan.id,
            control_item_id=sample_control_items[0].id,
            nc_type="minor",
            severity="medium",
            title="테스트 부적합",
            description="부적합 설명",
            requirement="요구사항",
            responsible_person_id=test_user.id,
            detected_at=date.today(),
            due_date=date(2024, 5, 30),
            status="open",
        )
        db.add(nc)
        db.commit()
        db.refresh(nc)

        assert nc.id is not None
        assert nc.nc_type == "minor"
        assert nc.status == "open"


class TestNotificationModels:
    """Notification 관련 모델 테스트"""

    def test_notification_creation(self, db: Session, test_user: User):
        """알림 생성 테스트"""
        notification = Notification(
            user_id=test_user.id,
            title="테스트 알림",
            message="테스트 메시지입니다.",
            notification_type="info",
            is_read=False,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        assert notification.id is not None
        assert notification.is_read is False
        assert notification.user_id == test_user.id


class TestAuditLogModel:
    """AuditLog 모델 테스트"""

    def test_audit_log_creation(self, db: Session, test_user: User):
        """감사 로그 생성 테스트"""
        import hashlib

        # 현재 해시 생성 (위변조 방지용)
        current_hash = hashlib.sha256("test_data".encode()).hexdigest()

        log = AuditLog(
            user_id=test_user.id,
            user_email=test_user.email,
            user_name=test_user.name,
            action="LOGIN",
            resource_type="auth",
            resource_id=None,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            request_method="POST",
            request_path="/api/v1/auth/login",
            status_code=200,
            current_hash=current_hash,
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        assert log.id is not None
        assert log.action == "LOGIN"
        assert log.user_id == test_user.id
        assert log.current_hash == current_hash


class TestScheduledTaskModels:
    """ScheduledTask 관련 모델 테스트"""

    def test_scheduled_task_creation(self, db: Session, test_user: User, sample_control_items: list):
        """정기 활동 생성 테스트"""
        from datetime import datetime

        task = ScheduledTask(
            title="월간 점검",
            description="월간 보안 점검",
            task_type="review",
            control_item_id=sample_control_items[0].id,
            frequency="monthly",
            assignee_id=test_user.id,
            next_execution_at=datetime(2024, 2, 1, 9, 0, 0),
            status="active",
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        assert task.id is not None
        assert task.frequency == "monthly"
        assert task.status == "active"
        assert task.title == "월간 점검"


class TestAuditorAccountModel:
    """AuditorAccount 모델 테스트"""

    def test_auditor_account_creation(self, db: Session, test_user: User, sample_audit_plan: AuditPlan):
        """심사원 계정 생성 테스트"""
        account = AuditorAccount(
            user_id=test_user.id,
            audit_plan_id=sample_audit_plan.id,
            valid_from=datetime.utcnow(),
            valid_until=datetime.utcnow() + timedelta(days=30),
            access_scope='{"domains": ["1", "2"]}',
            allow_download=False,
            is_active=True,
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        assert account.id is not None
        assert account.allow_download is False
        assert account.user_id == test_user.id

    def test_auditor_account_relationships(self, db: Session, test_user: User, sample_audit_plan: AuditPlan):
        """심사원 계정 관계 테스트"""
        account = AuditorAccount(
            user_id=test_user.id,
            audit_plan_id=sample_audit_plan.id,
            valid_from=datetime.utcnow(),
            valid_until=datetime.utcnow() + timedelta(days=30),
            is_active=True,
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        assert account.user is not None
        assert account.user.id == test_user.id
        assert account.audit_plan is not None
        assert account.audit_plan.id == sample_audit_plan.id
