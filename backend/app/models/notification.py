from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Notification(Base):
    """
    알림 모델
    """

    __tablename__ = "notifications"

    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="수신자 ID"
    )
    notification_type = Column(
        String(50),
        nullable=False,
        comment="알림 유형 (evidence_expiring/task_due/nc_assigned/audit_scheduled 등)",
    )
    title = Column(String(255), nullable=False, comment="알림 제목")
    message = Column(Text, nullable=False, comment="알림 메시지")

    # 우선순위
    priority = Column(
        String(20), default="normal", nullable=False, comment="우선순위 (low/normal/high/urgent)"
    )

    # 링크 정보
    link_url = Column(String(500), nullable=True, comment="관련 페이지 URL")
    reference_type = Column(
        String(50), nullable=True, comment="참조 타입 (evidence/task/audit 등)"
    )
    reference_id = Column(Integer, nullable=True, comment="참조 ID")

    # 상태
    is_read = Column(Boolean, default=False, nullable=False, index=True, comment="읽음 여부")
    read_at = Column(DateTime, nullable=True, comment="읽은 일시")

    # 관계
    user = relationship("User", backref="notifications")

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.notification_type})>"


class NotificationSetting(Base):
    """
    알림 설정 모델
    사용자별 알림 채널 및 주기 설정
    """

    __tablename__ = "notification_settings"

    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, comment="사용자 ID"
    )
    notification_type = Column(
        String(50), nullable=False, comment="알림 유형"
    )

    # 채널 설정
    email_enabled = Column(Boolean, default=True, nullable=False, comment="이메일 알림 활성화")
    app_enabled = Column(Boolean, default=True, nullable=False, comment="앱 알림 활성화")

    # 주기 설정
    frequency = Column(
        String(20),
        default="realtime",
        nullable=False,
        comment="알림 주기 (realtime/daily/weekly)",
    )

    # 관계
    user = relationship("User", backref="notification_settings")

    def __repr__(self) -> str:
        return f"<NotificationSetting(user_id={self.user_id}, type={self.notification_type})>"
