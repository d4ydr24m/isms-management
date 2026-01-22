"""
정기 활동 API
정기 활동 CRUD 및 실행 기록
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_role
from app.models.scheduled_task import ScheduledTask, TaskExecution
from app.models.user import User
from app.schemas.scheduled_task import (
    ScheduledTaskCreate,
    ScheduledTaskUpdate,
    ScheduledTaskResponse,
    ScheduledTaskList,
    TaskExecutionCreate,
    TaskExecutionResponse,
)

router = APIRouter()


def get_task_response(task: ScheduledTask) -> dict:
    """ScheduledTask 모델을 응답 딕셔너리로 변환"""
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "task_type": task.task_type,
        "frequency": task.frequency,
        "cron_expression": task.cron_expression,
        "assignee_id": task.assignee_id,
        "assignee_name": task.assignee.name if task.assignee else None,
        "escalation_to_id": task.escalation_to_id,
        "escalation_to_name": task.escalation_to.name if task.escalation_to else None,
        "control_item_id": task.control_item_id,
        "control_item_code": task.control_item.code if task.control_item else None,
        "last_executed_at": task.last_executed_at,
        "next_execution_at": task.next_execution_at,
        "status": task.status,
        "escalation_days": task.escalation_days,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


@router.get("", response_model=ScheduledTaskList)
def get_scheduled_tasks(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    status_filter: Optional[str] = Query(None, alias="status", description="상태 필터"),
    frequency: Optional[str] = Query(None, description="주기 필터"),
    assignee_id: Optional[int] = Query(None, description="담당자 ID 필터"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    정기 활동 목록 조회

    페이지네이션 및 필터링 지원
    """
    query = db.query(ScheduledTask)

    # 상태 필터
    if status_filter:
        query = query.filter(ScheduledTask.status == status_filter)

    # 주기 필터
    if frequency:
        query = query.filter(ScheduledTask.frequency == frequency)

    # 담당자 필터
    if assignee_id:
        query = query.filter(ScheduledTask.assignee_id == assignee_id)

    # 전체 개수
    total = query.count()

    # 페이지네이션
    offset = (page - 1) * page_size
    tasks = (
        query
        .order_by(ScheduledTask.next_execution_at)
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [get_task_response(t) for t in tasks]
    total_pages = (total + page_size - 1) // page_size

    return ScheduledTaskList(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=ScheduledTaskResponse, status_code=status.HTTP_201_CREATED)
def create_scheduled_task(
    task_create: ScheduledTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    정기 활동 생성

    CISO 또는 보안담당자만 생성 가능
    """
    task = ScheduledTask(
        title=task_create.title,
        description=task_create.description,
        task_type=task_create.task_type,
        frequency=task_create.frequency,
        cron_expression=task_create.cron_expression,
        assignee_id=task_create.assignee_id,
        escalation_to_id=task_create.escalation_to_id,
        control_item_id=task_create.control_item_id,
        next_execution_at=task_create.next_execution_at,
        status="active",
        escalation_days=task_create.escalation_days,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return get_task_response(task)


@router.get("/{task_id}", response_model=ScheduledTaskResponse)
def get_scheduled_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    정기 활동 상세 조회
    """
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="정기 활동을 찾을 수 없습니다.",
        )

    return get_task_response(task)


@router.put("/{task_id}", response_model=ScheduledTaskResponse)
def update_scheduled_task(
    task_id: int,
    task_update: ScheduledTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    정기 활동 수정

    CISO 또는 보안담당자만 수정 가능
    """
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="정기 활동을 찾을 수 없습니다.",
        )

    # 업데이트
    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return get_task_response(task)


@router.post("/{task_id}/execute", response_model=ScheduledTaskResponse)
def execute_scheduled_task(
    task_id: int,
    execution: TaskExecutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    정기 활동 실행 기록

    실행 결과를 기록하고 다음 실행 예정일을 업데이트합니다.
    """
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="정기 활동을 찾을 수 없습니다.",
        )

    # 실행 기록 생성
    task_execution = TaskExecution(
        task_id=task_id,
        executed_by=current_user.id,
        status=execution.status,
        result_summary=execution.result_summary,
        evidence_id=execution.evidence_id,
    )
    db.add(task_execution)

    # 마지막 실행 시간 업데이트
    task.last_executed_at = datetime.utcnow()

    # 다음 실행 예정일 계산 (간단한 구현)
    from datetime import timedelta

    frequency_map = {
        "daily": timedelta(days=1),
        "weekly": timedelta(weeks=1),
        "monthly": timedelta(days=30),
        "quarterly": timedelta(days=90),
        "yearly": timedelta(days=365),
    }
    delta = frequency_map.get(task.frequency, timedelta(days=30))
    task.next_execution_at = datetime.utcnow() + delta

    db.commit()
    db.refresh(task)

    return get_task_response(task)


@router.get("/{task_id}/executions", response_model=List[TaskExecutionResponse])
def get_task_executions(
    task_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    정기 활동 실행 히스토리 조회
    """
    # 정기 활동 존재 확인
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="정기 활동을 찾을 수 없습니다.",
        )

    offset = (page - 1) * page_size
    executions = (
        db.query(TaskExecution)
        .filter(TaskExecution.task_id == task_id)
        .order_by(TaskExecution.executed_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return [
        TaskExecutionResponse(
            id=e.id,
            task_id=e.task_id,
            executed_by=e.executed_by,
            executor_name=e.executor.name if e.executor else None,
            executed_at=e.executed_at,
            status=e.status,
            result_summary=e.result_summary,
            evidence_id=e.evidence_id,
            created_at=e.created_at,
        )
        for e in executions
    ]


@router.delete("/{task_id}", response_model=ScheduledTaskResponse)
def delete_scheduled_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    정기 활동 비활성화

    CISO 또는 보안담당자만 삭제 가능
    """
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="정기 활동을 찾을 수 없습니다.",
        )

    task.status = "completed"
    db.commit()
    db.refresh(task)

    return get_task_response(task)
