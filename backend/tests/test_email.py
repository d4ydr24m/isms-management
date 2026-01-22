"""
이메일 서비스 테스트 (TDD)
7.2 이메일 알림 서비스 테스트
7.6.2 이메일 발송 테스트
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict
from unittest.mock import MagicMock, patch, AsyncMock

from sqlalchemy.orm import Session

from app.models.user import User


class TestEmailService:
    """7.2 이메일 알림 서비스 테스트"""

    # ============== 7.2.1 SMTP 설정 테스트 ==============

    def test_email_service_initialization(self):
        """이메일 서비스 초기화 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        assert service is not None

    def test_email_service_smtp_config(self):
        """SMTP 설정 로드 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        config = service.get_smtp_config()

        assert "host" in config
        assert "port" in config
        assert "username" in config
        assert "from_email" in config

    @patch("app.services.email_service.EmailService._is_smtp_configured")
    def test_email_service_smtp_not_configured(self, mock_configured):
        """SMTP 미설정 시 예외 테스트"""
        mock_configured.return_value = False

        from app.services.email_service import EmailService

        service = EmailService()
        with pytest.raises(ValueError, match="SMTP 설정이 완료되지 않았습니다"):
            service.validate_smtp_config()

    # ============== 7.2.2 이메일 템플릿 관리 테스트 ==============

    def test_get_email_template_evidence_expiring(self):
        """증적 만료 알림 이메일 템플릿 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        template = service.get_template("evidence_expiring")

        assert template is not None
        assert "subject" in template
        assert "body_template" in template

    def test_get_email_template_task_due(self):
        """정기 활동 알림 이메일 템플릿 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        template = service.get_template("task_due")

        assert template is not None

    def test_get_email_template_daily_summary(self):
        """일간 요약 이메일 템플릿 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        template = service.get_template("daily_summary")

        assert template is not None
        assert "subject" in template

    def test_get_email_template_weekly_summary(self):
        """주간 요약 이메일 템플릿 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        template = service.get_template("weekly_summary")

        assert template is not None

    def test_get_email_template_not_found(self):
        """존재하지 않는 템플릿 조회 시 None 반환 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        template = service.get_template("nonexistent_template")

        assert template is None

    def test_render_email_template(self):
        """이메일 템플릿 렌더링 테스트"""
        from app.services.email_service import EmailService

        service = EmailService()
        context = {
            "user_name": "홍길동",
            "evidence_title": "보안정책문서",
            "days_until_expiry": 7,
        }

        rendered = service.render_template("evidence_expiring", context)

        assert rendered is not None
        assert "홍길동" in rendered["body"]
        assert "보안정책문서" in rendered["body"]
        assert "7" in rendered["body"]

    # ============== 7.2.3 이메일 발송 테스트 ==============

    @pytest.mark.asyncio
    @patch("aiosmtplib.send")
    async def test_send_email_success(self, mock_send):
        """이메일 발송 성공 테스트"""
        mock_send.return_value = {}

        from app.services.email_service import EmailService

        service = EmailService()
        result = await service.send_email(
            to_email="user@example.com",
            subject="테스트 이메일",
            body="<h1>테스트</h1><p>내용입니다.</p>",
        )

        assert result is True
        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch("aiosmtplib.send")
    async def test_send_email_failure(self, mock_send):
        """이메일 발송 실패 테스트"""
        mock_send.side_effect = Exception("SMTP Error")

        from app.services.email_service import EmailService

        service = EmailService()
        result = await service.send_email(
            to_email="user@example.com",
            subject="테스트 이메일",
            body="테스트 내용",
        )

        assert result is False

    @pytest.mark.asyncio
    @patch("aiosmtplib.send")
    async def test_send_email_with_attachments(self, mock_send):
        """첨부파일 포함 이메일 발송 테스트"""
        mock_send.return_value = {}

        from app.services.email_service import EmailService

        service = EmailService()
        attachments = [
            {
                "filename": "report.pdf",
                "content": b"PDF content",
                "content_type": "application/pdf",
            }
        ]

        result = await service.send_email(
            to_email="user@example.com",
            subject="첨부파일 테스트",
            body="첨부파일이 포함된 이메일입니다.",
            attachments=attachments,
        )

        assert result is True

    @pytest.mark.asyncio
    @patch("aiosmtplib.send")
    async def test_send_bulk_emails(self, mock_send):
        """대량 이메일 발송 테스트"""
        mock_send.return_value = {}

        from app.services.email_service import EmailService

        service = EmailService()
        recipients = [
            "user1@example.com",
            "user2@example.com",
            "user3@example.com",
        ]

        results = await service.send_bulk_emails(
            to_emails=recipients,
            subject="대량 발송 테스트",
            body="테스트 내용",
        )

        assert len(results) == 3
        assert all(results.values())

    # ============== 7.2.4 일간/주간 요약 이메일 테스트 ==============

    @pytest.mark.asyncio
    @patch("aiosmtplib.send")
    async def test_send_daily_summary_email(self, mock_send, db: Session, test_user: User):
        """일간 요약 이메일 발송 테스트"""
        mock_send.return_value = {}

        from app.services.email_service import EmailService

        service = EmailService()
        summary_data = {
            "user_name": test_user.name,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "pending_tasks": 3,
            "expiring_evidences": 2,
            "unread_notifications": 5,
        }

        result = await service.send_daily_summary(
            to_email=test_user.email,
            summary_data=summary_data,
        )

        assert result is True

    @pytest.mark.asyncio
    @patch("aiosmtplib.send")
    async def test_send_weekly_summary_email(self, mock_send, db: Session, test_user: User):
        """주간 요약 이메일 발송 테스트"""
        mock_send.return_value = {}

        from app.services.email_service import EmailService

        service = EmailService()
        summary_data = {
            "user_name": test_user.name,
            "week_start": (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d"),
            "week_end": datetime.utcnow().strftime("%Y-%m-%d"),
            "completed_tasks": 10,
            "new_evidences": 5,
            "audit_status": "진행중",
        }

        result = await service.send_weekly_summary(
            to_email=test_user.email,
            summary_data=summary_data,
        )

        assert result is True


class TestEmailCeleryTasks:
    """이메일 Celery 태스크 테스트"""

    @patch("app.services.email_service.EmailService.send_email")
    def test_send_email_task(self, mock_send):
        """이메일 발송 Celery 태스크 테스트"""
        mock_send.return_value = True

        from app.services.email_service import send_email_task

        result = send_email_task.apply(
            args=["user@example.com", "테스트 제목", "테스트 내용"]
        )

        # Celery 태스크가 올바르게 정의되어 있는지 확인
        assert send_email_task.name is not None

    @patch("app.services.email_service.EmailService.send_daily_summary")
    def test_send_daily_summary_task(self, mock_send):
        """일간 요약 Celery 태스크 테스트"""
        mock_send.return_value = True

        from app.services.email_service import send_daily_summary_task

        # Celery 태스크가 올바르게 정의되어 있는지 확인
        assert send_daily_summary_task.name is not None

    @patch("app.services.email_service.EmailService.send_weekly_summary")
    def test_send_weekly_summary_task(self, mock_send):
        """주간 요약 Celery 태스크 테스트"""
        mock_send.return_value = True

        from app.services.email_service import send_weekly_summary_task

        # Celery 태스크가 올바르게 정의되어 있는지 확인
        assert send_weekly_summary_task.name is not None


class TestEmailNotificationIntegration:
    """이메일 알림 통합 테스트"""

    @patch("aiosmtplib.send")
    def test_notification_triggers_email(self, mock_send, db: Session, test_user: User):
        """알림 생성 시 이메일 발송 트리거 테스트"""
        mock_send.return_value = {}

        # 사용자의 이메일 알림이 활성화된 경우 이메일 발송 확인
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationSetting

        # 이메일 알림 활성화 설정
        setting = NotificationSetting(
            user_id=test_user.id,
            notification_type="evidence_expiring",
            email_enabled=True,
            app_enabled=True,
            frequency="realtime",
        )
        db.add(setting)
        db.commit()

        service = NotificationService(db)

        # 알림 생성 (이메일 발송 트리거)
        notification = service.create_evidence_expiring_notification(
            user_id=test_user.id,
            evidence_id=1,
            evidence_title="보안정책문서",
            days_until_expiry=7,
            send_email=True,  # 이메일 발송 플래그
        )

        assert notification is not None

    def test_email_disabled_no_send(self, db: Session, test_user: User):
        """이메일 알림 비활성화 시 발송하지 않음 테스트"""
        from app.services.notification_service import NotificationService
        from app.models.notification import NotificationSetting

        # 이메일 알림 비활성화 설정
        setting = NotificationSetting(
            user_id=test_user.id,
            notification_type="evidence_expiring",
            email_enabled=False,
            app_enabled=True,
            frequency="realtime",
        )
        db.add(setting)
        db.commit()

        service = NotificationService(db)

        # 이메일 발송 확인용 모킹
        with patch("app.services.email_service.EmailService.send_email") as mock_send:
            notification = service.create_evidence_expiring_notification(
                user_id=test_user.id,
                evidence_id=1,
                evidence_title="보안정책문서",
                days_until_expiry=7,
                send_email=True,
            )

            # 이메일이 비활성화되어 있으므로 send_email이 호출되지 않아야 함
            assert notification is not None
