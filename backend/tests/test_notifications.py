"""
알림 시스템 테스트 (TDD)
7.1 알림 서비스 테스트
7.4 알림 API 테스트
7.6.1 알림 CRUD 테스트
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationSetting
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationType,
    NotificationPriority,
    NotificationFrequency,
)


class TestNotificationService:
    """7.1 알림 서비스 테스트"""

    # ============== 7.1.1 알림 생성 테스트 ==============

    def test_create_notification_success(self, db: Session, test_user: User):
        """알림 생성 성공 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        notification = service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.EVIDENCE_EXPIRING,
            title="증적 만료 알림",
            message="증적 'A문서'가 7일 후 만료됩니다.",
            priority=NotificationPriority.HIGH,
            link_url="/evidences/1",
            reference_type="evidence",
            reference_id=1,
        )

        assert notification is not None
        assert notification.id is not None
        assert notification.user_id == test_user.id
        assert notification.notification_type == NotificationType.EVIDENCE_EXPIRING.value
        assert notification.title == "증적 만료 알림"
        assert notification.message == "증적 'A문서'가 7일 후 만료됩니다."
        assert notification.priority == NotificationPriority.HIGH.value
        assert notification.is_read is False
        assert notification.link_url == "/evidences/1"

    def test_create_notification_with_minimum_fields(self, db: Session, test_user: User):
        """최소 필드로 알림 생성 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        notification = service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.SYSTEM,
            title="시스템 알림",
            message="테스트 메시지입니다.",
        )

        assert notification is not None
        assert notification.priority == NotificationPriority.NORMAL.value
        assert notification.link_url is None
        assert notification.reference_type is None

    def test_create_notification_invalid_user(self, db: Session):
        """존재하지 않는 사용자에게 알림 생성 시 실패 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        with pytest.raises(ValueError, match="사용자를 찾을 수 없습니다"):
            service.create_notification(
                user_id=99999,
                notification_type=NotificationType.SYSTEM,
                title="테스트 알림",
                message="테스트 메시지",
            )

    def test_create_bulk_notifications(self, db: Session, test_user: User, test_admin_user: User):
        """여러 사용자에게 알림 일괄 생성 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        user_ids = [test_user.id, test_admin_user.id]
        notifications = service.create_bulk_notifications(
            user_ids=user_ids,
            notification_type=NotificationType.AUDIT_SCHEDULED,
            title="감사 일정 알림",
            message="내부감사가 예정되어 있습니다.",
        )

        assert len(notifications) == 2
        for notif in notifications:
            assert notif.user_id in user_ids

    # ============== 7.1.2 알림 조회 테스트 ==============

    def test_get_notifications_all(self, db: Session, test_user: User):
        """모든 알림 조회 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        # 테스트용 알림 생성
        for i in range(5):
            service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM,
                title=f"알림 {i}",
                message=f"메시지 {i}",
            )

        result = service.get_notifications(user_id=test_user.id)

        assert result["total"] == 5
        assert len(result["items"]) == 5

    def test_get_notifications_unread_only(self, db: Session, test_user: User):
        """읽지 않은 알림만 조회 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        # 읽은 알림 3개, 읽지 않은 알림 2개 생성
        for i in range(3):
            notif = service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM,
                title=f"읽은 알림 {i}",
                message=f"메시지 {i}",
            )
            service.mark_as_read(notif.id, test_user.id)

        for i in range(2):
            service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM,
                title=f"읽지 않은 알림 {i}",
                message=f"메시지 {i}",
            )

        result = service.get_notifications(user_id=test_user.id, is_read=False)

        assert result["unread_count"] == 2
        assert len(result["items"]) == 2
        for item in result["items"]:
            assert item.is_read is False

    def test_get_notifications_with_pagination(self, db: Session, test_user: User):
        """알림 페이지네이션 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        for i in range(15):
            service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM,
                title=f"알림 {i}",
                message=f"메시지 {i}",
            )

        result = service.get_notifications(
            user_id=test_user.id,
            page=1,
            page_size=10,
        )

        assert result["total"] == 15
        assert len(result["items"]) == 10
        assert result["page"] == 1
        assert result["page_size"] == 10

    def test_get_notifications_by_type(self, db: Session, test_user: User):
        """알림 유형별 조회 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.EVIDENCE_EXPIRING,
            title="증적 만료",
            message="메시지",
        )
        service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.TASK_DUE,
            title="업무 기한",
            message="메시지",
        )

        result = service.get_notifications(
            user_id=test_user.id,
            notification_type=NotificationType.EVIDENCE_EXPIRING,
        )

        assert result["total"] == 1
        assert result["items"][0].notification_type == NotificationType.EVIDENCE_EXPIRING.value

    def test_get_unread_count(self, db: Session, test_user: User):
        """읽지 않은 알림 개수 조회 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        for i in range(3):
            service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM,
                title=f"알림 {i}",
                message=f"메시지 {i}",
            )

        count = service.get_unread_count(test_user.id)
        assert count == 3

    # ============== 7.1.3 알림 읽음 처리 테스트 ==============

    def test_mark_as_read_single(self, db: Session, test_user: User):
        """단일 알림 읽음 처리 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        notification = service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.SYSTEM,
            title="테스트 알림",
            message="테스트 메시지",
        )

        result = service.mark_as_read(notification.id, test_user.id)

        assert result is True
        db.refresh(notification)
        assert notification.is_read is True
        assert notification.read_at is not None

    def test_mark_as_read_not_found(self, db: Session, test_user: User):
        """존재하지 않는 알림 읽음 처리 시 실패 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        result = service.mark_as_read(99999, test_user.id)

        assert result is False

    def test_mark_as_read_wrong_user(self, db: Session, test_user: User, test_admin_user: User):
        """다른 사용자의 알림 읽음 처리 시 실패 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        notification = service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.SYSTEM,
            title="테스트 알림",
            message="테스트 메시지",
        )

        result = service.mark_as_read(notification.id, test_admin_user.id)

        assert result is False

    def test_mark_all_as_read(self, db: Session, test_user: User):
        """모든 알림 읽음 처리 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        for i in range(5):
            service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM,
                title=f"알림 {i}",
                message=f"메시지 {i}",
            )

        count = service.mark_all_as_read(test_user.id)

        assert count == 5
        result = service.get_notifications(user_id=test_user.id, is_read=False)
        assert result["unread_count"] == 0

    # ============== 7.1.4 알림 설정 관리 테스트 ==============

    def test_get_notification_settings(self, db: Session, test_user: User):
        """알림 설정 조회 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        settings = service.get_notification_settings(test_user.id)

        # 기본 설정이 생성되어야 함
        assert len(settings) > 0

    def test_update_notification_setting(self, db: Session, test_user: User):
        """알림 설정 업데이트 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        # 먼저 기본 설정 생성
        service.get_notification_settings(test_user.id)

        setting = service.update_notification_setting(
            user_id=test_user.id,
            notification_type=NotificationType.EVIDENCE_EXPIRING,
            email_enabled=False,
            app_enabled=True,
            frequency=NotificationFrequency.DAILY,
        )

        assert setting is not None
        assert setting.email_enabled is False
        assert setting.app_enabled is True
        assert setting.frequency == NotificationFrequency.DAILY.value

    def test_update_bulk_notification_settings(self, db: Session, test_user: User):
        """알림 설정 일괄 업데이트 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        settings_data = [
            {
                "notification_type": NotificationType.EVIDENCE_EXPIRING,
                "email_enabled": True,
                "app_enabled": False,
                "frequency": NotificationFrequency.DAILY,
            },
            {
                "notification_type": NotificationType.TASK_DUE,
                "email_enabled": False,
                "app_enabled": True,
                "frequency": NotificationFrequency.REALTIME,
            },
        ]

        updated = service.update_bulk_notification_settings(test_user.id, settings_data)

        assert len(updated) == 2

    def test_delete_notification(self, db: Session, test_user: User):
        """알림 삭제 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)
        notification = service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.SYSTEM,
            title="삭제할 알림",
            message="테스트 메시지",
        )

        result = service.delete_notification(notification.id, test_user.id)

        assert result is True
        deleted = db.query(Notification).filter(Notification.id == notification.id).first()
        assert deleted is None


class TestNotificationAPI:
    """7.4 알림 API 테스트"""

    # ============== 7.4.1 GET /notifications 테스트 ==============

    def test_get_notifications_api_success(
        self,
        client: TestClient,
        auth_headers: Dict[str, str],
        test_user: User,
        db: Session,
    ):
        """알림 목록 조회 API 성공 테스트"""
        # 테스트 알림 생성
        for i in range(3):
            notification = Notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM.value,
                title=f"알림 {i}",
                message=f"메시지 {i}",
            )
            db.add(notification)
        db.commit()

        response = client.get("/api/v1/notifications", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "unread_count" in data
        assert data["total"] == 3

    def test_get_notifications_api_unread_filter(
        self,
        client: TestClient,
        auth_headers: Dict[str, str],
        test_user: User,
        db: Session,
    ):
        """읽지 않은 알림만 조회 API 테스트"""
        # 읽은 알림
        read_notif = Notification(
            user_id=test_user.id,
            notification_type=NotificationType.SYSTEM.value,
            title="읽은 알림",
            message="메시지",
            is_read=True,
            read_at=datetime.utcnow(),
        )
        db.add(read_notif)

        # 읽지 않은 알림
        unread_notif = Notification(
            user_id=test_user.id,
            notification_type=NotificationType.SYSTEM.value,
            title="읽지 않은 알림",
            message="메시지",
        )
        db.add(unread_notif)
        db.commit()

        response = client.get(
            "/api/v1/notifications?is_read=false",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["is_read"] is False

    def test_get_notifications_api_unauthorized(self, client: TestClient):
        """인증 없이 알림 조회 시 실패 테스트"""
        response = client.get("/api/v1/notifications")
        assert response.status_code == 401

    # ============== 7.4.2 PUT /notifications/{id}/read 테스트 ==============

    def test_mark_notification_read_api_success(
        self,
        client: TestClient,
        auth_headers: Dict[str, str],
        test_user: User,
        db: Session,
    ):
        """단일 알림 읽음 처리 API 성공 테스트"""
        notification = Notification(
            user_id=test_user.id,
            notification_type=NotificationType.SYSTEM.value,
            title="테스트 알림",
            message="메시지",
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        response = client.put(
            f"/api/v1/notifications/{notification.id}/read",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_mark_notification_read_api_not_found(
        self,
        client: TestClient,
        auth_headers: Dict[str, str],
    ):
        """존재하지 않는 알림 읽음 처리 시 404 반환 테스트"""
        response = client.put(
            "/api/v1/notifications/99999/read",
            headers=auth_headers,
        )
        assert response.status_code == 404

    # ============== 7.4.3 PUT /notifications/read-all 테스트 ==============

    def test_mark_all_notifications_read_api_success(
        self,
        client: TestClient,
        auth_headers: Dict[str, str],
        test_user: User,
        db: Session,
    ):
        """전체 알림 읽음 처리 API 성공 테스트"""
        for i in range(5):
            notification = Notification(
                user_id=test_user.id,
                notification_type=NotificationType.SYSTEM.value,
                title=f"알림 {i}",
                message=f"메시지 {i}",
            )
            db.add(notification)
        db.commit()

        response = client.put(
            "/api/v1/notifications/read-all",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 5

    # ============== 7.4.4 GET /notifications/settings 테스트 ==============

    def test_get_notification_settings_api_success(
        self,
        client: TestClient,
        auth_headers: Dict[str, str],
    ):
        """알림 설정 조회 API 성공 테스트"""
        response = client.get(
            "/api/v1/notifications/settings",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "settings" in data

    # ============== 7.4.5 PUT /notifications/settings 테스트 ==============

    def test_update_notification_settings_api_success(
        self,
        client: TestClient,
        auth_headers: Dict[str, str],
    ):
        """알림 설정 변경 API 성공 테스트"""
        settings_data = {
            "settings": [
                {
                    "notification_type": "evidence_expiring",
                    "email_enabled": False,
                    "app_enabled": True,
                    "frequency": "daily",
                }
            ]
        }

        response = client.put(
            "/api/v1/notifications/settings",
            headers=auth_headers,
            json=settings_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert "settings" in data


class TestNotificationTriggers:
    """7.5 알림 트리거 테스트"""

    # ============== 7.5.1 증적 만료 알림 테스트 ==============

    def test_evidence_expiring_notification_30_days(self, db: Session, test_user: User):
        """증적 만료 30일 전 알림 생성 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        notification = service.create_evidence_expiring_notification(
            user_id=test_user.id,
            evidence_id=1,
            evidence_title="보안정책문서",
            days_until_expiry=30,
        )

        assert notification is not None
        assert notification.notification_type == NotificationType.EVIDENCE_EXPIRING.value
        assert "30일" in notification.message
        assert notification.priority == NotificationPriority.NORMAL.value

    def test_evidence_expiring_notification_7_days(self, db: Session, test_user: User):
        """증적 만료 7일 전 알림 생성 테스트 (HIGH 우선순위)"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        notification = service.create_evidence_expiring_notification(
            user_id=test_user.id,
            evidence_id=1,
            evidence_title="보안정책문서",
            days_until_expiry=7,
        )

        assert notification is not None
        assert notification.priority == NotificationPriority.HIGH.value

    def test_evidence_expiring_notification_1_day(self, db: Session, test_user: User):
        """증적 만료 1일 전 알림 생성 테스트 (URGENT 우선순위)"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        notification = service.create_evidence_expiring_notification(
            user_id=test_user.id,
            evidence_id=1,
            evidence_title="보안정책문서",
            days_until_expiry=1,
        )

        assert notification is not None
        assert notification.priority == NotificationPriority.URGENT.value

    # ============== 7.5.2 정기 활동 예정 알림 테스트 ==============

    def test_scheduled_task_notification(self, db: Session, test_user: User):
        """정기 활동 예정 알림 생성 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        notification = service.create_task_due_notification(
            user_id=test_user.id,
            task_id=1,
            task_title="월간 접근권한 검토",
            due_date=datetime.utcnow() + timedelta(days=3),
        )

        assert notification is not None
        assert notification.notification_type == NotificationType.TASK_DUE.value
        assert notification.reference_type == "task"
        assert notification.reference_id == 1

    # ============== 7.5.3 시정조치 기한 알림 테스트 ==============

    def test_corrective_action_due_notification(self, db: Session, test_user: User):
        """시정조치 기한 알림 생성 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        notification = service.create_corrective_action_due_notification(
            user_id=test_user.id,
            action_id=1,
            action_title="접근제어 미흡 시정",
            due_date=datetime.utcnow() + timedelta(days=5),
        )

        assert notification is not None
        assert notification.notification_type == NotificationType.CORRECTIVE_ACTION_DUE.value

    # ============== 7.5.4 부적합 등록 시 담당자 알림 테스트 ==============

    def test_nonconformity_assigned_notification(self, db: Session, test_user: User):
        """부적합 등록 시 담당자 알림 생성 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        notification = service.create_nonconformity_notification(
            user_id=test_user.id,
            nc_id=1,
            nc_title="접근제어 미흡",
            assignee_name=test_user.name,
        )

        assert notification is not None
        assert notification.notification_type == NotificationType.NC_ASSIGNED.value
        assert notification.priority == NotificationPriority.HIGH.value

    # ============== 7.5.5 심사 D-Day 알림 테스트 ==============

    def test_audit_dday_notification(self, db: Session, test_user: User):
        """심사 D-Day 알림 생성 테스트"""
        from app.services.notification_service import NotificationService

        service = NotificationService(db)

        notification = service.create_audit_dday_notification(
            user_id=test_user.id,
            audit_id=1,
            audit_title="ISMS-P 정기심사",
            days_until_audit=7,
        )

        assert notification is not None
        assert notification.notification_type == NotificationType.AUDIT_DDAY.value
        assert "D-7" in notification.message
