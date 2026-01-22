"""
알림 관련 Pydantic 스키마
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class NotificationType(str, Enum):
    """알림 유형"""
    EVIDENCE_EXPIRING = "evidence_expiring"
    TASK_DUE = "task_due"
    NC_ASSIGNED = "nc_assigned"  # NonConformity assigned
    AUDIT_SCHEDULED = "audit_scheduled"
    CORRECTIVE_ACTION_DUE = "corrective_action_due"
    AUDIT_DDAY = "audit_dday"
    SYSTEM = "system"


class NotificationPriority(str, Enum):
    """알림 우선순위"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationFrequency(str, Enum):
    """알림 주기"""
    REALTIME = "realtime"
    DAILY = "daily"
    WEEKLY = "weekly"


# ============== Notification Schemas ==============


class NotificationBase(BaseModel):
    """알림 기본 스키마"""
    notification_type: NotificationType
    title: str = Field(..., max_length=255)
    message: str
    priority: NotificationPriority = NotificationPriority.NORMAL
    link_url: Optional[str] = Field(None, max_length=500)
    reference_type: Optional[str] = Field(None, max_length=50)
    reference_id: Optional[int] = None


class NotificationCreate(NotificationBase):
    """알림 생성 스키마"""
    user_id: int


class NotificationUpdate(BaseModel):
    """알림 업데이트 스키마"""
    is_read: Optional[bool] = None


class NotificationResponse(NotificationBase):
    """알림 응답 스키마"""
    id: int
    user_id: int
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationList(BaseModel):
    """알림 목록 응답 스키마"""
    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int


# ============== Notification Setting Schemas ==============


class NotificationSettingBase(BaseModel):
    """알림 설정 기본 스키마"""
    notification_type: NotificationType
    email_enabled: bool = True
    app_enabled: bool = True
    frequency: NotificationFrequency = NotificationFrequency.REALTIME


class NotificationSettingCreate(NotificationSettingBase):
    """알림 설정 생성 스키마"""
    pass


class NotificationSettingUpdate(BaseModel):
    """알림 설정 업데이트 스키마"""
    email_enabled: Optional[bool] = None
    app_enabled: Optional[bool] = None
    frequency: Optional[NotificationFrequency] = None


class NotificationSettingResponse(NotificationSettingBase):
    """알림 설정 응답 스키마"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationSettingsResponse(BaseModel):
    """알림 설정 목록 응답 스키마"""
    settings: List[NotificationSettingResponse]


class BulkNotificationSettingUpdate(BaseModel):
    """일괄 알림 설정 업데이트 스키마"""
    settings: List[NotificationSettingCreate]


# ============== WebSocket Schemas ==============


class WebSocketMessage(BaseModel):
    """WebSocket 메시지 스키마"""
    type: str
    data: dict


class WebSocketNotification(BaseModel):
    """WebSocket 알림 메시지 스키마"""
    notification_id: int
    notification_type: NotificationType
    title: str
    message: str
    priority: NotificationPriority
    link_url: Optional[str] = None
    created_at: datetime
