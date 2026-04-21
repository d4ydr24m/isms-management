"""
감사 스키마 단위 테스트

TDD RED 단계: 스키마 검증 테스트 작성
"""
import pytest
from datetime import date, datetime, timedelta
from pydantic import ValidationError

from app.schemas.audit import (
    # 열거형
    AuditType, AuditStatus, ChecklistResult, NCType, Severity, NCStatus, CAStatus, VerificationResult,
    # 감사 계획
    AuditPlanCreate, AuditPlanUpdate, AuditPlanResponse, AuditTeamUpdate,
    # 체크리스트
    ChecklistItemCreate, ChecklistResultCreate, ChecklistEvidenceLink,
    # 부적합
    NonConformityCreate, NonConformityUpdate, NonConformityResponse,
    # 시정조치
    CorrectiveActionCreate, CorrectiveActionUpdate, CorrectiveActionVerify,
    # 심사원 계정
    AuditorAccountCreate, AuditorAccountUpdate, AuditorAccountResponse,
    # 감사 로그
    AuditLogResponse, AuditLogFilter,
)


class TestAuditPlanSchemas:
    """감사 계획 스키마 테스트"""

    def test_audit_plan_create_valid(self):
        """유효한 감사 계획 생성 스키마"""
        schema = AuditPlanCreate(
            title="2024년 1차 내부감사",
            description="연간 내부감사 계획",
            audit_type=AuditType.INTERNAL,
            start_date=date(2024, 3, 1),
            end_date=date(2024, 3, 15),
            scope="전사 정보보호 관리체계",
            control_domains="1,2,3",
            lead_auditor_id=1,
            team_members="2,3,4",
        )
        assert schema.title == "2024년 1차 내부감사"
        assert schema.audit_type == AuditType.INTERNAL

    def test_audit_plan_create_missing_title(self):
        """제목 누락 시 검증 실패"""
        with pytest.raises(ValidationError) as exc_info:
            AuditPlanCreate(
                audit_type=AuditType.INTERNAL,
                start_date=date(2024, 3, 1),
                end_date=date(2024, 3, 15),
                scope="전사",
                lead_auditor_id=1,
            )
        assert "title" in str(exc_info.value)

    def test_audit_plan_create_empty_title(self):
        """빈 제목 검증 실패"""
        with pytest.raises(ValidationError):
            AuditPlanCreate(
                title="",
                audit_type=AuditType.INTERNAL,
                start_date=date(2024, 3, 1),
                end_date=date(2024, 3, 15),
                scope="전사",
                lead_auditor_id=1,
            )

    def test_audit_plan_create_end_date_before_start_date(self):
        """종료일이 시작일 이전인 경우 검증 실패"""
        with pytest.raises(ValidationError) as exc_info:
            AuditPlanCreate(
                title="테스트 감사",
                audit_type=AuditType.INTERNAL,
                start_date=date(2024, 3, 15),
                end_date=date(2024, 3, 1),  # 시작일보다 이전
                scope="전사",
                lead_auditor_id=1,
            )
        assert "종료일은 시작일 이후" in str(exc_info.value)

    def test_audit_plan_update_partial(self):
        """부분 수정 스키마 검증"""
        schema = AuditPlanUpdate(
            title="수정된 제목",
            status=AuditStatus.IN_PROGRESS,
        )
        assert schema.title == "수정된 제목"
        assert schema.status == AuditStatus.IN_PROGRESS
        assert schema.description is None

    def test_audit_team_update_valid(self):
        """감사팀 수정 스키마 검증"""
        schema = AuditTeamUpdate(
            lead_auditor_id=1,
            team_member_ids=[2, 3, 4],
        )
        assert schema.lead_auditor_id == 1
        assert len(schema.team_member_ids) == 3


class TestChecklistSchemas:
    """체크리스트 스키마 테스트"""

    def test_checklist_item_create_valid(self):
        """유효한 체크리스트 항목 생성"""
        schema = ChecklistItemCreate(
            control_item_id=1,
            question="정보보호 정책이 수립되어 있습니까?",
            sort_order=1,
        )
        assert schema.control_item_id == 1
        assert schema.question == "정보보호 정책이 수립되어 있습니까?"

    def test_checklist_item_create_empty_question(self):
        """빈 질문 검증 실패"""
        with pytest.raises(ValidationError):
            ChecklistItemCreate(
                control_item_id=1,
                question="",
            )

    def test_checklist_result_create_valid(self):
        """유효한 점검 결과 입력"""
        schema = ChecklistResultCreate(
            result=ChecklistResult.CONFORMITY,
            finding="정책 문서 확인 완료",
            evidence_reference="1,2,3",
        )
        assert schema.result == ChecklistResult.CONFORMITY

    def test_checklist_result_all_types(self):
        """모든 점검 결과 유형 테스트"""
        for result_type in ChecklistResult:
            schema = ChecklistResultCreate(result=result_type)
            assert schema.result == result_type

    def test_checklist_evidence_link_valid(self):
        """체크리스트-증적 연결 스키마"""
        schema = ChecklistEvidenceLink(evidence_ids=[1, 2, 3])
        assert len(schema.evidence_ids) == 3

    def test_checklist_evidence_link_empty(self):
        """빈 증적 목록 검증 실패"""
        with pytest.raises(ValidationError):
            ChecklistEvidenceLink(evidence_ids=[])


class TestNonConformitySchemas:
    """부적합 스키마 테스트"""

    def test_non_conformity_create_valid(self):
        """유효한 부적합 생성"""
        schema = NonConformityCreate(
            audit_plan_id=1,
            control_item_id=10,
            nc_type=NCType.MAJOR,
            severity=Severity.HIGH,
            title="정보보호 정책 미수립",
            description="정보보호 정책이 수립되어 있지 않음",
            requirement="정보보호 정책을 수립하여야 한다",
            responsible_person_id=5,
            department_id=2,
            due_date=date(2024, 4, 30),
        )
        assert schema.nc_type == NCType.MAJOR
        assert schema.severity == Severity.HIGH

    def test_non_conformity_create_missing_required_fields(self):
        """필수 필드 누락 시 검증 실패"""
        with pytest.raises(ValidationError):
            NonConformityCreate(
                audit_plan_id=1,
                control_item_id=10,
                nc_type=NCType.MAJOR,
                # severity 누락
                title="테스트",
                description="테스트",
                requirement="테스트",
                responsible_person_id=5,
                due_date=date(2024, 4, 30),
            )

    def test_non_conformity_update_partial(self):
        """부분 수정 검증"""
        schema = NonConformityUpdate(
            status=NCStatus.IN_PROGRESS,
            responsible_person_id=10,
        )
        assert schema.status == NCStatus.IN_PROGRESS
        assert schema.title is None

    def test_non_conformity_all_types(self):
        """모든 부적합 유형 테스트"""
        for nc_type in NCType:
            schema = NonConformityCreate(
                audit_plan_id=1,
                control_item_id=10,
                nc_type=nc_type,
                severity=Severity.MEDIUM,
                title="테스트",
                description="테스트",
                requirement="테스트",
                responsible_person_id=5,
                due_date=date(2024, 4, 30),
            )
            assert schema.nc_type == nc_type

    def test_non_conformity_all_severities(self):
        """모든 심각도 테스트"""
        for severity in Severity:
            schema = NonConformityCreate(
                audit_plan_id=1,
                control_item_id=10,
                nc_type=NCType.MINOR,
                severity=severity,
                title="테스트",
                description="테스트",
                requirement="테스트",
                responsible_person_id=5,
                due_date=date(2024, 4, 30),
            )
            assert schema.severity == severity


class TestCorrectiveActionSchemas:
    """시정조치 스키마 테스트"""

    def test_corrective_action_create_valid(self):
        """유효한 시정조치 생성"""
        schema = CorrectiveActionCreate(
            action_plan="경영진의 참여 및 승인",
            root_cause="정보보호 조직 부재",
            preventive_measures="연간 정책 검토 프로세스 수립",
            responsible_person_id=5,
            planned_completion_date=date(2024, 4, 15),
        )
        assert schema.action_plan == "경영진의 참여 및 승인"

    def test_corrective_action_create_minimal(self):
        """최소 필수 필드만으로 생성"""
        schema = CorrectiveActionCreate(
            action_plan="시정조치 계획",
            responsible_person_id=5,
            planned_completion_date=date(2024, 4, 15),
        )
        assert schema.root_cause is None
        assert schema.preventive_measures is None

    def test_corrective_action_update_with_result(self):
        """결과 포함 수정 검증"""
        schema = CorrectiveActionUpdate(
            actual_completion_date=date(2024, 4, 10),
            result_description="경영진의 참여 완료",
            result_evidence_id=100,
            status=CAStatus.COMPLETED,
        )
        assert schema.status == CAStatus.COMPLETED

    def test_corrective_action_verify_approved(self):
        """시정조치 승인 검증"""
        schema = CorrectiveActionVerify(
            verification_result=VerificationResult.APPROVED,
            verification_comment="정상적으로 이행됨 확인",
        )
        assert schema.verification_result == VerificationResult.APPROVED

    def test_corrective_action_verify_rejected(self):
        """시정조치 반려 검증"""
        schema = CorrectiveActionVerify(
            verification_result=VerificationResult.REJECTED,
            verification_comment="증적 불충분",
        )
        assert schema.verification_result == VerificationResult.REJECTED


class TestAuditorAccountSchemas:
    """심사원 계정 스키마 테스트"""

    def test_auditor_account_create_valid(self):
        """유효한 심사원 계정 생성"""
        now = datetime.now()
        schema = AuditorAccountCreate(
            email="auditor@kisa.or.kr",
            name="김심사",
            audit_plan_id=1,
            valid_from=now,
            valid_until=now + timedelta(days=30),
            access_scope='{"domains": ["1", "2"]}',
            allow_download=False,
        )
        assert schema.email == "auditor@kisa.or.kr"
        assert schema.allow_download is False

    def test_auditor_account_create_invalid_dates(self):
        """만료일이 시작일 이전인 경우 검증 실패"""
        now = datetime.now()
        with pytest.raises(ValidationError) as exc_info:
            AuditorAccountCreate(
                email="auditor@kisa.or.kr",
                name="김심사",
                audit_plan_id=1,
                valid_from=now,
                valid_until=now - timedelta(days=1),  # 시작일보다 이전
                allow_download=False,
            )
        assert "만료일은 시작일 이후" in str(exc_info.value)

    def test_auditor_account_update_partial(self):
        """부분 수정 검증"""
        now = datetime.now()
        schema = AuditorAccountUpdate(
            valid_until=now + timedelta(days=60),
            allow_download=True,
        )
        assert schema.allow_download is True
        assert schema.is_active is None


class TestAuditLogSchemas:
    """감사 로그 스키마 테스트"""

    def test_audit_log_filter_all_fields(self):
        """모든 필터 필드 테스트"""
        now = datetime.now()
        schema = AuditLogFilter(
            user_id=1,
            action="read",
            resource_type="evidence",
            resource_id=100,
            start_date=now - timedelta(days=7),
            end_date=now,
            ip_address="192.168.1.1",
        )
        assert schema.user_id == 1
        assert schema.action == "read"

    def test_audit_log_filter_empty(self):
        """빈 필터 (전체 조회)"""
        schema = AuditLogFilter()
        assert schema.user_id is None
        assert schema.action is None


class TestEnums:
    """열거형 테스트"""

    def test_audit_type_values(self):
        """감사 유형 값 확인"""
        assert AuditType.INTERNAL.value == "internal"
        assert AuditType.EXTERNAL.value == "external"
        assert AuditType.CERTIFICATION.value == "certification"

    def test_audit_status_values(self):
        """감사 상태 값 확인"""
        assert AuditStatus.PLANNING.value == "planning"
        assert AuditStatus.IN_PROGRESS.value == "in_progress"
        assert AuditStatus.COMPLETED.value == "completed"
        assert AuditStatus.CANCELLED.value == "cancelled"

    def test_nc_type_values(self):
        """부적합 유형 값 확인"""
        assert NCType.MAJOR.value == "major"
        assert NCType.MINOR.value == "minor"
        assert NCType.OBSERVATION.value == "observation"

    def test_nc_status_values(self):
        """부적합 상태 값 확인"""
        assert NCStatus.OPEN.value == "open"
        assert NCStatus.IN_PROGRESS.value == "in_progress"
        assert NCStatus.RESOLVED.value == "resolved"
        assert NCStatus.CLOSED.value == "closed"
        assert NCStatus.REOPENED.value == "reopened"

    def test_ca_status_values(self):
        """시정조치 상태 값 확인"""
        assert CAStatus.PLANNED.value == "planned"
        assert CAStatus.IN_PROGRESS.value == "in_progress"
        assert CAStatus.COMPLETED.value == "completed"
        assert CAStatus.VERIFIED.value == "verified"
