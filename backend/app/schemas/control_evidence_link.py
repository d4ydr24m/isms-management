"""
통제항목-증적출처 연결 스키마
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# 허용되는 source_type 값
VALID_SOURCE_TYPES = [
    "assets",
    "risks",
    "audits",
    "evidence",
    "vuln_check",
    "isms_scope",
    "personnel",
    "departments",
    "soa",
]


class ControlEvidenceLinkCreate(BaseModel):
    """증적출처 연결 생성 스키마"""
    control_item_id: int = Field(..., description="통제항목 ID")
    source_type: str = Field(..., max_length=50, description="출처 모듈")
    source_id: Optional[int] = Field(None, description="출처 레코드 ID (NULL이면 모듈 전체)")
    source_label: str = Field(..., max_length=200, description="출처 표시명")
    source_url: str = Field(..., max_length=500, description="프론트엔드 라우트 경로")
    description: Optional[str] = Field(None, description="증적 출처 설명")


class ControlEvidenceLinkUpdate(BaseModel):
    """증적출처 연결 수정 스키마"""
    source_label: Optional[str] = Field(None, max_length=200, description="출처 표시명")
    description: Optional[str] = Field(None, description="증적 출처 설명")


class ControlEvidenceLinkResponse(BaseModel):
    """증적출처 연결 응답 스키마"""
    id: int
    control_item_id: int
    source_type: str
    source_id: Optional[int]
    source_label: str
    source_url: str
    description: Optional[str]
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ControlEvidenceLinkList(BaseModel):
    """증적출처 연결 목록 스키마"""
    items: List[ControlEvidenceLinkResponse]
    total: int
