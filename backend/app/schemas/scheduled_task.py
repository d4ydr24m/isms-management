"""
정기 활동 관련 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ScheduledTaskCreate(BaseModel):
    """정기 활동 생성 스키마"""
    title: str = Field(..., max_length=255, description="활동 제목")
    description: Optional[str] = Field(None, description="활동 설명")
    task_type: str = Field(..., max_length=50, description="활동 유형")
    frequency: str = Field(..., description="주기 (daily/weekly/monthly/quarterly/yearly)")
    cron_expression: Optional[str] = Field(None, max_length=100, description="Cron 표현식")
    assignee_id: int = Field(..., description="담당자 ID")
    escalation_to_id: Optional[int] = Field(None, description="에스컬레이션 대상 ID")
    control_item_id: Optional[int] = Field(None, description="관련 통제항목 ID")
    next_execution_at: datetime = Field(..., description="다음 실행 예정 일시")
    escalation_days: int = Field(3, ge=1, le=30, description="에스컬레이션까지 일수")


class ScheduledTaskUpdate(BaseModel):
    """정기 활동 수정 스키마"""
    title: Optional[str] = Field(None, max_length=255, description="활동 제목")
    description: Optional[str] = Field(None, description="활동 설명")
    task_type: Optional[str] = Field(None, max_length=50, description="활동 유형")
    frequency: Optional[str] = Field(None, description="주기")
    cron_expression: Optional[str] = Field(None, max_length=100, description="Cron 표현식")
    assignee_id: Optional[int] = Field(None, description="담당자 ID")
    escalation_to_id: Optional[int] = Field(None, description="에스컬레이션 대상 ID")
    control_item_id: Optional[int] = Field(None, description="관련 통제항목 ID")
    next_execution_at: Optional[datetime] = Field(None, description="다음 실행 예정 일시")
    status: Optional[str] = Field(None, description="상태 (active/paused/completed)")
    escalation_days: Optional[int] = Field(None, ge=1, le=30, description="에스컬레이션까지 일수")


class ScheduledTaskResponse(BaseModel):
    """정기 활동 응답 스키마"""
    id: int
    title: str
    description: Optional[str] = None
    task_type: str
    frequency: str
    cron_expression: Optional[str] = None
    assignee_id: int
    assignee_name: Optional[str] = None
    escalation_to_id: Optional[int] = None
    escalation_to_name: Optional[str] = None
    control_item_id: Optional[int] = None
    control_item_code: Optional[str] = None
    last_executed_at: Optional[datetime] = None
    next_execution_at: datetime
    status: str
    escalation_days: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScheduledTaskList(BaseModel):
    """정기 활동 목록 스키마"""
    items: List[ScheduledTaskResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TaskExecutionCreate(BaseModel):
    """정기 활동 실행 기록 생성 스키마"""
    status: str = Field(..., description="실행 상태 (completed/failed/skipped)")
    result_summary: Optional[str] = Field(None, description="실행 결과 요약")
    evidence_id: Optional[int] = Field(None, description="증적 ID (실행 결과)")


class TaskExecutionResponse(BaseModel):
    """정기 활동 실행 기록 응답 스키마"""
    id: int
    task_id: int
    executed_by: int
    executor_name: Optional[str] = None
    executed_at: datetime
    status: str
    result_summary: Optional[str] = None
    evidence_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
