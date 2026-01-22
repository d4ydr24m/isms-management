"""
통제항목 관련 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ControlDomainBase(BaseModel):
    """통제영역 기본 스키마"""
    code: str = Field(..., max_length=10, description="영역 코드")
    name: str = Field(..., max_length=100, description="영역명")
    description: Optional[str] = Field(None, description="설명")
    sort_order: int = Field(0, description="정렬 순서")


class ControlDomainCreate(ControlDomainBase):
    """통제영역 생성 스키마"""
    pass


class ControlDomainResponse(ControlDomainBase):
    """통제영역 응답 스키마"""
    id: int
    categories: List["ControlCategoryResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ControlCategoryBase(BaseModel):
    """통제항목 카테고리 기본 스키마"""
    domain_id: int = Field(..., description="영역 ID")
    code: str = Field(..., max_length=10, description="카테고리 코드")
    name: str = Field(..., max_length=100, description="카테고리명")
    description: Optional[str] = Field(None, description="설명")
    sort_order: int = Field(0, description="정렬 순서")


class ControlCategoryCreate(ControlCategoryBase):
    """통제항목 카테고리 생성 스키마"""
    pass


class ControlCategoryResponse(ControlCategoryBase):
    """통제항목 카테고리 응답 스키마"""
    id: int
    control_items: List["ControlItemSimple"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ControlItemBase(BaseModel):
    """통제항목 기본 스키마"""
    category_id: int = Field(..., description="카테고리 ID")
    code: str = Field(..., max_length=20, description="통제항목 번호")
    title: str = Field(..., max_length=200, description="통제항목 제목")
    description: str = Field(..., description="통제항목 설명")
    objective: Optional[str] = Field(None, description="통제 목적")
    requirements: Optional[str] = Field(None, description="요구사항")
    is_required: bool = Field(True, description="필수 통제항목 여부")
    is_personal_info: bool = Field(False, description="개인정보보호 통제항목 여부")
    sort_order: int = Field(0, description="정렬 순서")
    tags: Optional[str] = Field(None, max_length=255, description="태그 (쉼표로 구분)")


class ControlItemCreate(ControlItemBase):
    """통제항목 생성 스키마"""
    pass


class ControlItemSimple(BaseModel):
    """통제항목 간략 응답 스키마"""
    id: int
    code: str
    title: str
    is_required: bool = True

    model_config = ConfigDict(from_attributes=True)


class ControlItemResponse(ControlItemBase):
    """통제항목 응답 스키마"""
    id: int
    evidence_count: int = Field(0, description="연결된 증적 수")

    model_config = ConfigDict(from_attributes=True)


class ControlItemDetail(ControlItemResponse):
    """통제항목 상세 응답 스키마 (증적 목록 포함)"""
    evidences: List["EvidenceSimple"] = Field(default_factory=list)


class ControlItemList(BaseModel):
    """통제항목 목록 페이지네이션 스키마"""
    items: List[ControlItemResponse]
    total: int = Field(..., description="전체 항목 수")
    page: int = Field(..., description="현재 페이지")
    page_size: int = Field(..., description="페이지 크기")
    total_pages: int = Field(..., description="전체 페이지 수")


class DomainProgress(BaseModel):
    """영역별 진행률 스키마"""
    domain_id: int
    domain_name: str
    total: int = Field(..., description="전체 통제항목 수")
    with_evidence: int = Field(..., description="증적이 있는 통제항목 수")
    coverage_rate: float = Field(..., description="커버리지 비율 (%)")


class ControlProgressResponse(BaseModel):
    """통제항목 진행률 응답 스키마"""
    total_controls: int = Field(..., description="전체 통제항목 수")
    controls_with_evidence: int = Field(..., description="증적이 있는 통제항목 수")
    coverage_rate: float = Field(..., description="전체 커버리지 비율 (%)")
    by_domain: List[DomainProgress] = Field(default_factory=list, description="영역별 진행률")


# 순환 참조 해결을 위한 지연 참조
class EvidenceSimple(BaseModel):
    """증적 간략 스키마 (순환 참조 방지)"""
    id: int
    title: str
    version: str
    status: str

    model_config = ConfigDict(from_attributes=True)


# Forward references 업데이트
ControlDomainResponse.model_rebuild()
ControlCategoryResponse.model_rebuild()
ControlItemDetail.model_rebuild()
