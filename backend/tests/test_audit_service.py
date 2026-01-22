"""
감사 서비스 단위 테스트

TDD RED 단계: 감사 서비스 기능 테스트 작성
5.2 감사 서비스 구현 테스트
"""
import pytest
from datetime import date, datetime, timedelta
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session

from app.models.audit import AuditPlan, AuditChecklist, AuditChecklistResult, NonConformity, CorrectiveAction
from app.models.user import User, AuditorAccount
from app.models.control import ControlItem, ControlCategory, ControlDomain
from app.schemas.audit import (
    AuditPlanCreate, AuditPlanUpdate, AuditTeamUpdate, AuditType, AuditStatus,
    ChecklistResultCreate, ChecklistResult, NCType, Severity, NCStatus,
    NonConformityCreate, NonConformityUpdate,
    CorrectiveActionCreate, CorrectiveActionUpdate, CorrectiveActionVerify,
    CAStatus, VerificationResult,
)


# ========== 픽스처 ==========
@pytest.fixture
def mock_db():
    """목 데이터베이스 세션"""
    return MagicMock(spec=Session)


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


# ========== 감사 계획 관리 테스트 ==========
class TestAuditPlanService:
    """감사 계획 서비스 테스트"""

    def test_create_audit_plan(self, db: Session, test_admin_user: User):
        """감사 계획 생성 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        plan_data = AuditPlanCreate(
            title="2024년 2차 내부감사",
            description="2차 감사",
            audit_type=AuditType.INTERNAL,
            start_date=date(2024, 6, 1),
            end_date=date(2024, 6, 15),
            scope="전사",
            lead_auditor_id=test_admin_user.id,
        )

        plan = service.create_audit_plan(plan_data)

        assert plan.id is not None
        assert plan.title == "2024년 2차 내부감사"
        assert plan.status == "planning"

    def test_get_audit_plan(self, db: Session, sample_audit_plan: AuditPlan):
        """감사 계획 조회 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        plan = service.get_audit_plan(sample_audit_plan.id)

        assert plan is not None
        assert plan.id == sample_audit_plan.id
        assert plan.title == sample_audit_plan.title

    def test_get_audit_plan_not_found(self, db: Session):
        """존재하지 않는 감사 계획 조회"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        plan = service.get_audit_plan(99999)

        assert plan is None

    def test_update_audit_plan(self, db: Session, sample_audit_plan: AuditPlan):
        """감사 계획 수정 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        update_data = AuditPlanUpdate(
            title="수정된 감사 제목",
            status=AuditStatus.IN_PROGRESS,
        )

        updated_plan = service.update_audit_plan(sample_audit_plan.id, update_data)

        assert updated_plan.title == "수정된 감사 제목"
        assert updated_plan.status == "in_progress"

    def test_delete_audit_plan(self, db: Session, sample_audit_plan: AuditPlan):
        """감사 계획 삭제 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        result = service.delete_audit_plan(sample_audit_plan.id)

        assert result is True
        # 삭제 후 조회 불가 확인
        deleted_plan = service.get_audit_plan(sample_audit_plan.id)
        assert deleted_plan is None

    def test_update_audit_team(self, db: Session, sample_audit_plan: AuditPlan, test_user: User):
        """감사팀 구성 수정 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        team_data = AuditTeamUpdate(
            lead_auditor_id=test_user.id,
            team_member_ids=[test_user.id],
        )

        updated_plan = service.update_audit_team(sample_audit_plan.id, team_data)

        assert updated_plan.lead_auditor_id == test_user.id

    def test_list_audit_plans(self, db: Session, sample_audit_plan: AuditPlan):
        """감사 계획 목록 조회 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        plans, total = service.list_audit_plans(page=1, size=10)

        assert total >= 1
        assert len(plans) >= 1


# ========== 체크리스트 관리 테스트 ==========
class TestChecklistService:
    """체크리스트 서비스 테스트"""

    def test_generate_checklist(
        self, db: Session, sample_audit_plan: AuditPlan, sample_control_items: list
    ):
        """체크리스트 자동 생성 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 통제항목 기반 체크리스트 자동 생성
        checklists = service.generate_checklist(sample_audit_plan.id)

        assert len(checklists) >= len(sample_control_items)
        for checklist in checklists:
            assert checklist.audit_plan_id == sample_audit_plan.id
            assert checklist.question is not None

    def test_get_checklist(self, db: Session, sample_audit_plan: AuditPlan, sample_control_items: list):
        """체크리스트 조회 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 먼저 체크리스트 생성
        service.generate_checklist(sample_audit_plan.id)

        # 체크리스트 조회
        checklists = service.get_checklists(sample_audit_plan.id)

        assert len(checklists) > 0

    def test_submit_checklist_result(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_admin_user: User
    ):
        """점검 결과 입력 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 체크리스트 생성
        checklists = service.generate_checklist(sample_audit_plan.id)
        checklist = checklists[0]

        # 점검 결과 입력
        result_data = ChecklistResultCreate(
            result=ChecklistResult.CONFORMITY,
            finding="정책 문서 확인 완료",
            evidence_reference="1,2,3",
        )

        result = service.submit_checklist_result(
            checklist_id=checklist.id,
            result_data=result_data,
            auditor_id=test_admin_user.id,
        )

        assert result.result == "conformity"
        assert result.auditor_id == test_admin_user.id

    def test_link_evidence_to_checklist(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_admin_user: User
    ):
        """체크리스트에 증적 연결 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        checklists = service.generate_checklist(sample_audit_plan.id)
        checklist = checklists[0]

        # 먼저 점검 결과를 입력해야 증적 연결 가능
        result_data = ChecklistResultCreate(
            result=ChecklistResult.CONFORMITY,
            finding="정책 확인 완료",
        )
        service.submit_checklist_result(checklist.id, result_data, test_admin_user.id)

        # 증적 연결 (ID 목록)
        evidence_ids = [1, 2, 3]
        result = service.link_evidence_to_checklist(checklist.id, evidence_ids)

        assert result is True


# ========== 부적합 관리 테스트 ==========
class TestNonConformityService:
    """부적합 관리 서비스 테스트"""

    def test_create_non_conformity(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_user: User
    ):
        """부적합 등록 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        nc_data = NonConformityCreate(
            audit_plan_id=sample_audit_plan.id,
            control_item_id=sample_control_items[0].id,
            nc_type=NCType.MAJOR,
            severity=Severity.HIGH,
            title="정보보호 정책 미수립",
            description="정보보호 정책이 수립되어 있지 않음",
            requirement="정보보호 정책을 수립하여야 한다",
            responsible_person_id=test_user.id,
            due_date=date(2024, 4, 30),
        )

        nc = service.create_non_conformity(nc_data)

        assert nc.id is not None
        assert nc.status == "open"
        assert nc.nc_type == "major"

    def test_get_non_conformity(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_user: User
    ):
        """부적합 조회 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 먼저 부적합 생성
        nc_data = NonConformityCreate(
            audit_plan_id=sample_audit_plan.id,
            control_item_id=sample_control_items[0].id,
            nc_type=NCType.MINOR,
            severity=Severity.MEDIUM,
            title="테스트 부적합",
            description="테스트",
            requirement="테스트",
            responsible_person_id=test_user.id,
            due_date=date(2024, 4, 30),
        )
        created_nc = service.create_non_conformity(nc_data)

        # 조회
        nc = service.get_non_conformity(created_nc.id)

        assert nc is not None
        assert nc.id == created_nc.id

    def test_update_non_conformity(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_user: User
    ):
        """부적합 수정 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 부적합 생성
        nc_data = NonConformityCreate(
            audit_plan_id=sample_audit_plan.id,
            control_item_id=sample_control_items[0].id,
            nc_type=NCType.MINOR,
            severity=Severity.MEDIUM,
            title="테스트 부적합",
            description="테스트",
            requirement="테스트",
            responsible_person_id=test_user.id,
            due_date=date(2024, 4, 30),
        )
        nc = service.create_non_conformity(nc_data)

        # 수정
        update_data = NonConformityUpdate(
            status=NCStatus.IN_PROGRESS,
            title="수정된 제목",
        )
        updated_nc = service.update_non_conformity(nc.id, update_data)

        assert updated_nc.title == "수정된 제목"
        assert updated_nc.status == "in_progress"

    def test_get_non_conformity_history(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_user: User
    ):
        """부적합 이력 조회 테스트 (동일 통제항목 반복 지적)"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        control_item = sample_control_items[0]

        # 같은 통제항목에 여러 부적합 생성
        for i in range(3):
            nc_data = NonConformityCreate(
                audit_plan_id=sample_audit_plan.id,
                control_item_id=control_item.id,
                nc_type=NCType.MINOR,
                severity=Severity.MEDIUM,
                title=f"반복 부적합 {i+1}",
                description="테스트",
                requirement="테스트",
                responsible_person_id=test_user.id,
                due_date=date(2024, 4, 30),
            )
            service.create_non_conformity(nc_data)

        # 이력 조회
        history = service.get_non_conformity_history(control_item.id)

        assert history is not None
        assert history.total_count >= 3

    def test_list_non_conformities_with_filter(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_user: User
    ):
        """부적합 목록 필터 조회 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 여러 부적합 생성
        for i, severity in enumerate([Severity.HIGH, Severity.MEDIUM, Severity.LOW]):
            nc_data = NonConformityCreate(
                audit_plan_id=sample_audit_plan.id,
                control_item_id=sample_control_items[i % len(sample_control_items)].id,
                nc_type=NCType.MINOR,
                severity=severity,
                title=f"부적합 {i+1}",
                description="테스트",
                requirement="테스트",
                responsible_person_id=test_user.id,
                due_date=date(2024, 4, 30),
            )
            service.create_non_conformity(nc_data)

        # HIGH 심각도 필터
        ncs, total = service.list_non_conformities(
            audit_plan_id=sample_audit_plan.id,
            severity="high",
            page=1,
            size=10,
        )

        assert all(nc.severity == "high" for nc in ncs)


# ========== 시정조치 워크플로우 테스트 ==========
class TestCorrectiveActionService:
    """시정조치 서비스 테스트"""

    @pytest.fixture
    def sample_non_conformity(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_user: User
    ) -> NonConformity:
        """테스트용 부적합 생성"""
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

    def test_create_corrective_action(
        self, db: Session, sample_non_conformity: NonConformity, test_user: User
    ):
        """시정조치 요청 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        ca_data = CorrectiveActionCreate(
            action_plan="정보보호 정책 수립 및 승인",
            root_cause="정보보호 조직 부재",
            preventive_measures="연간 정책 검토 프로세스 수립",
            responsible_person_id=test_user.id,
            planned_completion_date=date(2024, 4, 15),
        )

        ca = service.create_corrective_action(sample_non_conformity.id, ca_data)

        assert ca.id is not None
        assert ca.status == "planned"
        assert ca.non_conformity_id == sample_non_conformity.id

    def test_update_corrective_action(
        self, db: Session, sample_non_conformity: NonConformity, test_user: User
    ):
        """시정조치 계획/결과 등록 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 시정조치 생성
        ca_data = CorrectiveActionCreate(
            action_plan="정보보호 정책 수립",
            responsible_person_id=test_user.id,
            planned_completion_date=date(2024, 4, 15),
        )
        ca = service.create_corrective_action(sample_non_conformity.id, ca_data)

        # 시정조치 결과 등록
        update_data = CorrectiveActionUpdate(
            actual_completion_date=date(2024, 4, 10),
            result_description="정보보호 정책 수립 완료",
            status=CAStatus.COMPLETED,
        )
        updated_ca = service.update_corrective_action(ca.id, update_data)

        assert updated_ca.status == "completed"
        assert updated_ca.result_description == "정보보호 정책 수립 완료"

    def test_verify_corrective_action(
        self, db: Session, sample_non_conformity: NonConformity,
        test_user: User, test_admin_user: User
    ):
        """시정조치 검증 및 종료 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 시정조치 생성 및 완료
        ca_data = CorrectiveActionCreate(
            action_plan="정보보호 정책 수립",
            responsible_person_id=test_user.id,
            planned_completion_date=date(2024, 4, 15),
        )
        ca = service.create_corrective_action(sample_non_conformity.id, ca_data)
        service.update_corrective_action(ca.id, CorrectiveActionUpdate(
            status=CAStatus.COMPLETED,
            result_description="완료",
        ))

        # 검증
        verify_data = CorrectiveActionVerify(
            verification_result=VerificationResult.APPROVED,
            verification_comment="정상적으로 이행됨 확인",
        )
        verified_ca = service.verify_corrective_action(
            ca.id, verify_data, verifier_id=test_admin_user.id
        )

        assert verified_ca.status == "verified"
        assert verified_ca.verification_result == "approved"
        assert verified_ca.verified_by == test_admin_user.id

    def test_verify_corrective_action_rejected(
        self, db: Session, sample_non_conformity: NonConformity,
        test_user: User, test_admin_user: User
    ):
        """시정조치 반려 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        ca_data = CorrectiveActionCreate(
            action_plan="정보보호 정책 수립",
            responsible_person_id=test_user.id,
            planned_completion_date=date(2024, 4, 15),
        )
        ca = service.create_corrective_action(sample_non_conformity.id, ca_data)
        service.update_corrective_action(ca.id, CorrectiveActionUpdate(
            status=CAStatus.COMPLETED,
        ))

        # 반려
        verify_data = CorrectiveActionVerify(
            verification_result=VerificationResult.REJECTED,
            verification_comment="증적 불충분",
        )
        rejected_ca = service.verify_corrective_action(
            ca.id, verify_data, verifier_id=test_admin_user.id
        )

        # 반려 시 상태가 in_progress로 변경
        assert rejected_ca.status == "in_progress"
        assert rejected_ca.verification_result == "rejected"


# ========== 부적합 이력 분석 테스트 ==========
class TestNonConformityAnalysis:
    """부적합 이력 분석 테스트"""

    def test_get_repeat_non_conformities(
        self, db: Session, sample_audit_plan: AuditPlan,
        sample_control_items: list, test_user: User
    ):
        """반복 지적 통제항목 분석 테스트"""
        from app.services.audit_service import AuditService

        service = AuditService(db)
        # 특정 통제항목에 여러 부적합 생성
        control_item = sample_control_items[0]
        for i in range(3):
            nc = NonConformity(
                audit_plan_id=sample_audit_plan.id,
                control_item_id=control_item.id,
                nc_type="minor",
                severity="medium",
                title=f"반복 부적합 {i+1}",
                description="테스트",
                requirement="테스트",
                responsible_person_id=test_user.id,
                detected_at=date.today() - timedelta(days=30*i),
                due_date=date.today() + timedelta(days=30),
                status="closed" if i > 0 else "open",
            )
            db.add(nc)
        db.commit()

        # 반복 지적 분석
        repeat_items = service.get_repeat_non_conformities(threshold=2)

        assert len(repeat_items) >= 1
        assert any(item["control_item_id"] == control_item.id for item in repeat_items)
