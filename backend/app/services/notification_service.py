"""
알림 서비스 (7.1)
알림 생성, 조회, 읽음 처리, 설정 관리
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationSetting
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationType,
    NotificationPriority,
    NotificationFrequency,
)


class NotificationService:
    """알림 서비스 클래스"""

    # 기본 알림 유형 목록 (설정 초기화용)
    DEFAULT_NOTIFICATION_TYPES = [
        NotificationType.EVIDENCE_EXPIRING,
        NotificationType.TASK_DUE,
        NotificationType.NC_ASSIGNED,
        NotificationType.AUDIT_SCHEDULED,
        NotificationType.CORRECTIVE_ACTION_DUE,
        NotificationType.AUDIT_DDAY,
        NotificationType.SYSTEM,
    ]

    def __init__(self, db: Session):
        self.db = db

    # ============== 7.1.1 알림 생성 ==============

    def create_notification(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        link_url: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
    ) -> Notification:
        """
        알림 생성

        Args:
            user_id: 수신자 ID
            notification_type: 알림 유형
            title: 알림 제목
            message: 알림 메시지
            priority: 우선순위
            link_url: 관련 페이지 URL
            reference_type: 참조 타입
            reference_id: 참조 ID

        Returns:
            생성된 알림

        Raises:
            ValueError: 사용자를 찾을 수 없는 경우
        """
        # 사용자 존재 확인
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("사용자를 찾을 수 없습니다")

        notification = Notification(
            user_id=user_id,
            notification_type=notification_type.value if isinstance(notification_type, NotificationType) else notification_type,
            title=title,
            message=message,
            priority=priority.value if isinstance(priority, NotificationPriority) else priority,
            link_url=link_url,
            reference_type=reference_type,
            reference_id=reference_id,
            is_read=False,
        )

        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)

        return notification

    def create_bulk_notifications(
        self,
        user_ids: List[int],
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        link_url: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
    ) -> List[Notification]:
        """
        여러 사용자에게 알림 일괄 생성

        Args:
            user_ids: 수신자 ID 목록
            notification_type: 알림 유형
            title: 알림 제목
            message: 알림 메시지
            priority: 우선순위
            link_url: 관련 페이지 URL
            reference_type: 참조 타입
            reference_id: 참조 ID

        Returns:
            생성된 알림 목록
        """
        notifications = []
        for user_id in user_ids:
            try:
                notification = self.create_notification(
                    user_id=user_id,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    priority=priority,
                    link_url=link_url,
                    reference_type=reference_type,
                    reference_id=reference_id,
                )
                notifications.append(notification)
            except ValueError:
                # 사용자가 없는 경우 건너뛰기
                continue

        return notifications

    # ============== 7.1.2 알림 조회 ==============

    def get_notifications(
        self,
        user_id: int,
        is_read: Optional[bool] = None,
        notification_type: Optional[NotificationType] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """
        알림 목록 조회

        Args:
            user_id: 사용자 ID
            is_read: 읽음 여부 필터 (None: 전체)
            notification_type: 알림 유형 필터
            page: 페이지 번호
            page_size: 페이지 크기

        Returns:
            알림 목록 및 메타 정보
        """
        query = self.db.query(Notification).filter(Notification.user_id == user_id)

        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)

        if notification_type is not None:
            type_value = notification_type.value if isinstance(notification_type, NotificationType) else notification_type
            query = query.filter(Notification.notification_type == type_value)

        # 총 개수
        total = query.count()

        # 읽지 않은 알림 개수
        unread_count = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).count()

        # 페이지네이션 및 정렬 (최신순)
        query = query.order_by(Notification.created_at.desc())
        offset = (page - 1) * page_size
        items = query.offset(offset).limit(page_size).all()

        return {
            "items": items,
            "total": total,
            "unread_count": unread_count,
            "page": page,
            "page_size": page_size,
        }

    def get_notification_by_id(
        self,
        notification_id: int,
        user_id: int,
    ) -> Optional[Notification]:
        """
        특정 알림 조회

        Args:
            notification_id: 알림 ID
            user_id: 사용자 ID (권한 확인용)

        Returns:
            알림 또는 None
        """
        return self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        ).first()

    def get_unread_count(self, user_id: int) -> int:
        """
        읽지 않은 알림 개수 조회

        Args:
            user_id: 사용자 ID

        Returns:
            읽지 않은 알림 개수
        """
        return self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).count()

    # ============== 7.1.3 알림 읽음 처리 ==============

    def mark_as_read(self, notification_id: int, user_id: int) -> bool:
        """
        단일 알림 읽음 처리

        Args:
            notification_id: 알림 ID
            user_id: 사용자 ID (권한 확인용)

        Returns:
            성공 여부
        """
        notification = self.get_notification_by_id(notification_id, user_id)
        if not notification:
            return False

        notification.is_read = True
        notification.read_at = datetime.utcnow()
        self.db.commit()

        return True

    def mark_all_as_read(self, user_id: int) -> int:
        """
        모든 알림 읽음 처리

        Args:
            user_id: 사용자 ID

        Returns:
            처리된 알림 개수
        """
        now = datetime.utcnow()
        count = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
        ).update({
            "is_read": True,
            "read_at": now,
        })

        self.db.commit()
        return count

    def delete_notification(self, notification_id: int, user_id: int) -> bool:
        """
        알림 삭제

        Args:
            notification_id: 알림 ID
            user_id: 사용자 ID (권한 확인용)

        Returns:
            성공 여부
        """
        notification = self.get_notification_by_id(notification_id, user_id)
        if not notification:
            return False

        self.db.delete(notification)
        self.db.commit()

        return True

    # ============== 7.1.4 알림 설정 관리 ==============

    def get_notification_settings(self, user_id: int) -> List[NotificationSetting]:
        """
        사용자의 알림 설정 조회

        Args:
            user_id: 사용자 ID

        Returns:
            알림 설정 목록
        """
        settings = self.db.query(NotificationSetting).filter(
            NotificationSetting.user_id == user_id
        ).all()

        # 설정이 없으면 기본값 생성
        if not settings:
            settings = self._create_default_settings(user_id)

        return settings

    def _create_default_settings(self, user_id: int) -> List[NotificationSetting]:
        """
        기본 알림 설정 생성

        Args:
            user_id: 사용자 ID

        Returns:
            생성된 설정 목록
        """
        settings = []
        for notif_type in self.DEFAULT_NOTIFICATION_TYPES:
            setting = NotificationSetting(
                user_id=user_id,
                notification_type=notif_type.value,
                email_enabled=True,
                app_enabled=True,
                frequency=NotificationFrequency.REALTIME.value,
            )
            self.db.add(setting)
            settings.append(setting)

        self.db.commit()
        for setting in settings:
            self.db.refresh(setting)

        return settings

    def update_notification_setting(
        self,
        user_id: int,
        notification_type: NotificationType,
        email_enabled: Optional[bool] = None,
        app_enabled: Optional[bool] = None,
        frequency: Optional[NotificationFrequency] = None,
    ) -> Optional[NotificationSetting]:
        """
        알림 설정 업데이트

        Args:
            user_id: 사용자 ID
            notification_type: 알림 유형
            email_enabled: 이메일 알림 활성화
            app_enabled: 앱 알림 활성화
            frequency: 알림 주기

        Returns:
            업데이트된 설정
        """
        type_value = notification_type.value if isinstance(notification_type, NotificationType) else notification_type

        setting = self.db.query(NotificationSetting).filter(
            NotificationSetting.user_id == user_id,
            NotificationSetting.notification_type == type_value,
        ).first()

        if not setting:
            # 설정이 없으면 생성
            setting = NotificationSetting(
                user_id=user_id,
                notification_type=type_value,
                email_enabled=email_enabled if email_enabled is not None else True,
                app_enabled=app_enabled if app_enabled is not None else True,
                frequency=frequency.value if frequency else NotificationFrequency.REALTIME.value,
            )
            self.db.add(setting)
        else:
            # 설정 업데이트
            if email_enabled is not None:
                setting.email_enabled = email_enabled
            if app_enabled is not None:
                setting.app_enabled = app_enabled
            if frequency is not None:
                setting.frequency = frequency.value if isinstance(frequency, NotificationFrequency) else frequency

        self.db.commit()
        self.db.refresh(setting)

        return setting

    def update_bulk_notification_settings(
        self,
        user_id: int,
        settings_data: List[Dict[str, Any]],
    ) -> List[NotificationSetting]:
        """
        알림 설정 일괄 업데이트

        Args:
            user_id: 사용자 ID
            settings_data: 설정 데이터 목록

        Returns:
            업데이트된 설정 목록
        """
        updated_settings = []
        for data in settings_data:
            setting = self.update_notification_setting(
                user_id=user_id,
                notification_type=data.get("notification_type"),
                email_enabled=data.get("email_enabled"),
                app_enabled=data.get("app_enabled"),
                frequency=data.get("frequency"),
            )
            if setting:
                updated_settings.append(setting)

        return updated_settings

    def is_notification_enabled(
        self,
        user_id: int,
        notification_type: NotificationType,
        channel: str = "app",
    ) -> bool:
        """
        특정 알림 유형의 활성화 여부 확인

        Args:
            user_id: 사용자 ID
            notification_type: 알림 유형
            channel: 채널 ("app" 또는 "email")

        Returns:
            활성화 여부
        """
        type_value = notification_type.value if isinstance(notification_type, NotificationType) else notification_type

        setting = self.db.query(NotificationSetting).filter(
            NotificationSetting.user_id == user_id,
            NotificationSetting.notification_type == type_value,
        ).first()

        if not setting:
            return True  # 기본값은 활성화

        if channel == "email":
            return setting.email_enabled
        return setting.app_enabled

    # ============== 7.5 알림 트리거 구현 ==============

    def create_evidence_expiring_notification(
        self,
        user_id: int,
        evidence_id: int,
        evidence_title: str,
        days_until_expiry: int,
        send_email: bool = False,
    ) -> Notification:
        """
        증적 만료 알림 생성 (7.5.1)

        Args:
            user_id: 수신자 ID
            evidence_id: 증적 ID
            evidence_title: 증적 제목
            days_until_expiry: 만료까지 남은 일수
            send_email: 이메일 발송 여부

        Returns:
            생성된 알림
        """
        # 우선순위 결정
        if days_until_expiry <= 1:
            priority = NotificationPriority.URGENT
        elif days_until_expiry <= 7:
            priority = NotificationPriority.HIGH
        else:
            priority = NotificationPriority.NORMAL

        message = f"증적 '{evidence_title}'이(가) {days_until_expiry}일 후 만료됩니다."

        notification = self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.EVIDENCE_EXPIRING,
            title="증적 만료 알림",
            message=message,
            priority=priority,
            link_url=f"/evidences/{evidence_id}",
            reference_type="evidence",
            reference_id=evidence_id,
        )

        # 이메일 발송 (설정 확인)
        if send_email and self.is_notification_enabled(
            user_id, NotificationType.EVIDENCE_EXPIRING, "email"
        ):
            self._queue_email_notification(notification)

        return notification

    def create_task_due_notification(
        self,
        user_id: int,
        task_id: int,
        task_title: str,
        due_date: datetime,
        send_email: bool = False,
    ) -> Notification:
        """
        정기 활동 예정 알림 생성 (7.5.2)

        Args:
            user_id: 수신자 ID
            task_id: 정기 활동 ID
            task_title: 정기 활동 제목
            due_date: 예정일
            send_email: 이메일 발송 여부

        Returns:
            생성된 알림
        """
        due_str = due_date.strftime("%Y-%m-%d")
        message = f"정기 활동 '{task_title}'이(가) {due_str}에 예정되어 있습니다."

        notification = self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.TASK_DUE,
            title="정기 활동 예정 알림",
            message=message,
            priority=NotificationPriority.NORMAL,
            link_url=f"/tasks/{task_id}",
            reference_type="task",
            reference_id=task_id,
        )

        if send_email and self.is_notification_enabled(
            user_id, NotificationType.TASK_DUE, "email"
        ):
            self._queue_email_notification(notification)

        return notification

    def create_corrective_action_due_notification(
        self,
        user_id: int,
        action_id: int,
        action_title: str,
        due_date: datetime,
        send_email: bool = False,
    ) -> Notification:
        """
        시정조치 기한 알림 생성 (7.5.3)

        Args:
            user_id: 수신자 ID
            action_id: 시정조치 ID
            action_title: 시정조치 제목
            due_date: 기한
            send_email: 이메일 발송 여부

        Returns:
            생성된 알림
        """
        due_str = due_date.strftime("%Y-%m-%d")
        message = f"시정조치 '{action_title}'의 완료 기한이 {due_str}입니다."

        notification = self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.CORRECTIVE_ACTION_DUE,
            title="시정조치 기한 알림",
            message=message,
            priority=NotificationPriority.HIGH,
            link_url=f"/corrective-actions/{action_id}",
            reference_type="corrective_action",
            reference_id=action_id,
        )

        if send_email and self.is_notification_enabled(
            user_id, NotificationType.CORRECTIVE_ACTION_DUE, "email"
        ):
            self._queue_email_notification(notification)

        return notification

    def create_nonconformity_notification(
        self,
        user_id: int,
        nc_id: int,
        nc_title: str,
        assignee_name: str,
        send_email: bool = False,
    ) -> Notification:
        """
        부적합 등록 시 담당자 알림 생성 (7.5.4)

        Args:
            user_id: 수신자 ID
            nc_id: 부적합 ID
            nc_title: 부적합 제목
            assignee_name: 담당자 이름
            send_email: 이메일 발송 여부

        Returns:
            생성된 알림
        """
        message = f"부적합 사항 '{nc_title}'이(가) {assignee_name}님에게 할당되었습니다."

        notification = self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.NC_ASSIGNED,
            title="부적합 사항 할당 알림",
            message=message,
            priority=NotificationPriority.HIGH,
            link_url=f"/nonconformities/{nc_id}",
            reference_type="nonconformity",
            reference_id=nc_id,
        )

        if send_email and self.is_notification_enabled(
            user_id, NotificationType.NC_ASSIGNED, "email"
        ):
            self._queue_email_notification(notification)

        return notification

    def create_audit_dday_notification(
        self,
        user_id: int,
        audit_id: int,
        audit_title: str,
        days_until_audit: int,
        send_email: bool = False,
    ) -> Notification:
        """
        심사 D-Day 알림 생성 (7.5.5)

        Args:
            user_id: 수신자 ID
            audit_id: 감사 ID
            audit_title: 감사 제목
            days_until_audit: 심사까지 남은 일수
            send_email: 이메일 발송 여부

        Returns:
            생성된 알림
        """
        if days_until_audit == 0:
            d_day_str = "D-Day"
        elif days_until_audit > 0:
            d_day_str = f"D-{days_until_audit}"
        else:
            d_day_str = f"D+{abs(days_until_audit)}"

        message = f"심사 '{audit_title}'이(가) {d_day_str} 입니다."

        # D-Day가 가까울수록 높은 우선순위
        if days_until_audit <= 0:
            priority = NotificationPriority.URGENT
        elif days_until_audit <= 7:
            priority = NotificationPriority.HIGH
        else:
            priority = NotificationPriority.NORMAL

        notification = self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.AUDIT_DDAY,
            title="심사 D-Day 알림",
            message=message,
            priority=priority,
            link_url=f"/audits/{audit_id}",
            reference_type="audit",
            reference_id=audit_id,
        )

        if send_email and self.is_notification_enabled(
            user_id, NotificationType.AUDIT_DDAY, "email"
        ):
            self._queue_email_notification(notification)

        return notification

    def _queue_email_notification(self, notification: Notification) -> None:
        """
        이메일 알림을 Celery 큐에 추가

        Args:
            notification: 알림 객체
        """
        # TODO: Celery 태스크로 이메일 발송 큐잉
        # from app.services.email_service import send_email_task
        # send_email_task.delay(notification.id)
        pass
