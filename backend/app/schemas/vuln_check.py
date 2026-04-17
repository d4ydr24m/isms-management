"""
취약점 점검 스크립트 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# =============================================================================
# 취약점 점검 스크립트 스키마
# =============================================================================

VALID_SCRIPT_TYPES = ["python", "shell", "powershell", "custom"]


class VulnCheckScriptCreate(BaseModel):
    """스크립트 생성 스키마 (파일 업로드는 multipart로 처리)"""
    name: str = Field(..., min_length=1, max_length=200, description="스크립트명")
    description: Optional[str] = Field(None, description="스크립트 설명")
    script_type: str = Field(..., description="스크립트 유형")
    version: str = Field(default="1.0", max_length=50, description="스크립트 버전")
    category_id: Optional[int] = Field(None, description="취약점 분류 ID")
    target_asset_type_id: Optional[int] = Field(None, description="대상 자산 유형 ID")

    @field_validator("script_type")
    @classmethod
    def validate_script_type(cls, v: str) -> str:
        if v not in VALID_SCRIPT_TYPES:
            raise ValueError(f"유효하지 않은 스크립트 유형입니다. 허용값: {VALID_SCRIPT_TYPES}")
        return v


class VulnCheckScriptUpdate(BaseModel):
    """스크립트 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    script_type: Optional[str] = None
    version: Optional[str] = Field(None, max_length=50)
    category_id: Optional[int] = None
    target_asset_type_id: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("script_type")
    @classmethod
    def validate_script_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_SCRIPT_TYPES:
            raise ValueError(f"유효하지 않은 스크립트 유형입니다. 허용값: {VALID_SCRIPT_TYPES}")
        return v


class VulnCheckScriptResponse(BaseModel):
    """스크립트 응답 스키마"""
    id: int
    name: str
    description: Optional[str] = None
    script_type: str
    file_name: str
    file_size: Optional[int] = None
    version: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    target_asset_type_id: Optional[int] = None
    target_asset_type_name: Optional[str] = None
    is_active: bool
    uploaded_by: int
    uploader_name: Optional[str] = None
    schedule_count: int = 0
    execution_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VulnCheckScriptList(BaseModel):
    """스크립트 목록 스키마"""
    items: List[VulnCheckScriptResponse]
    total: int


# =============================================================================
# 취약점 점검 스케줄 스키마
# =============================================================================

class VulnCheckScheduleCreate(BaseModel):
    """스케줄 생성 스키마"""
    script_id: int = Field(..., description="스크립트 ID")
    name: str = Field(..., min_length=1, max_length=200, description="스케줄명")
    description: Optional[str] = Field(None, description="스케줄 설명")
    cron_expression: str = Field(..., max_length=100, description="Cron 표현식")
    target_asset_ids: Optional[List[int]] = Field(None, description="대상 자산 ID 목록")

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str) -> str:
        parts = v.strip().split()
        if len(parts) != 5:
            raise ValueError("Cron 표현식은 5개 필드여야 합니다 (분 시 일 월 요일)")
        return v.strip()


class VulnCheckScheduleUpdate(BaseModel):
    """스케줄 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    cron_expression: Optional[str] = Field(None, max_length=100)
    target_asset_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            parts = v.strip().split()
            if len(parts) != 5:
                raise ValueError("Cron 표현식은 5개 필드여야 합니다 (분 시 일 월 요일)")
            return v.strip()
        return v


class VulnCheckScheduleResponse(BaseModel):
    """스케줄 응답 스키마"""
    id: int
    script_id: int
    script_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    cron_expression: str
    target_asset_ids: Optional[List[int]] = None
    is_active: bool
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_by: int
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VulnCheckScheduleList(BaseModel):
    """스케줄 목록 스키마"""
    items: List[VulnCheckScheduleResponse]
    total: int


# =============================================================================
# 취약점 점검 실행 결과 스키마
# =============================================================================

class VulnCheckExecutionCreate(BaseModel):
    """실행 생성 스키마 (수동 실행)"""
    script_id: int = Field(..., description="스크립트 ID")
    asset_ids: List[int] = Field(..., min_length=1, description="대상 자산 ID 목록")


class VulnCheckExecutionUpdate(BaseModel):
    """실행 결과 업데이트 스키마"""
    status: str = Field(..., description="실행 상태 (completed/failed/cancelled)")
    result_summary: Optional[str] = Field(None, description="결과 요약")
    result_detail: Optional[str] = Field(None, description="상세 결과")
    vulnerabilities_found: int = Field(default=0, ge=0, description="발견된 취약점 수 (취약+경고)")
    severity_high: int = Field(default=0, ge=0, description="취약 (VULN) 항목 수")
    severity_medium: int = Field(default=0, ge=0, description="경고 (WARN) 항목 수")
    severity_low: int = Field(default=0, ge=0, description="미사용 (현행 점검 스크립트는 Low 티어 없음)")
    info_count: int = Field(default=0, ge=0, description="정보 (INFO) 항목 수 - 참조용")
    error_message: Optional[str] = Field(None, description="에러 메시지")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = ["pending", "running", "completed", "failed", "cancelled"]
        if v not in valid:
            raise ValueError(f"유효하지 않은 상태입니다. 허용값: {valid}")
        return v


class VulnCheckExecutionResponse(BaseModel):
    """실행 결과 응답 스키마"""
    id: int
    script_id: int
    script_name: Optional[str] = None
    schedule_id: Optional[int] = None
    schedule_name: Optional[str] = None
    asset_id: int
    asset_name: Optional[str] = None
    asset_code: Optional[str] = None
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_summary: Optional[str] = None
    result_detail: Optional[str] = None
    vulnerabilities_found: Optional[int] = 0
    severity_high: Optional[int] = 0
    severity_medium: Optional[int] = 0
    severity_low: Optional[int] = 0
    info_count: Optional[int] = 0
    executed_by: Optional[int] = None
    executor_name: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VulnCheckExecutionList(BaseModel):
    """실행 결과 목록 스키마"""
    items: List[VulnCheckExecutionResponse]
    total: int
    page: int
    size: int
    pages: int


# =============================================================================
# 통계 스키마
# =============================================================================

class VulnCheckStats(BaseModel):
    """취약점 점검 통계"""
    total_scripts: int = 0
    active_scripts: int = 0
    total_schedules: int = 0
    active_schedules: int = 0
    total_executions: int = 0
    recent_executions: int = 0
    total_vulnerabilities_found: int = 0
    severity_distribution: dict = Field(default_factory=lambda: {"high": 0, "medium": 0, "low": 0, "info": 0})
