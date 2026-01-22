"""
알림 API (7.4)
알림 목록, 읽음 처리, 설정 관리 엔드포인트
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.user import User
from app.schemas.notification import (
    BulkNotificationSettingUpdate,
    NotificationFrequency,
    NotificationList,
    NotificationResponse,
    NotificationSettingsResponse,
    NotificationType,
)
from app.services.notification_service import NotificationService


router = APIRouter()


# ============== 7.4.1 GET /notifications ==============

@router.get("", response_model=NotificationList)
def get_notifications(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    is_read: Optional[bool] = Query(None, description="읽음 여부 필터"),
    notification_type: Optional[str] = Query(None, description="알림 유형 필터"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    알림 목록 조회

    - 현재 사용자의 알림 목록을 페이지네이션하여 반환
    - is_read 파라미터로 읽음/안읽음 필터링 가능
    - notification_type 파라미터로 알림 유형 필터링 가능
    """
    service = NotificationService(db)

    # 알림 유형 변환
    notif_type = None
    if notification_type:
        try:
            notif_type = NotificationType(notification_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"유효하지 않은 알림 유형입니다: {notification_type}",
            )

    result = service.get_notifications(
        user_id=current_user.id,
        is_read=is_read,
        notification_type=notif_type,
        page=page,
        page_size=page_size,
    )

    return NotificationList(
        items=[NotificationResponse.model_validate(item) for item in result["items"]],
        total=result["total"],
        unread_count=result["unread_count"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    읽지 않은 알림 개수 조회
    """
    service = NotificationService(db)
    count = service.get_unread_count(current_user.id)

    return {"unread_count": count}


# ============== 7.4.2 PUT /notifications/{id}/read ==============

@router.put("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    단일 알림 읽음 처리

    - 해당 알림이 현재 사용자의 것인지 확인 후 읽음 처리
    """
    service = NotificationService(db)
    result = service.mark_as_read(notification_id, current_user.id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없거나 접근 권한이 없습니다.",
        )

    return {"success": True, "message": "알림을 읽음 처리했습니다."}


# ============== 7.4.3 PUT /notifications/read-all ==============

@router.put("/read-all")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    모든 알림 읽음 처리

    - 현재 사용자의 모든 읽지 않은 알림을 읽음 처리
    """
    service = NotificationService(db)
    count = service.mark_all_as_read(current_user.id)

    return {
        "success": True,
        "count": count,
        "message": f"{count}개의 알림을 읽음 처리했습니다.",
    }


# ============== 7.4.4 GET /notifications/settings ==============

@router.get("/settings", response_model=NotificationSettingsResponse)
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    알림 설정 조회

    - 현재 사용자의 알림 설정 목록 반환
    - 설정이 없는 경우 기본값으로 초기화
    """
    service = NotificationService(db)
    settings = service.get_notification_settings(current_user.id)

    return NotificationSettingsResponse(settings=settings)


# ============== 7.4.5 PUT /notifications/settings ==============

@router.put("/settings", response_model=NotificationSettingsResponse)
def update_notification_settings(
    settings_data: BulkNotificationSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    알림 설정 변경

    - 여러 알림 유형의 설정을 한 번에 변경
    """
    service = NotificationService(db)

    # 설정 데이터 변환
    settings_list = []
    for setting in settings_data.settings:
        settings_list.append({
            "notification_type": setting.notification_type,
            "email_enabled": setting.email_enabled,
            "app_enabled": setting.app_enabled,
            "frequency": setting.frequency,
        })

    updated_settings = service.update_bulk_notification_settings(
        user_id=current_user.id,
        settings_data=settings_list,
    )

    # 전체 설정 반환
    all_settings = service.get_notification_settings(current_user.id)

    return NotificationSettingsResponse(settings=all_settings)


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    알림 삭제

    - 해당 알림이 현재 사용자의 것인지 확인 후 삭제
    """
    service = NotificationService(db)
    result = service.delete_notification(notification_id, current_user.id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없거나 접근 권한이 없습니다.",
        )

    return {"success": True, "message": "알림을 삭제했습니다."}
