"""
Phase 1.0 - 환경 설정 테스트
config.py에 대한 단위 테스트
"""
import os
import pytest
from unittest.mock import patch


class TestSettingsClass:
    """Settings 클래스 테스트"""

    def test_settings_default_values(self):
        """기본값이 올바르게 설정되는지 테스트"""
        with patch.dict(os.environ, {
            'SECRET_KEY': 'test-secret-key',
            'DATABASE_URL': 'sqlite:///test.db',
            'REDIS_URL': 'redis://localhost:6379',
            'MINIO_ENDPOINT': 'localhost:9000',
            'MINIO_ACCESS_KEY': 'minio',
            'MINIO_SECRET_KEY': 'minio123',
            'CELERY_BROKER_URL': 'redis://localhost:6379',
            'CELERY_RESULT_BACKEND': 'redis://localhost:6379',
        }, clear=True):
            # Settings 캐시 초기화를 위해 새로운 인스턴스 생성
            from pydantic_settings import BaseSettings
            from app.core.config import Settings

            settings = Settings()

            # 기본값 검증
            assert settings.APP_NAME == "ISMS Management System"
            assert settings.APP_VERSION == "1.0.0"
            assert settings.ENVIRONMENT == "development"
            assert settings.DEBUG is True
            assert settings.ALGORITHM == "HS256"
            assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 30
            assert settings.REFRESH_TOKEN_EXPIRE_DAYS == 7
            assert settings.MINIO_BUCKET_NAME == "isms-evidences"
            assert settings.MINIO_SECURE is False
            assert settings.SMTP_PORT == 587
            assert settings.PASSWORD_MIN_LENGTH == 8
            assert settings.PASSWORD_REQUIRE_UPPERCASE is True
            assert settings.PASSWORD_REQUIRE_LOWERCASE is True
            assert settings.PASSWORD_REQUIRE_DIGIT is True
            assert settings.PASSWORD_REQUIRE_SPECIAL is True
            assert settings.PASSWORD_EXPIRY_DAYS == 90
            assert settings.MAX_LOGIN_ATTEMPTS == 5
            assert settings.ACCOUNT_LOCKOUT_DURATION == 30
            assert settings.SESSION_TIMEOUT_MINUTES == 30
            assert settings.MAX_UPLOAD_SIZE_MB == 100
            assert settings.LOG_LEVEL == "INFO"

    def test_settings_required_fields(self):
        """필수 필드가 없으면 예외 발생"""
        with patch.dict(os.environ, {}, clear=True):
            from app.core.config import Settings

            with pytest.raises(Exception):
                # SECRET_KEY, DATABASE_URL 등 필수 필드 누락
                Settings(_env_file=None)

    def test_settings_env_override(self):
        """환경변수로 설정 오버라이드"""
        with patch.dict(os.environ, {
            'SECRET_KEY': 'custom-secret',
            'DATABASE_URL': 'postgresql://user:pass@localhost/db',
            'REDIS_URL': 'redis://localhost:6380',
            'MINIO_ENDPOINT': 'minio.example.com:9000',
            'MINIO_ACCESS_KEY': 'custom-access',
            'MINIO_SECRET_KEY': 'custom-secret-key',
            'CELERY_BROKER_URL': 'redis://localhost:6380',
            'CELERY_RESULT_BACKEND': 'redis://localhost:6380',
            'APP_NAME': 'Custom App Name',
            'DEBUG': 'false',
            'ACCESS_TOKEN_EXPIRE_MINUTES': '60',
        }, clear=True):
            from app.core.config import Settings

            settings = Settings(_env_file=None)

            assert settings.SECRET_KEY == 'custom-secret'
            assert settings.DATABASE_URL == 'postgresql://user:pass@localhost/db'
            assert settings.APP_NAME == 'Custom App Name'
            assert settings.DEBUG is False
            assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 60

    def test_allowed_extensions_list(self):
        """파일 확장자 목록이 올바르게 설정되는지 테스트"""
        with patch.dict(os.environ, {
            'SECRET_KEY': 'test-secret-key',
            'DATABASE_URL': 'sqlite:///test.db',
            'REDIS_URL': 'redis://localhost:6379',
            'MINIO_ENDPOINT': 'localhost:9000',
            'MINIO_ACCESS_KEY': 'minio',
            'MINIO_SECRET_KEY': 'minio123',
            'CELERY_BROKER_URL': 'redis://localhost:6379',
            'CELERY_RESULT_BACKEND': 'redis://localhost:6379',
        }, clear=True):
            from app.core.config import Settings

            settings = Settings()

            expected_extensions = [
                "pdf", "doc", "docx", "xls", "xlsx",
                "ppt", "pptx", "txt", "jpg", "jpeg", "png"
            ]
            assert settings.ALLOWED_EXTENSIONS == expected_extensions

    def test_cors_origins_default(self):
        """CORS 기본 설정 테스트"""
        with patch.dict(os.environ, {
            'SECRET_KEY': 'test-secret-key',
            'DATABASE_URL': 'sqlite:///test.db',
            'REDIS_URL': 'redis://localhost:6379',
            'MINIO_ENDPOINT': 'localhost:9000',
            'MINIO_ACCESS_KEY': 'minio',
            'MINIO_SECRET_KEY': 'minio123',
            'CELERY_BROKER_URL': 'redis://localhost:6379',
            'CELERY_RESULT_BACKEND': 'redis://localhost:6379',
        }, clear=True):
            from app.core.config import Settings

            settings = Settings()

            assert "http://localhost:3000" in settings.BACKEND_CORS_ORIGINS


class TestGetSettings:
    """get_settings 함수 테스트"""

    def test_get_settings_returns_settings_instance(self):
        """get_settings가 Settings 인스턴스를 반환하는지 테스트"""
        from app.core.config import get_settings, Settings

        settings = get_settings()
        assert isinstance(settings, Settings)

    def test_get_settings_is_cached(self):
        """get_settings가 캐싱되는지 테스트"""
        from app.core.config import get_settings

        settings1 = get_settings()
        settings2 = get_settings()

        # 같은 인스턴스여야 함 (캐싱)
        assert settings1 is settings2


class TestOptionalSMTPSettings:
    """Optional SMTP 설정 테스트"""

    def test_smtp_settings_optional(self):
        """SMTP 설정이 선택적인지 테스트"""
        with patch.dict(os.environ, {
            'SECRET_KEY': 'test-secret-key',
            'DATABASE_URL': 'sqlite:///test.db',
            'REDIS_URL': 'redis://localhost:6379',
            'MINIO_ENDPOINT': 'localhost:9000',
            'MINIO_ACCESS_KEY': 'minio',
            'MINIO_SECRET_KEY': 'minio123',
            'CELERY_BROKER_URL': 'redis://localhost:6379',
            'CELERY_RESULT_BACKEND': 'redis://localhost:6379',
        }, clear=True):
            from app.core.config import Settings

            settings = Settings()

            # SMTP 설정은 None이어도 됨
            assert settings.SMTP_HOST is None
            assert settings.SMTP_USER is None
            assert settings.SMTP_PASSWORD is None
            assert settings.SMTP_FROM_EMAIL is None
            assert settings.SMTP_FROM_NAME is None

    def test_smtp_settings_can_be_set(self):
        """SMTP 설정이 환경변수로 설정될 수 있는지 테스트"""
        with patch.dict(os.environ, {
            'SECRET_KEY': 'test-secret-key',
            'DATABASE_URL': 'sqlite:///test.db',
            'REDIS_URL': 'redis://localhost:6379',
            'MINIO_ENDPOINT': 'localhost:9000',
            'MINIO_ACCESS_KEY': 'minio',
            'MINIO_SECRET_KEY': 'minio123',
            'CELERY_BROKER_URL': 'redis://localhost:6379',
            'CELERY_RESULT_BACKEND': 'redis://localhost:6379',
            'SMTP_HOST': 'smtp.example.com',
            'SMTP_PORT': '465',
            'SMTP_USER': 'user@example.com',
            'SMTP_PASSWORD': 'password123',
            'SMTP_FROM_EMAIL': 'noreply@example.com',
            'SMTP_FROM_NAME': 'ISMS System',
        }, clear=True):
            from app.core.config import Settings

            settings = Settings()

            assert settings.SMTP_HOST == 'smtp.example.com'
            assert settings.SMTP_PORT == 465
            assert settings.SMTP_USER == 'user@example.com'
            assert settings.SMTP_PASSWORD == 'password123'
            assert settings.SMTP_FROM_EMAIL == 'noreply@example.com'
            assert settings.SMTP_FROM_NAME == 'ISMS System'
