from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

# 데이터베이스 엔진 생성
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # 연결 유효성 검사
    pool_size=10,  # 연결 풀 크기
    max_overflow=20,  # 최대 오버플로우 연결 수
    echo=settings.ENVIRONMENT == "development",  # 개발 환경에서 SQL 로깅
)

# 세션 팩토리 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """
    데이터베이스 세션 생성 및 반환
    FastAPI 의존성 주입에서 사용
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
