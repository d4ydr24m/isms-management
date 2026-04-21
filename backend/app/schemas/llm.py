"""
LLM(Qwen2.5-VL) 보완조치내역서 초안 관련 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class LLMGenerateRequest(BaseModel):
    """보완조치내역서 초안 생성 요청"""

    non_conformity_id: int = Field(..., description="부적합 ID")
    evidence_ids: List[int] = Field(
        default_factory=list,
        description="첨부 증적(스크린샷) ID 목록. 이미지 MIME 타입만 LLM에 전달됨.",
    )


class LLMGenerateResponse(BaseModel):
    """생성 요청 수락 응답"""

    task_id: str = Field(..., description="폴링에 사용할 Celery task ID")
    suggestion_id: int = Field(..., description="LLMSuggestion 레코드 ID")
    status: str = Field(..., description="초기 상태 (보통 pending)")


class LLMSuggestionResponse(BaseModel):
    """초안 레코드 응답"""

    id: int
    non_conformity_id: int
    task_id: str
    status: str = Field(..., description="pending/running/succeeded/failed")
    model_name: str
    result_text: Optional[str] = None
    error_message: Optional[str] = None
    evidence_ids: List[int] = Field(default_factory=list)
    created_by: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    # model_name 필드가 pydantic의 보호 네임스페이스 model_ 과 충돌하므로 비워둔다.
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


class LLMSuggestionList(BaseModel):
    """초안 목록 응답"""

    items: List[LLMSuggestionResponse]
    total: int


class LLMMyDraftRow(BaseModel):
    """
    '내 초안' 배지용 경량 응답 행.

    배지는 NC 간을 오가며 표시되므로 NC 제목을 함께 내려준다.
    본문(result_text)은 포함하지 않는다 — 배지 팝오버는 카드 진입만 제공한다.
    """

    id: int
    non_conformity_id: int
    non_conformity_title: Optional[str] = None
    task_id: str
    status: str = Field(..., description="pending/running/succeeded/failed")
    created_at: datetime
    completed_at: Optional[datetime] = None
    # 실패 시 배지 팝오버에서 사용자에게 바로 원인을 보여주기 위해 포함.
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LLMMyDraftsResponse(BaseModel):
    """'내 초안' 배지 응답 — 활성 건 + 최근 완료 건 요약."""

    active_count: int = Field(
        ..., description="내 계정의 현재 대기/진행 중 초안 수 (pending+running)"
    )
    items: List[LLMMyDraftRow]
