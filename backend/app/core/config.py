"""
환경 설정 및 설정 관리
"""
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # Application
    APP_NAME: str = "ISMS Management System"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # MinIO
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET_NAME: str = "isms-evidences"
    MINIO_SECURE: bool = False

    # SMTP (Email)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: Optional[str] = None

    # Celery
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000"]

    # Password Policy
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True
    PASSWORD_EXPIRY_DAYS: int = 90

    # Account Security
    MAX_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_DURATION: int = 30  # minutes
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 30
    SESSION_TIMEOUT_MINUTES: int = 60

    # MFA / TOTP
    TOTP_VALID_WINDOW: int = 1  # ±1 time step (±30초). 0=현재만, 1=±30초
    MFA_BACKUP_CODES_COUNT: int = 10

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 100
    ALLOWED_EXTENSIONS: list = [
        "pdf", "doc", "docx", "xls", "xlsx",
        "ppt", "pptx", "hwp", "hwpx",
        "txt", "csv",
        "jpg", "jpeg", "png", "gif",
        "zip", "7z",
    ]

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT_REQUESTS: int = 100  # per window
    RATE_LIMIT_DEFAULT_WINDOW: int = 60  # seconds
    RATE_LIMIT_LOGIN_REQUESTS: int = 5  # login attempts per window
    RATE_LIMIT_LOGIN_WINDOW: int = 300  # 5 minutes
    RATE_LIMIT_API_REQUESTS: int = 200  # API calls per window
    RATE_LIMIT_API_WINDOW: int = 60  # 1 minute

    # Local LLM (Ollama) - 보완조치내역서 초안 생성용
    LLM_ENABLED: bool = True
    LLM_BASE_URL: str = "http://ollama:11434"
    LLM_MODEL: str = "qwen3.5:2b"
    LLM_TIMEOUT_SECONDS: int = 600
    LLM_IMAGE_MAX_DIM: int = 672  # Qwen2.5-VL 패치(28px) 배수로 내림 정렬됨
    LLM_MAX_IMAGES_PER_REQUEST: int = 4
    LLM_MAX_PENDING_PER_USER: int = 5  # 사용자당 동시 대기 초안 수 상한

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # 추가 필드 허용


@lru_cache()
def get_settings() -> Settings:
    """설정 인스턴스 반환 (캐싱)"""
    return Settings()


# 전역 settings 인스턴스
settings = get_settings()
