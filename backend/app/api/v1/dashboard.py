"""
대시보드 API

6.2 대시보드 API 구현
- GET /dashboard/summary - 전체 요약
- GET /dashboard/progress - 진척률 게이지 데이터
- GET /dashboard/activities - 금일/금주 예정 활동
- GET /dashboard/expiring-evidences - 만료 예정 증적
- GET /dashboard/pending-tasks - 미완료 업무
- GET /dashboard/nonconformities - 부적합 현황
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.services.dashboard_service import DashboardService
from app.schemas.dashboard import (
    DashboardSummary,
    ProgressData,
    ActivitiesData,
    ExpiringEvidencesData,
    ExpiredEvidencesData,
    ExpiringAssetsData,
    PendingTask,
    NonConformitySummary,
)


router = APIRouter(prefix="/dashboard", tags=["대시보드"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:
    """
    6.2.1 대시보드 전체 요약 조회

    모든 대시보드 데이터를 한 번에 반환합니다.

    Returns:
        DashboardSummary: 대시보드 전체 요약 데이터
    """
    service = DashboardService(db)
    data = service.get_dashboard_summary()

    return DashboardSummary(
        progress=ProgressData(**data["progress"]),
        activities=ActivitiesData(**data["activities"]),
        expiring_evidences=ExpiringEvidencesData(**data["expiring_evidences"]),
        expired_evidences=ExpiredEvidencesData(**data["expired_evidences"]),
        expiring_assets=ExpiringAssetsData(**data["expiring_assets"]),
        pending_tasks=PendingTask(**data["pending_tasks"]),
        non_conformities=NonConformitySummary(**data["non_conformities"]),
    )


@router.get("/progress", response_model=ProgressData)
def get_dashboard_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressData:
    """
    6.2.2 진척률 게이지 데이터 조회

    전체 진척률과 영역별 진척률을 반환합니다.

    Returns:
        ProgressData: 진척률 데이터
    """
    service = DashboardService(db)
    data = service.calculate_progress_rate()

    return ProgressData(**data)


@router.get("/activities", response_model=ActivitiesData)
def get_dashboard_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ActivitiesData:
    """
    6.2.3 금일/금주 예정 활동 조회

    오늘 예정 활동과 이번 주 예정 활동 목록을 반환합니다.

    Returns:
        ActivitiesData: 예정 활동 데이터
    """
    service = DashboardService(db)
    data = service.get_scheduled_activities()

    return ActivitiesData(**data)


@router.get("/expiring-evidences", response_model=ExpiringEvidencesData)
def get_expiring_evidences(
    days: int = Query(default=30, ge=1, le=365, description="조회 기간 (일)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExpiringEvidencesData:
    """
    6.2.4 만료 예정 증적 조회

    지정된 기간 내 만료 예정인 증적 목록을 반환합니다.

    Args:
        days: 조회 기간 (기본 30일, 최대 365일)

    Returns:
        ExpiringEvidencesData: 만료 예정 증적 데이터
    """
    service = DashboardService(db)
    data = service.get_expiring_evidences(days=days)

    return ExpiringEvidencesData(**data)


@router.get("/expiring-assets", response_model=ExpiringAssetsData)
def get_expiring_assets(
    days: int = Query(default=90, ge=1, le=365, description="조회 기간 (일)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExpiringAssetsData:
    """
    6.2.4.1 보증 만료 예정 자산 조회

    지정된 기간 내 보증 만료 예정인 자산 목록을 반환합니다.

    Args:
        days: 조회 기간 (기본 90일, 최대 365일)

    Returns:
        ExpiringAssetsData: 만료 예정 자산 데이터
    """
    service = DashboardService(db)
    data = service.get_expiring_assets(days=days)

    return ExpiringAssetsData(**data)


@router.get("/pending-tasks", response_model=PendingTask)
def get_pending_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PendingTask:
    """
    6.2.5 미완료 업무 조회

    시정조치 미완료, 미확보 증적 등 미완료 업무 집계를 반환합니다.

    Returns:
        PendingTask: 미완료 업무 데이터
    """
    service = DashboardService(db)
    data = service.get_pending_tasks()

    return PendingTask(**data)


@router.get("/nonconformities", response_model=NonConformitySummary)
def get_nonconformities_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NonConformitySummary:
    """
    6.2.6 부적합 현황 조회

    상태별/등급별 부적합 집계를 반환합니다.

    Returns:
        NonConformitySummary: 부적합 현황 데이터
    """
    service = DashboardService(db)
    data = service.get_nonconformity_summary()

    return NonConformitySummary(**data)
