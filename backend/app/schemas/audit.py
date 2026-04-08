"""
감사 관련 Pydantic 스키마

5.1 Pydantic 스키마 작성 (FR-201 ~ FR-206)
- 감사 계획 (AuditPlan)
- 체크리스트 (Checklist)
- 부적합 (NonConformity)
- 시정조치 (CorrectiveAction)
- 심사원 계정 (AuditorAccount)
"""
from datetime import date, datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# ========== 열거형 ==========
class AuditType(str, Enum):
    """감사 유형"""
    INTERNAL = "internal"  # 내부감사
    EXTERNAL = "external"  # 외부심사
    CERTIFICATION = "certification"  # 인증심사
    SURVEILLANCE = "surveillance"  # 사후심사


class AuditStatus(str, Enum):
    """감사 상태"""
    PLANNING = "planning"  # 계획 중
    IN_PROGRESS = "in_progress"  # 진행 중
    COMPLETED = "completed"  # 완료
    CANCELLED = "cancelled"  # 취소


class ChecklistResult(str, Enum):
    """점검 결과"""
    CONFORMITY = "conformity"  # 적합
    NON_CONFORMITY = "non_conformity"  # 부적합
    OBSERVATION = "observation"  # 관찰사항
    NOT_APPLICABLE = "not_applicable"  # 해당없음


class NCType(str, Enum):
    """부적합 유형"""
    MAJOR = "major"  # 중결함
    MINOR = "minor"  # 경결함
    OBSERVATION = "observation"  # 관찰사항


class Severity(str, Enum):
    """심각도"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class NCStatus(str, Enum):
    """부적합 상태"""
    OPEN = "open"  # 열림
    IN_PROGRESS = "in_progress"  # 진행 중
    RESOLVED = "resolved"  # 해결됨
    CLOSED = "closed"  # 종료
    REOPENED = "reopened"  # 재개


class CAStatus(str, Enum):
    """시정조치 상태"""
    PLANNED = "planned"  # 계획됨
    IN_PROGRESS = "in_progress"  # 진행 중
    COMPLETED = "completed"  # 완료
    VERIFIED = "verified"  # 검증됨


class VerificationResult(str, Enum):
    """검증 결과"""
    APPROVED = "approved"  # 승인
    REJECTED = "rejected"  # 반려


# ========== 감사 계획 스키마 ==========
class AuditPlanBase(BaseModel):
    """감사 계획 기본 스키마"""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    audit_type: AuditType
    start_date: date
    end_date: date
    scope: str = Field(..., min_length=1)
    control_domains: Optional[str] = None  # 쉼표로 구분된 영역 코드

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v: date, info) -> date:
        """종료일은 시작일 이후여야 함"""
        start_date = info.data.get("start_date")
        if start_date and v < start_date:
            raise ValueError("종료일은 시작일 이후여야 합니다.")
        return v


class AuditPlanCreate(AuditPlanBase):
    """감사 계획 생성 스키마"""
    auditor_ids: List[int] = Field(default_factory=list)  # 감사원 ID 목록 (첫 번째가 수석감사원)
    control_item_ids: List[int] = Field(default_factory=list)  # 통제항목 ID 목록


class AuditPlanUpdate(BaseModel):
    """감사 계획 수정 스키마"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    audit_type: Optional[AuditType] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    scope: Optional[str] = None
    control_domains: Optional[str] = None
    lead_auditor_id: Optional[int] = None
    team_members: Optional[str] = None
    status: Optional[AuditStatus] = None
    overall_result: Optional[str] = None
    final_report_path: Optional[str] = None


class AuditTeamUpdate(BaseModel):
    """감사팀 구성 수정 스키마"""
    lead_auditor_id: int
    team_member_ids: List[int] = Field(default_factory=list)


class AuditPlanResponse(BaseModel):
    """감사 계획 응답 스키마"""
    id: int
    title: str
    description: Optional[str] = None
    audit_type: AuditType
    start_date: date
    end_date: date
    scope: str
    control_domains: Optional[str] = None
    lead_auditor_id: int
    lead_auditor_name: Optional[str] = None
    team_members: Optional[str] = None
    status: AuditStatus
    overall_result: Optional[str] = None
    final_report_path: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # 통계 정보
    checklist_count: int = 0
    completed_checklist_count: int = 0
    non_conformity_count: int = 0

    model_config = {"from_attributes": True}


class AuditPlanList(BaseModel):
    """감사 계획 목록 스키마"""
    items: List[AuditPlanResponse]
    total: int
    page: int
    size: int
    pages: int


# ========== 체크리스트 스키마 ==========
class ChecklistItemBase(BaseModel):
    """체크리스트 항목 기본 스키마"""
    question: str = Field(..., min_length=1)
    sort_order: int = 0


class ChecklistItemCreate(ChecklistItemBase):
    """체크리스트 항목 생성 스키마"""
    control_item_id: int


class ChecklistResultCreate(BaseModel):
    """점검 결과 입력 스키마"""
    result: ChecklistResult
    finding: Optional[str] = None
    evidence_reference: Optional[str] = None  # 쉼표로 구분된 증적 ID


class ChecklistResultResponse(BaseModel):
    """점검 결과 응답 스키마"""
    id: int
    checklist_id: int
    result: ChecklistResult
    finding: Optional[str] = None
    evidence_reference: Optional[str] = None
    auditor_id: int
    auditor_name: Optional[str] = None
    checked_at: datetime

    model_config = {"from_attributes": True}


class ChecklistItemResponse(BaseModel):
    """체크리스트 항목 응답 스키마"""
    id: int
    audit_plan_id: int
    control_item_id: int
    control_item_code: Optional[str] = None
    control_item_title: Optional[str] = None
    question: str
    sort_order: int
    latest_result: Optional[ChecklistResultResponse] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistEvidenceLink(BaseModel):
    """체크리스트-증적 연결 스키마"""
    evidence_ids: List[int] = Field(..., min_length=1)


# ========== 부적합 스키마 ==========
class NonConformityBase(BaseModel):
    """부적합 기본 스키마"""
    title: str = Field(..., min_length=1, max_length=255)
    nc_type: NCType
    severity: Severity
    description: str = Field(..., min_length=1)
    requirement: str = Field(..., min_length=1)
    evidence: Optional[str] = None
    due_date: date


class NonConformityCreate(NonConformityBase):
    """부적합 생성 스키마"""
    audit_plan_id: int
    control_item_id: int
    responsible_person_id: int
    department_id: Optional[int] = None
    detected_at: date = Field(default_factory=date.today)


class NonConformityUpdate(BaseModel):
    """부적합 수정 스키마"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    nc_type: Optional[NCType] = None
    severity: Optional[Severity] = None
    description: Optional[str] = None
    requirement: Optional[str] = None
    evidence: Optional[str] = None
    responsible_person_id: Optional[int] = None
    department_id: Optional[int] = None
    status: Optional[NCStatus] = None
    due_date: Optional[date] = None


class NonConformityResponse(BaseModel):
    """부적합 응답 스키마"""
    id: int
    audit_plan_id: int
    audit_plan_title: Optional[str] = None
    control_item_id: int
    control_item_code: Optional[str] = None
    control_item_title: Optional[str] = None
    nc_type: NCType
    severity: Severity
    title: str
    description: str
    requirement: str
    evidence: Optional[str] = None
    responsible_person_id: int
    responsible_person_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    status: NCStatus
    detected_at: date
    due_date: date
    closed_at: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # 시정조치 수
    corrective_action_count: int = 0

    model_config = {"from_attributes": True}


class NonConformityList(BaseModel):
    """부적합 목록 스키마"""
    items: List[NonConformityResponse]
    total: int
    page: int
    size: int
    pages: int


class NonConformityHistory(BaseModel):
    """부적합 이력 스키마 (동일 통제항목 반복 지적 분석)"""
    control_item_id: int
    control_item_code: str
    control_item_title: str
    total_count: int
    recent_non_conformities: List[NonConformityResponse]


# ========== 시정조치 스키마 ==========
class CorrectiveActionBase(BaseModel):
    """시정조치 기본 스키마"""
    action_plan: str = Field(..., min_length=1)
    root_cause: Optional[str] = None
    preventive_measures: Optional[str] = None
    planned_completion_date: date


class CorrectiveActionCreate(CorrectiveActionBase):
    """시정조치 생성 스키마"""
    responsible_person_id: int


class CorrectiveActionUpdate(BaseModel):
    """시정조치 수정 스키마 (계획/결과 등록)"""
    action_plan: Optional[str] = None
    root_cause: Optional[str] = None
    preventive_measures: Optional[str] = None
    responsible_person_id: Optional[int] = None
    planned_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None
    result_description: Optional[str] = None
    result_evidence_id: Optional[int] = None
    status: Optional[CAStatus] = None


class CorrectiveActionVerify(BaseModel):
    """시정조치 검증 스키마"""
    verification_result: VerificationResult
    verification_comment: Optional[str] = None


class CorrectiveActionResponse(BaseModel):
    """시정조치 응답 스키마"""
    id: int
    non_conformity_id: int
    action_plan: str
    root_cause: Optional[str] = None
    preventive_measures: Optional[str] = None
    responsible_person_id: int
    responsible_person_name: Optional[str] = None
    planned_completion_date: date
    actual_completion_date: Optional[date] = None
    result_description: Optional[str] = None
    result_evidence_id: Optional[int] = None
    verified_by: Optional[int] = None
    verifier_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_result: Optional[VerificationResult] = None
    verification_comment: Optional[str] = None
    status: CAStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ========== 심사원 계정 스키마 ==========
class AuditorAccountBase(BaseModel):
    """심사원 계정 기본 스키마"""
    valid_from: datetime
    valid_until: datetime
    access_scope: Optional[str] = None  # JSON 형식의 접근 범위
    allow_download: bool = False

    @field_validator("valid_until")
    @classmethod
    def validate_valid_until(cls, v: datetime, info) -> datetime:
        """만료일은 시작일 이후여야 함"""
        valid_from = info.data.get("valid_from")
        if valid_from and v <= valid_from:
            raise ValueError("만료일은 시작일 이후여야 합니다.")
        return v


class AuditorAccountCreate(AuditorAccountBase):
    """심사원 계정 생성 스키마"""
    # 새 사용자 생성 정보
    email: str = Field(..., max_length=255)
    name: str = Field(..., min_length=1, max_length=100)
    audit_plan_id: int


class AuditorAccountUpdate(BaseModel):
    """심사원 계정 수정 스키마"""
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    access_scope: Optional[str] = None
    allow_download: Optional[bool] = None
    is_active: Optional[bool] = None


class AuditorAccountResponse(BaseModel):
    """심사원 계정 응답 스키마"""
    id: int
    user_id: int
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    audit_plan_id: int
    audit_plan_title: Optional[str] = None
    valid_from: datetime
    valid_until: datetime
    access_scope: Optional[str] = None
    allow_download: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuditorAccountList(BaseModel):
    """심사원 계정 목록 스키마"""
    items: List[AuditorAccountResponse]
    total: int
    page: int
    size: int
    pages: int


# ========== 감사 로그 스키마 ==========
class AuditLogResponse(BaseModel):
    """감사 로그 응답 스키마"""
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[int] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    status_code: Optional[int] = None
    error_message: Optional[str] = None
    previous_hash: Optional[str] = None
    current_hash: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogList(BaseModel):
    """감사 로그 목록 스키마"""
    items: List[AuditLogResponse]
    total: int
    page: int
    size: int
    pages: int


class AuditLogFilter(BaseModel):
    """감사 로그 필터 스키마"""
    user_id: Optional[int] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    ip_address: Optional[str] = None


# ========== 심사 대응 자료 패키지 스키마 ==========
class AuditPackageRequest(BaseModel):
    """심사 대응 자료 패키지 요청 스키마"""
    control_domain_codes: Optional[List[str]] = None  # 특정 영역만 선택
    include_index: bool = True  # 목차 포함 여부


class AuditPackageResponse(BaseModel):
    """심사 대응 자료 패키지 응답 스키마"""
    audit_plan_id: int
    audit_plan_title: str
    d_day: int  # 심사일까지 D-day
    package_url: Optional[str] = None  # 다운로드 URL
    index_document_url: Optional[str] = None  # 목차 문서 URL
    total_evidence_count: int
    total_file_size: int  # bytes
    generated_at: datetime
