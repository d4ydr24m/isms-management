"""
증적 관련 Pydantic 스키마
"""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EvidenceCreate(BaseModel):
    """증적 생성 스키마"""
    title: str = Field(..., max_length=255, description="증적 제목")
    description: Optional[str] = Field(None, description="증적 설명")
    evidence_type: Optional[str] = Field(None, max_length=50, description="증적 유형")
    valid_from: Optional[date] = Field(None, description="유효 시작일")
    valid_until: Optional[date] = Field(None, description="유효 만료일")
    control_ids: List[int] = Field(default_factory=list, description="연결할 통제항목 ID 목록")
    author: Optional[str] = Field(None, max_length=100, description="작성자")


class EvidenceUpdate(BaseModel):
    """증적 수정 스키마"""
    title: Optional[str] = Field(None, max_length=255, description="증적 제목")
    description: Optional[str] = Field(None, description="증적 설명")
    valid_from: Optional[date] = Field(None, description="유효 시작일")
    valid_until: Optional[date] = Field(None, description="유효 만료일")
    author: Optional[str] = Field(None, max_length=100, description="작성자")
    status: Optional[str] = Field(None, description="상태 (active/expired/archived)")


class EvidenceResponse(BaseModel):
    """증적 응답 스키마"""
    id: int
    title: str
    description: Optional[str] = None
    file_path: str
    file_name: str
    file_hash: str
    file_size: int
    mime_type: Optional[str] = None
    version: str
    status: str
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    uploader_id: int
    uploader_name: Optional[str] = None
    author: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    control_ids: List[int] = Field(default_factory=list, description="연결된 통제항목 ID 목록")
    control_codes: List[str] = Field(default_factory=list, description="연결된 통제항목 코드 목록")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceSimpleResponse(BaseModel):
    """증적 간략 응답 스키마 (목록용)"""
    id: int
    title: str
    file_path: str
    file_name: str
    file_hash: str
    file_size: int
    mime_type: Optional[str] = None
    version: str
    status: str
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    uploader_id: int
    uploader_name: Optional[str] = None
    control_ids: List[int] = Field(default_factory=list)
    control_codes: List[str] = Field(default_factory=list)
    control_items_info: List[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceList(BaseModel):
    """증적 목록 페이지네이션 스키마"""
    items: List[EvidenceSimpleResponse]
    total: int = Field(..., description="전체 항목 수")
    page: int = Field(..., description="현재 페이지")
    page_size: int = Field(..., description="페이지 크기")
    total_pages: int = Field(..., description="전체 페이지 수")


class EvidenceVersionCreate(BaseModel):
    """증적 버전 생성 스키마"""
    change_description: Optional[str] = Field(None, description="변경 설명")


class EvidenceVersionResponse(BaseModel):
    """증적 버전 응답 스키마"""
    id: int
    evidence_id: int
    version: str
    file_path: str
    file_name: str
    file_size: int
    file_hash: str
    uploaded_by: int
    uploader_name: Optional[str] = None
    change_description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceTemplateCreate(BaseModel):
    """증적 템플릿 생성 스키마"""
    name: str = Field(..., max_length=255, description="템플릿명")
    description: Optional[str] = Field(None, description="템플릿 설명")
    category: str = Field(..., max_length=50, description="템플릿 카테고리")


class EvidenceTemplateResponse(BaseModel):
    """증적 템플릿 응답 스키마"""
    id: int
    name: str
    description: Optional[str] = None
    category: str
    file_path: str
    file_name: str
    mime_type: Optional[str] = None
    is_system_template: bool
    created_by: Optional[int] = None
    creator_name: Optional[str] = None
    download_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EvidenceTemplateList(BaseModel):
    """증적 템플릿 목록 스키마"""
    items: List[EvidenceTemplateResponse]
    total: int


class EvidenceMappingRequest(BaseModel):
    """증적-통제항목 매핑 요청 스키마"""
    control_ids: List[int] = Field(..., description="매핑할 통제항목 ID 목록")


class ExpiringEvidenceResponse(BaseModel):
    """만료 예정 증적 응답 스키마"""
    id: int
    title: str
    file_name: str
    valid_until: date
    days_until_expiry: int = Field(..., description="만료까지 남은 일수")
    status: str
    uploader_id: int
    uploader_name: Optional[str] = None
    control_codes: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ExpiringEvidenceList(BaseModel):
    """만료 예정 증적 목록 스키마"""
    items: List[ExpiringEvidenceResponse]
    total: int
    days_threshold: int = Field(..., description="만료 임계일 수")
