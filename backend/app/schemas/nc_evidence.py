"""
부적합-증적 매핑 관련 Pydantic 스키마.

audit.py 의 NonConformity/CorrectiveAction 스키마와 분리하여, 매핑 전용 엔드포인트
(attach/detach/list/upload-and-attach) 의 입출력을 명확히 한다.
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class EvidenceRole(str, Enum):
    """부적합 증적의 역할. LLM 에 조치 전/후를 명확히 전달하기 위해 분류한다."""

    BEFORE = "before"      # 조치 전 — 현재 문제 상태
    AFTER = "after"        # 조치 후 — 개선된 상태
    SUPPORT = "support"    # 신청서·결재 등 조치 근거 문서
    REFERENCE = "reference"  # 역할 미지정 (기본값)


class NcEvidenceAttachRequest(BaseModel):
    """기존 증적 ID들을 부적합에 첨부한다."""

    evidence_ids: List[int] = Field(..., min_length=1, description="첨부할 증적 ID 목록")
    mapping_note: Optional[str] = Field(
        None, max_length=1000, description="이 묶음에 공통 적용할 매핑 메모"
    )
    role: EvidenceRole = Field(
        default=EvidenceRole.REFERENCE,
        description="이 묶음에 공통 적용할 역할 (before/after/support/reference)",
    )


class NcEvidenceNoteUpdate(BaseModel):
    """단일 매핑의 메모만 수정한다."""

    mapping_note: Optional[str] = Field(
        None, max_length=1000, description="매핑 메모 (null 로 삭제)"
    )


class NcEvidenceRoleUpdate(BaseModel):
    """단일 매핑의 role 만 수정한다."""

    role: EvidenceRole = Field(
        ..., description="역할 (before/after/support/reference)"
    )


class NcEvidenceItem(BaseModel):
    """
    부적합에 연결된 증적 한 건.

    증적의 기본 표시 필드를 포함하여 프런트가 추가 조회 없이 카드를 그릴 수 있도록 한다.
    """

    mapping_id: int = Field(..., description="매핑 레코드(nc_evidence_mappings.id)")
    evidence_id: int
    title: str
    file_name: str
    file_size: int
    mime_type: Optional[str] = None
    mapping_note: Optional[str] = None
    role: EvidenceRole = EvidenceRole.REFERENCE
    mapped_by: Optional[int] = None
    mapped_at: datetime
    uploader_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NcEvidenceList(BaseModel):
    items: List[NcEvidenceItem]
    total: int
