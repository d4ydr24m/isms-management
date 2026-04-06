"""
자산 관련 Pydantic 스키마
Phase 2: FR-501 ~ FR-505
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.asset import AssetStatus, AssetAssignmentRole, AssetChangeType


# =============================================================================
# 자산 유형 스키마 (FR-501)
# =============================================================================

class AssetTypeBase(BaseModel):
    """자산 유형 기본 스키마"""
    code: str = Field(..., min_length=1, max_length=20, description="자산 유형 코드")
    name: str = Field(..., min_length=1, max_length=100, description="자산 유형명")
    description: Optional[str] = Field(None, max_length=500, description="설명")
    icon: Optional[str] = Field(None, max_length=50, description="아이콘 이름")
    sort_order: int = Field(default=0, description="정렬 순서")


class AssetTypeCreate(AssetTypeBase):
    """자산 유형 생성 스키마"""
    pass


class AssetTypeUpdate(BaseModel):
    """자산 유형 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class AssetTypeResponse(AssetTypeBase):
    """자산 유형 응답 스키마"""
    id: int
    is_custom: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AssetTypeList(BaseModel):
    """자산 유형 목록 스키마"""
    items: List[AssetTypeResponse]
    total: int


# =============================================================================
# 자산 분류 스키마 (FR-501)
# =============================================================================

class AssetCategoryBase(BaseModel):
    """자산 분류 기본 스키마"""
    code: str = Field(..., min_length=1, max_length=50, description="분류 코드")
    name: str = Field(..., min_length=1, max_length=100, description="분류명")
    description: Optional[str] = Field(None, max_length=500, description="설명")
    level: int = Field(default=1, ge=1, le=3, description="분류 레벨 (1: 대, 2: 중, 3: 소)")
    parent_id: Optional[int] = Field(None, description="상위 분류 ID")
    sort_order: int = Field(default=0, description="정렬 순서")


class AssetCategoryCreate(AssetCategoryBase):
    """자산 분류 생성 스키마"""
    pass


class AssetCategoryUpdate(BaseModel):
    """자산 분류 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class AssetCategoryResponse(AssetCategoryBase):
    """자산 분류 응답 스키마"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    children: List["AssetCategoryResponse"] = []

    model_config = {"from_attributes": True}


class AssetCategoryList(BaseModel):
    """자산 분류 목록 스키마"""
    items: List[AssetCategoryResponse]
    total: int


# =============================================================================
# 자산 스키마 (FR-502)
# =============================================================================

class AssetBase(BaseModel):
    """자산 기본 스키마"""
    name: str = Field(..., min_length=1, max_length=200, description="자산명")
    description: Optional[str] = Field(None, description="자산 설명")
    asset_type_id: int = Field(..., description="자산 유형 ID")
    category_id: Optional[int] = Field(None, description="자산 분류 ID")
    location: Optional[str] = Field(None, max_length=200, description="물리적 위치")
    department_id: Optional[int] = Field(None, description="담당 부서 ID")
    owner_id: Optional[int] = Field(None, description="자산 소유자 ID (사용자)")
    personnel_owner_id: Optional[int] = Field(None, description="자산 소유자 ID (담당자)")
    ip_address: Optional[str] = Field(None, max_length=50, description="IP 주소")
    mac_address: Optional[str] = Field(None, max_length=50, description="MAC 주소")
    hostname: Optional[str] = Field(None, max_length=100, description="호스트명")
    os_version: Optional[str] = Field(None, max_length=100, description="OS 버전")
    serial_number: Optional[str] = Field(None, max_length=100, description="시리얼 번호")
    manufacturer: Optional[str] = Field(None, max_length=100, description="제조사")
    model: Optional[str] = Field(None, max_length=100, description="모델명")
    specifications: Optional[Dict[str, Any]] = Field(None, description="사양 (JSON)")
    acquisition_date: Optional[date] = Field(None, description="취득일")
    acquisition_cost: Optional[int] = Field(None, ge=0, le=9999999999, description="취득 비용 (최대 99억)")
    warranty_end_date: Optional[date] = Field(None, description="보증 만료일")
    status: Optional[str] = Field(None, description="상태 (도입/운영/변경/폐기)")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """자산 상태 검증"""
        if v is not None:
            valid_statuses = [s.value for s in AssetStatus]
            if v not in valid_statuses:
                raise ValueError(f"유효하지 않은 상태입니다. 허용값: {valid_statuses}")
        return v


class AssetCreate(AssetBase):
    """자산 생성 스키마"""
    pass


class AssetUpdate(BaseModel):
    """자산 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    asset_type_id: Optional[int] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    location: Optional[str] = Field(None, max_length=200)
    department_id: Optional[int] = None
    owner_id: Optional[int] = None
    personnel_owner_id: Optional[int] = None
    ip_address: Optional[str] = Field(None, max_length=50)
    mac_address: Optional[str] = Field(None, max_length=50)
    hostname: Optional[str] = Field(None, max_length=100)
    os_version: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    manufacturer: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    specifications: Optional[Dict[str, Any]] = None
    acquisition_date: Optional[date] = None
    acquisition_cost: Optional[int] = None
    warranty_end_date: Optional[date] = None
    status: Optional[str] = Field(None, description="상태 (도입/운영/변경/폐기)")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """자산 상태 검증"""
        if v is not None:
            valid_statuses = [s.value for s in AssetStatus]
            if v not in valid_statuses:
                raise ValueError(f"유효하지 않은 상태입니다. 허용값: {valid_statuses}")
        return v


class AssetResponse(BaseModel):
    """자산 응답 스키마"""
    id: int
    asset_code: str
    name: str
    description: Optional[str] = None
    asset_type_id: int
    asset_type_name: Optional[str] = None
    asset_type_code: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    location: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    personnel_owner_id: Optional[int] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    os_version: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None
    acquisition_date: Optional[date] = None
    acquisition_cost: Optional[int] = None
    warranty_end_date: Optional[date] = None
    disposal_date: Optional[date] = None
    status: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    # 최신 가치 평가 정보
    importance_level: Optional[int] = None
    confidentiality: Optional[int] = None
    integrity: Optional[int] = None
    availability: Optional[int] = None

    model_config = {"from_attributes": True}


class AssetList(BaseModel):
    """자산 목록 스키마"""
    items: List[AssetResponse]
    total: int
    page: int
    size: int
    pages: int


# =============================================================================
# 자산 가치 평가 스키마 (FR-503)
# =============================================================================

class AssetValuationBase(BaseModel):
    """자산 가치 평가 기본 스키마"""
    confidentiality: int = Field(..., ge=1, le=3, description="기밀성 (1: 하, 2: 중, 3: 상)")
    integrity: int = Field(..., ge=1, le=3, description="무결성 (1: 하, 2: 중, 3: 상)")
    availability: int = Field(..., ge=1, le=3, description="가용성 (1: 하, 2: 중, 3: 상)")
    evaluation_reason: Optional[str] = Field(None, description="평가 사유")


class AssetValuationCreate(AssetValuationBase):
    """자산 가치 평가 생성 스키마"""
    pass


class AssetValuationResponse(AssetValuationBase):
    """자산 가치 평가 응답 스키마"""
    id: int
    asset_id: int
    importance_level: Optional[int] = None
    evaluated_by: Optional[int] = None
    evaluator_name: Optional[str] = None
    evaluated_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetValuationHistory(BaseModel):
    """자산 가치 평가 이력"""
    items: List[AssetValuationResponse]


# =============================================================================
# 자산 이력 스키마 (FR-504)
# =============================================================================

class AssetHistoryResponse(BaseModel):
    """자산 변경 이력 응답 스키마"""
    id: int
    asset_id: int
    change_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[int] = None
    changer_name: Optional[str] = None
    changed_at: datetime
    remarks: Optional[str] = None

    model_config = {"from_attributes": True}


class AssetDisposalCreate(BaseModel):
    """자산 폐기 요청 스키마"""
    disposal_date: date = Field(..., description="폐기일")
    disposal_reason: Optional[str] = Field(None, description="폐기 사유")
    disposal_method: Optional[str] = Field(None, max_length=100, description="폐기 방법")
    data_deletion_confirmed: bool = Field(default=False, description="데이터 삭제 확인")
    data_deletion_method: Optional[str] = Field(None, max_length=200, description="데이터 삭제 방법")
    data_deletion_evidence_id: Optional[int] = Field(None, description="데이터 삭제 증적 ID")
    remarks: Optional[str] = Field(None, description="비고")


class AssetDisposalResponse(BaseModel):
    """자산 폐기 응답 스키마"""
    id: int
    asset_id: int
    disposal_date: date
    disposal_reason: Optional[str] = None
    disposal_method: Optional[str] = None
    data_deletion_confirmed: bool
    data_deletion_method: Optional[str] = None
    data_deletion_evidence_id: Optional[int] = None
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    remarks: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssetLifecycleStats(BaseModel):
    """자산 생명주기 통계"""
    by_status: Dict[str, int]
    total: int
    introduced_this_month: int
    disposed_this_month: int


# =============================================================================
# 자산 담당자 스키마 (FR-505)
# =============================================================================

class AssetAssignmentBase(BaseModel):
    """자산 담당자 할당 기본 스키마"""
    user_id: int = Field(..., description="담당자 ID")
    role: str = Field(
        default=AssetAssignmentRole.USER.value,
        description="역할 (owner/manager/user)"
    )
    remarks: Optional[str] = Field(None, description="비고")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """담당자 역할 검증"""
        valid_roles = [r.value for r in AssetAssignmentRole]
        if v not in valid_roles:
            raise ValueError(f"유효하지 않은 역할입니다. 허용값: {valid_roles}")
        return v


class AssetAssignmentCreate(AssetAssignmentBase):
    """자산 담당자 할당 생성 스키마"""
    pass


class AssetAssignmentUpdate(BaseModel):
    """자산 담당자 할당 수정 스키마"""
    role: Optional[str] = None
    remarks: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        """담당자 역할 검증"""
        if v is not None:
            valid_roles = [r.value for r in AssetAssignmentRole]
            if v not in valid_roles:
                raise ValueError(f"유효하지 않은 역할입니다. 허용값: {valid_roles}")
        return v


class AssetAssignmentResponse(BaseModel):
    """자산 담당자 할당 응답 스키마"""
    id: int
    asset_id: int
    user_id: Optional[int] = None
    personnel_id: Optional[int] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    role: str
    assigned_at: datetime
    assigned_by: Optional[int] = None
    assigner_name: Optional[str] = None
    is_active: bool
    remarks: Optional[str] = None

    model_config = {"from_attributes": True}


class AssetHandoverResponse(BaseModel):
    """자산 인수인계 응답 스키마"""
    id: int
    asset_id: int
    from_user_id: int
    from_user_name: Optional[str] = None
    to_user_id: int
    to_user_name: Optional[str] = None
    handover_date: date
    checklist_items: Optional[Dict[str, Any]] = None
    checklist_completed: bool
    remarks: Optional[str] = None
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# 엑셀 임포트 스키마 (FR-502)
# =============================================================================

class AssetImportRow(BaseModel):
    """자산 임포트 행"""
    name: str
    asset_type_code: str
    category_code: Optional[str] = None
    location: Optional[str] = None
    department_code: Optional[str] = None
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None


class AssetImportResult(BaseModel):
    """자산 임포트 결과"""
    total: int
    success: int
    failed: int
    errors: List[Dict[str, Any]]


# =============================================================================
# 자산 통계 스키마
# =============================================================================

class AssetStats(BaseModel):
    """자산 전체 통계"""
    total_count: int
    active_count: int
    by_status: Dict[str, int]
    by_importance: Dict[int, int]
    recent_added: int
    recent_disposed: int


class AssetByTypeStats(BaseModel):
    """유형별 자산 통계"""
    type_id: int
    type_code: str
    type_name: str
    count: int
    active_count: int


class AssetByDepartmentStats(BaseModel):
    """부서별 자산 통계"""
    department_id: int
    department_name: str
    count: int
    by_importance: Dict[int, int]


class AssetByImportanceStats(BaseModel):
    """중요도별 자산 통계"""
    importance_level: int
    label: str
    count: int
    percentage: float


# Forward reference 해결
AssetCategoryResponse.model_rebuild()
