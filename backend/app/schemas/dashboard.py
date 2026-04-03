"""
대시보드 스키마

6.0 대시보드 응답 스키마 정의
"""
from datetime import date, datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class DomainProgress(BaseModel):
    """영역별 진척률"""

    domain_id: int = Field(..., description="영역 ID")
    domain_code: str = Field(..., description="영역 코드")
    domain_name: str = Field(..., description="영역명")
    total_controls: int = Field(..., description="전체 통제항목 수")
    controls_with_evidence: int = Field(..., description="증적 확보 통제항목 수")
    progress_rate: float = Field(..., description="진척률 (%)")


class ProgressData(BaseModel):
    """진척률 데이터"""

    total_progress: float = Field(..., description="전체 진척률 (%)")
    total_controls: int = Field(..., description="전체 통제항목 수")
    controls_with_evidence: int = Field(..., description="증적 확보 통제항목 수")
    domain_progress: List[DomainProgress] = Field(default_factory=list, description="영역별 진척률")


class ActivityItem(BaseModel):
    """예정 활동 항목"""

    id: int = Field(..., description="활동 ID")
    title: str = Field(..., description="활동 제목")
    description: Optional[str] = Field(None, description="활동 설명")
    task_type: str = Field(..., description="활동 유형")
    frequency: str = Field(..., description="주기")
    next_execution_at: datetime = Field(..., description="다음 실행 예정일시")
    assignee_name: Optional[str] = Field(None, description="담당자 이름")
    control_item_code: Optional[str] = Field(None, description="관련 통제항목 코드")


class ActivitiesData(BaseModel):
    """예정 활동 데이터"""

    today: List[ActivityItem] = Field(default_factory=list, description="금일 예정 활동")
    this_week: List[ActivityItem] = Field(default_factory=list, description="금주 예정 활동")


class ExpiringEvidence(BaseModel):
    """만료 예정 증적"""

    id: int = Field(..., description="증적 ID")
    title: str = Field(..., description="증적 제목")
    file_name: str = Field(..., description="파일명")
    valid_until: date = Field(..., description="유효 만료일")
    days_remaining: int = Field(..., description="남은 일수")
    status: str = Field(..., description="상태")
    control_item_codes: List[str] = Field(default_factory=list, description="연결된 통제항목 코드")


class ExpiringEvidencesData(BaseModel):
    """만료 예정 증적 데이터"""

    evidences: List[ExpiringEvidence] = Field(default_factory=list, description="만료 예정 증적 목록")
    count: int = Field(..., description="만료 예정 증적 수")


class ExpiredEvidence(BaseModel):
    """만료된 증적"""

    id: int = Field(..., description="증적 ID")
    title: str = Field(..., description="증적 제목")
    file_name: str = Field(..., description="파일명")
    valid_until: date = Field(..., description="유효 만료일")
    days_overdue: int = Field(..., description="초과 일수")
    status: str = Field(..., description="상태")
    control_item_codes: List[str] = Field(default_factory=list, description="연결된 통제항목 코드")


class ExpiredEvidencesData(BaseModel):
    """만료된 증적 데이터"""

    evidences: List[ExpiredEvidence] = Field(default_factory=list, description="만료된 증적 목록")
    count: int = Field(..., description="만료된 증적 수")


class PendingTask(BaseModel):
    """미완료 업무"""

    uncompleted_corrective_actions: int = Field(..., description="미완료 시정조치 건수")
    controls_without_evidence: int = Field(..., description="미확보 증적 통제항목 수")
    overdue_tasks: int = Field(0, description="기한 초과 업무 수")
    upcoming_deadlines: int = Field(0, description="7일 내 마감 예정 업무 수")


class NonConformitySummary(BaseModel):
    """부적합 현황 요약"""

    total: int = Field(..., description="전체 부적합 수")
    by_status: Dict[str, int] = Field(default_factory=dict, description="상태별 부적합 수")
    by_severity: Dict[str, int] = Field(default_factory=dict, description="심각도별 부적합 수")
    by_type: Dict[str, int] = Field(default_factory=dict, description="유형별 부적합 수")


class DashboardSummary(BaseModel):
    """대시보드 전체 요약"""

    progress: ProgressData = Field(..., description="인증 준비 진척률")
    activities: ActivitiesData = Field(..., description="예정 보안 활동")
    expiring_evidences: ExpiringEvidencesData = Field(..., description="만료 예정 증적")
    expired_evidences: ExpiredEvidencesData = Field(default_factory=lambda: ExpiredEvidencesData(evidences=[], count=0), description="만료된 증적")
    pending_tasks: PendingTask = Field(..., description="미완료 업무")
    non_conformities: NonConformitySummary = Field(..., description="부적합 현황")
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="생성 시각")
