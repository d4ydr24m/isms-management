"""
위험 관리 Pydantic 스키마
Phase 2: FR-601 ~ FR-607

위협 DB, 취약점 DB, 위험 평가, DoA 관리, 위험 처리 계획, SOA 관리
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# =============================================================================
# 위협 분류 스키마
# =============================================================================

class ThreatCategoryBase(BaseModel):
    """위협 분류 기본 스키마"""
    code: str = Field(..., min_length=1, max_length=50, description="위협 분류 코드")
    name: str = Field(..., min_length=1, max_length=100, description="위협 분류명")
    description: Optional[str] = Field(None, max_length=500, description="설명")
    parent_id: Optional[int] = Field(None, description="상위 분류 ID")
    sort_order: int = Field(default=0, description="정렬 순서")


class ThreatCategoryCreate(ThreatCategoryBase):
    """위협 분류 생성 스키마"""
    pass


class ThreatCategoryResponse(ThreatCategoryBase):
    """위협 분류 응답 스키마"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    children: List["ThreatCategoryResponse"] = []

    model_config = {"from_attributes": True}


# =============================================================================
# 4.1.1: 위협 스키마 (FR-601)
# =============================================================================

class ThreatBase(BaseModel):
    """위협 기본 스키마"""
    code: str = Field(..., min_length=1, max_length=50, description="위협 코드")
    name: str = Field(..., min_length=1, max_length=200, description="위협명")
    description: Optional[str] = Field(None, description="위협 설명")
    category_id: Optional[int] = Field(None, description="위협 분류 ID")
    threat_level: int = Field(default=2, ge=1, le=5, description="위협 등급 (1: 매우 낮음, 2: 낮음, 3: 보통, 4: 높음, 5: 매우 높음)")


class ThreatCreate(ThreatBase):
    """위협 생성 스키마"""
    pass


class ThreatUpdate(BaseModel):
    """위협 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: Optional[int] = None
    threat_level: Optional[int] = Field(None, ge=1, le=5)
    is_active: Optional[bool] = None


class ThreatResponse(ThreatBase):
    """위협 응답 스키마"""
    id: int
    category_name: Optional[str] = None
    is_custom: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ThreatList(BaseModel):
    """위협 목록 스키마"""
    items: List[ThreatResponse]
    total: int


# =============================================================================
# 취약점 분류 스키마
# =============================================================================

class VulnerabilityCategoryBase(BaseModel):
    """취약점 분류 기본 스키마"""
    code: str = Field(..., min_length=1, max_length=50, description="취약점 분류 코드")
    name: str = Field(..., min_length=1, max_length=100, description="취약점 분류명")
    description: Optional[str] = Field(None, max_length=500, description="설명")
    parent_id: Optional[int] = Field(None, description="상위 분류 ID")
    sort_order: int = Field(default=0, description="정렬 순서")


class VulnerabilityCategoryCreate(VulnerabilityCategoryBase):
    """취약점 분류 생성 스키마"""
    pass


class VulnerabilityCategoryResponse(VulnerabilityCategoryBase):
    """취약점 분류 응답 스키마"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# =============================================================================
# 4.1.2: 취약점 스키마 (FR-602)
# =============================================================================

class VulnerabilityBase(BaseModel):
    """취약점 기본 스키마"""
    code: str = Field(..., min_length=1, max_length=50, description="취약점 코드")
    name: str = Field(..., min_length=1, max_length=200, description="취약점명")
    description: Optional[str] = Field(None, description="취약점 설명")
    category_id: Optional[int] = Field(None, description="취약점 분류 ID")
    vulnerability_level: int = Field(default=3, ge=1, le=5, description="취약점 등급 (1: 매우 낮음, 2: 낮음, 3: 보통, 4: 높음, 5: 매우 높음)")


class VulnerabilityCreate(VulnerabilityBase):
    """취약점 생성 스키마"""
    pass


class VulnerabilityUpdate(BaseModel):
    """취약점 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: Optional[int] = None
    vulnerability_level: Optional[int] = Field(None, ge=1, le=5)
    is_active: Optional[bool] = None


class VulnerabilityResponse(VulnerabilityBase):
    """취약점 응답 스키마"""
    id: int
    category_name: Optional[str] = None
    is_custom: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VulnerabilityList(BaseModel):
    """취약점 목록 스키마"""
    items: List[VulnerabilityResponse]
    total: int


class VulnerabilityAssessmentCreate(BaseModel):
    """취약점 점검 결과 생성 스키마"""
    asset_id: int = Field(..., description="자산 ID")
    vulnerability_id: int = Field(..., description="취약점 ID")
    is_vulnerable: bool = Field(default=False, description="취약 여부")
    assessment_date: date = Field(..., description="점검일")
    findings: Optional[str] = Field(None, description="점검 결과/발견 사항")
    remediation_status: str = Field(default="open", description="조치 상태")
    remarks: Optional[str] = Field(None, description="비고")

    @field_validator("remediation_status")
    @classmethod
    def validate_remediation_status(cls, v: str) -> str:
        valid_statuses = ["open", "in_progress", "closed", "accepted"]
        if v not in valid_statuses:
            raise ValueError(f"유효하지 않은 상태입니다. 허용값: {valid_statuses}")
        return v


class VulnerabilityAssessmentResponse(BaseModel):
    """취약점 점검 결과 응답 스키마"""
    id: int
    asset_id: int
    asset_name: Optional[str] = None
    asset_code: Optional[str] = None
    vulnerability_id: int
    vulnerability_name: Optional[str] = None
    vulnerability_code: Optional[str] = None
    is_vulnerable: bool
    assessment_date: date
    assessed_by: Optional[int] = None
    assessor_name: Optional[str] = None
    findings: Optional[str] = None
    remediation_status: str
    remediation_date: Optional[date] = None
    remarks: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VulnerabilityAssessmentList(BaseModel):
    """취약점 점검 결과 목록 스키마"""
    items: List[VulnerabilityAssessmentResponse]
    total: int
    page: int
    size: int
    pages: int


# =============================================================================
# 4.1.3: 위험 시나리오 스키마 (FR-603)
# =============================================================================

class RiskScenarioBase(BaseModel):
    """위험 시나리오 기본 스키마"""
    name: str = Field(..., min_length=1, max_length=200, description="시나리오명")
    description: Optional[str] = Field(None, description="시나리오 설명")
    start_date: date = Field(..., description="평가 시작일")
    end_date: Optional[date] = Field(None, description="평가 종료일")


class RiskScenarioCreate(RiskScenarioBase):
    """위험 시나리오 생성 스키마"""
    pass


class RiskScenarioUpdate(BaseModel):
    """위험 시나리오 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_statuses = ["draft", "in_progress", "completed", "cancelled"]
            if v not in valid_statuses:
                raise ValueError(f"유효하지 않은 상태입니다. 허용값: {valid_statuses}")
        return v


class RiskScenarioResponse(RiskScenarioBase):
    """위험 시나리오 응답 스키마"""
    id: int
    status: str
    created_by: int
    creator_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    assessment_count: int = 0
    high_risk_count: int = 0
    exceeding_doa_count: int = 0

    model_config = {"from_attributes": True}


class RiskScenarioList(BaseModel):
    """위험 시나리오 목록 스키마"""
    items: List[RiskScenarioResponse]
    total: int
    page: int
    size: int
    pages: int


# =============================================================================
# 4.1.4: 위험 평가 스키마 (FR-603)
# =============================================================================

class RiskAssessmentBase(BaseModel):
    """위험 평가 기본 스키마"""
    asset_id: int = Field(..., description="자산 ID")
    threat_id: int = Field(..., description="위협 ID")
    vulnerability_id: int = Field(..., description="취약점 ID")
    asset_value: int = Field(..., ge=1, le=3, description="자산 가치 (1: 하, 2: 중, 3: 상)")
    threat_level: int = Field(..., ge=1, le=5, description="위협 등급 (1: 매우 낮음, 2: 낮음, 3: 보통, 4: 높음, 5: 매우 높음)")
    vulnerability_level: int = Field(..., ge=1, le=3, description="취약점 등급 (1: 하, 2: 중, 3: 상)")
    remarks: Optional[str] = Field(None, description="평가 의견")


class RiskAssessmentCreate(RiskAssessmentBase):
    """위험 평가 생성 스키마"""
    pass


class RiskAssessmentUpdate(BaseModel):
    """위험 평가 수정 스키마"""
    asset_id: Optional[int] = None
    threat_id: Optional[int] = None
    vulnerability_id: Optional[int] = None
    asset_value: Optional[int] = Field(None, ge=1, le=5)
    threat_level: Optional[int] = Field(None, ge=1, le=5)
    vulnerability_level: Optional[int] = Field(None, ge=1, le=5)
    remarks: Optional[str] = None


class RiskAssessmentResponse(BaseModel):
    """위험 평가 응답 스키마"""
    id: int
    scenario_id: int
    asset_id: int
    asset_name: Optional[str] = None
    asset_code: Optional[str] = None
    threat_id: int
    threat_name: Optional[str] = None
    vulnerability_id: int
    vulnerability_name: Optional[str] = None
    asset_value: int
    threat_level: int
    vulnerability_level: int
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    exceeds_doa: bool = False
    evaluated_by: Optional[int] = None
    evaluator_name: Optional[str] = None
    evaluated_at: Optional[datetime] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    has_treatment_plan: bool = False

    model_config = {"from_attributes": True}


class RiskAssessmentList(BaseModel):
    """위험 평가 목록 스키마"""
    items: List[RiskAssessmentResponse]
    total: int
    page: int
    size: int
    pages: int


class RiskAssessmentBulkCreate(BaseModel):
    """위험 평가 대량 생성 스키마"""
    assessments: List[RiskAssessmentCreate]


# =============================================================================
# 4.1.5: DoA 설정 스키마 (FR-604)
# =============================================================================

class DoAConfigBase(BaseModel):
    """DoA 설정 기본 스키마"""
    threshold_value: int = Field(..., ge=1, le=27, description="DoA 임계값 (1-27)")
    effective_date: date = Field(..., description="적용 시작일")
    expiry_date: Optional[date] = Field(None, description="적용 종료일")
    remarks: Optional[str] = Field(None, description="비고")


class DoAConfigCreate(DoAConfigBase):
    """DoA 설정 생성 스키마"""
    pass


class DoAConfigResponse(DoAConfigBase):
    """DoA 설정 응답 스키마"""
    id: int
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    approval_date: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DoAHistoryResponse(BaseModel):
    """DoA 변경 이력 응답 스키마"""
    id: int
    doa_config_id: int
    old_threshold: Optional[int] = None
    new_threshold: int
    change_reason: Optional[str] = None
    changed_by: int
    changer_name: Optional[str] = None
    changed_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# 4.1.6: 위험 처리 계획 스키마 (FR-605)
# =============================================================================

VALID_TREATMENT_STRATEGIES = ["reduce", "avoid", "transfer", "accept"]
VALID_TREATMENT_STATUSES = ["planned", "in_progress", "completed", "cancelled"]


class RiskTreatmentPlanBase(BaseModel):
    """위험 처리 계획 기본 스키마"""
    strategy: str = Field(..., description="처리 전략 (reduce/avoid/transfer/accept)")
    description: Optional[str] = Field(None, description="처리 계획 설명")
    assignee_id: Optional[int] = Field(None, description="담당자 ID")
    due_date: Optional[date] = Field(None, description="완료 예정일")
    budget: Optional[int] = Field(None, ge=0, description="예산 (원)")

    @field_validator("strategy")
    @classmethod
    def validate_strategy(cls, v: str) -> str:
        if v not in VALID_TREATMENT_STRATEGIES:
            raise ValueError(f"유효하지 않은 전략입니다. 허용값: {VALID_TREATMENT_STRATEGIES}")
        return v


class RiskTreatmentPlanCreate(RiskTreatmentPlanBase):
    """위험 처리 계획 생성 스키마"""
    pass


class RiskTreatmentPlanUpdate(BaseModel):
    """위험 처리 계획 수정 스키마"""
    strategy: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None
    budget: Optional[int] = Field(None, ge=0)
    status: Optional[str] = None

    @field_validator("strategy")
    @classmethod
    def validate_strategy(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TREATMENT_STRATEGIES:
            raise ValueError(f"유효하지 않은 전략입니다. 허용값: {VALID_TREATMENT_STRATEGIES}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TREATMENT_STATUSES:
            raise ValueError(f"유효하지 않은 상태입니다. 허용값: {VALID_TREATMENT_STATUSES}")
        return v


class RiskTreatmentPlanResponse(BaseModel):
    """위험 처리 계획 응답 스키마"""
    id: int
    risk_assessment_id: int
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    asset_name: Optional[str] = None
    threat_name: Optional[str] = None
    vulnerability_name: Optional[str] = None
    strategy: str
    strategy_name: Optional[str] = None  # 한글 전략명
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    due_date: Optional[date] = None
    budget: Optional[int] = None
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    action_count: int = 0
    latest_residual_risk: Optional[int] = None

    model_config = {"from_attributes": True}


class RiskTreatmentPlanList(BaseModel):
    """위험 처리 계획 목록 스키마"""
    items: List[RiskTreatmentPlanResponse]
    total: int
    page: int
    size: int
    pages: int


class RiskTreatmentActionCreate(BaseModel):
    """위험 처리 조치 생성 스키마"""
    action_description: str = Field(..., min_length=1, description="조치 내용")
    result: Optional[str] = Field(None, description="조치 결과")
    residual_risk_score: Optional[int] = Field(None, ge=1, le=27, description="잔여 위험 점수")
    evidence_file_path: Optional[str] = Field(None, max_length=500, description="증적 파일 경로")

    @field_validator("evidence_file_path")
    @classmethod
    def validate_file_path(cls, v: Optional[str]) -> Optional[str]:
        """경로 탐색 공격 방지 및 허용된 파일 확장자만 허용"""
        if v is None:
            return v

        import os
        import re

        # 경로 탐색 패턴 차단 (../, ..\, 절대 경로)
        if ".." in v or v.startswith("/") or re.match(r"^[a-zA-Z]:", v):
            raise ValueError("잘못된 파일 경로입니다. 상대 경로만 허용됩니다.")

        # 허용된 확장자만 허용
        allowed_extensions = [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".zip"]
        ext = os.path.splitext(v)[1].lower()
        if ext and ext not in allowed_extensions:
            raise ValueError(f"허용되지 않은 파일 형식입니다. 허용: {', '.join(allowed_extensions)}")

        return v


class RiskTreatmentActionResponse(BaseModel):
    """위험 처리 조치 응답 스키마"""
    id: int
    plan_id: int
    action_description: str
    result: Optional[str] = None
    residual_risk_score: Optional[int] = None
    completed_by: Optional[int] = None
    completer_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    evidence_file_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RiskTreatmentProgress(BaseModel):
    """위험 처리 진행률 스키마"""
    total: int
    completed: int
    in_progress: int
    planned: int
    cancelled: int
    completion_rate: float


# =============================================================================
# 4.1.7: SOA 스키마 (FR-606)
# =============================================================================

VALID_IMPLEMENTATION_STATUSES = [
    "fully_implemented",
    "partially_implemented",
    "planned",
    "not_implemented",
    "not_applicable",
]


class SOARecordUpdate(BaseModel):
    """SOA 레코드 수정 스키마"""
    is_applicable: Optional[bool] = None
    exclusion_reason: Optional[str] = None
    implementation_status: Optional[str] = None
    implementation_evidence: Optional[str] = None
    related_assets: Optional[str] = None
    related_risks: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("implementation_status")
    @classmethod
    def validate_implementation_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_IMPLEMENTATION_STATUSES:
            raise ValueError(f"유효하지 않은 상태입니다. 허용값: {VALID_IMPLEMENTATION_STATUSES}")
        return v


class SOARecordResponse(BaseModel):
    """SOA 레코드 응답 스키마"""
    id: int
    control_item_id: int
    control_code: Optional[str] = None
    control_title: Optional[str] = None
    control_description: Optional[str] = None
    is_applicable: bool
    exclusion_reason: Optional[str] = None
    implementation_status: str
    implementation_status_name: Optional[str] = None  # 한글명
    implementation_evidence: Optional[str] = None
    related_assets: Optional[str] = None
    related_risks: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SOARecordList(BaseModel):
    """SOA 레코드 목록 스키마"""
    items: List[SOARecordResponse]
    total: int
    applicable_count: int
    not_applicable_count: int


class SOAExportRequest(BaseModel):
    """SOA 내보내기 요청 스키마"""
    format: str = Field(default="excel", description="내보내기 형식 (excel/word)")
    template_type: str = Field(default="isms_p", description="템플릿 유형 (isms_p/iso27001)")

    @field_validator("format")
    @classmethod
    def validate_format(cls, v: str) -> str:
        if v not in ["excel", "word"]:
            raise ValueError("형식은 excel 또는 word만 허용됩니다.")
        return v

    @field_validator("template_type")
    @classmethod
    def validate_template_type(cls, v: str) -> str:
        if v not in ["isms_p", "iso27001"]:
            raise ValueError("템플릿 유형은 isms_p 또는 iso27001만 허용됩니다.")
        return v


# =============================================================================
# 위험 통계 및 보고서 스키마 (FR-607)
# =============================================================================

class RiskDistribution(BaseModel):
    """위험 분포 스키마"""
    high: int
    medium: int
    low: int
    total: int


class CellRiskLevel(BaseModel):
    """셀별 위험등급 분포"""
    high: int = 0
    medium: int = 0
    low: int = 0


class RiskMatrixData(BaseModel):
    """위험 매트릭스 데이터 스키마"""
    matrix: List[List[int]]
    cell_risk_levels: Optional[List[List[CellRiskLevel]]] = None
    cell_asset_values: Optional[List[List[List[int]]]] = None
    labels: Dict[str, List[str]]


class ScenarioComparison(BaseModel):
    """시나리오 비교 스키마"""
    scenario1_id: int
    scenario1_name: str
    scenario2_id: int
    scenario2_name: str
    risk_count_diff: int
    high_risk_diff: int
    avg_risk_score_diff: float


class RiskReportSummary(BaseModel):
    """위험 평가 보고서 요약 스키마"""
    scenario_id: int
    scenario_name: str
    assessment_period: str
    total_assets: int
    total_risks: int
    risk_distribution: RiskDistribution
    exceeding_doa_count: int
    treatment_progress: RiskTreatmentProgress
    top_risks: List[RiskAssessmentResponse]


class ExecutiveSummary(BaseModel):
    """경영진 요약 스키마"""
    report_date: date
    scenario_name: str
    key_findings: List[str]
    risk_overview: Dict[str, Any]
    recommendations: List[str]
    action_items: List[Dict[str, Any]]


# =============================================================================
# 5.4: 위험-통제항목 연계 스키마
# =============================================================================


class RiskTreatmentControlLinkBase(BaseModel):
    """위험 처리 계획-통제항목 연결 기본 스키마"""
    treatment_plan_id: int = Field(..., description="위험 처리 계획 ID")
    control_item_id: int = Field(..., description="통제항목 ID")
    link_type: str = Field(
        default="primary",
        description="연결 유형 (primary: 주요, secondary: 부차적, related: 관련)",
    )
    effectiveness_rating: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="효과성 등급 (0.0 ~ 1.0)",
    )
    remarks: Optional[str] = Field(None, description="비고")

    @field_validator("link_type")
    @classmethod
    def validate_link_type(cls, v: str) -> str:
        valid_types = ("primary", "secondary", "related")
        if v not in valid_types:
            raise ValueError(f"link_type은 {valid_types} 중 하나여야 합니다")
        return v


class RiskTreatmentControlLinkCreate(BaseModel):
    """위험 처리 계획-통제항목 연결 생성 스키마"""
    treatment_plan_id: int = Field(..., description="위험 처리 계획 ID")
    control_item_ids: List[int] = Field(..., description="연결할 통제항목 ID 목록")
    link_type: str = Field(default="primary")
    effectiveness_rating: Optional[float] = Field(None, ge=0.0, le=1.0)
    remarks: Optional[str] = None


class RiskTreatmentControlLinkResponse(RiskTreatmentControlLinkBase):
    """위험 처리 계획-통제항목 연결 응답 스키마"""
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ControlItemBriefResponse(BaseModel):
    """통제항목 간략 정보"""
    id: int
    code: str
    title: str

    model_config = {"from_attributes": True}


class LinkedControlDetailResponse(BaseModel):
    """연결된 통제항목 상세 응답"""
    id: int
    control_item: ControlItemBriefResponse
    link_type: str
    effectiveness_rating: Optional[float] = None
    created_at: datetime
    remarks: Optional[str] = None


class ControlEffectivenessAnalysis(BaseModel):
    """통제 효과성 분석 응답"""
    control_item_id: int
    linked_treatment_count: int
    average_effectiveness: float
    implementation_rate: float
    residual_risk_summary: Dict[str, Any]


class RiskControlCoverageAnalysis(BaseModel):
    """위험-통제 커버리지 분석"""
    total_risks: int
    controlled_risks: int
    coverage_percentage: float


class RiskControlMatrixResponse(BaseModel):
    """위험-통제 매트릭스 응답"""
    matrix: List[Dict[str, Any]]
    coverage_analysis: RiskControlCoverageAnalysis
    uncontrolled_risks: List[Dict[str, Any]]
    control_summary: Dict[str, Any]


class ResidualRiskTrendResponse(BaseModel):
    """잔여 위험 추이 응답"""
    treatment_plan_id: int
    initial_risk_score: int
    current_residual_score: int
    trend_data: List[Dict[str, Any]]
    reduction_percentage: float


class BulkLinkControlsRequest(BaseModel):
    """대량 연결 요청"""
    links: List[RiskTreatmentControlLinkCreate]


class BulkLinkControlsResponse(BaseModel):
    """대량 연결 응답"""
    success_count: int
    failed_count: int


# Forward reference 해결
ThreatCategoryResponse.model_rebuild()
