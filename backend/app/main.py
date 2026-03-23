"""
ISMS 관리 시스템 FastAPI 애플리케이션 엔트리포인트
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import settings
from app.core.middleware import AuditLogMiddleware, RateLimitMiddleware
from app.websocket.handlers import websocket_endpoint

API_DESCRIPTION = """
## ISMS-P 인증 관리 시스템 API

ISMS-P (정보보호 및 개인정보보호 관리체계) 인증 준비 및 유지를 위한 통합 관리 시스템입니다.

### 주요 기능

* **인증 (Authentication)**: JWT 기반 로그인, 2FA(TOTP), 토큰 갱신
* **사용자 관리 (Users)**: RBAC 기반 사용자 및 역할 관리
* **증적 관리 (Evidences)**: 80개 통제항목별 증적 등록, 버전 관리
* **감사 관리 (Audits)**: 내부감사 계획, 체크리스트, 부적합 관리
* **알림 (Notifications)**: 실시간 알림, 이메일 알림
* **대시보드 (Dashboard)**: 인증 준비 현황, 통계

### 인증 방식

모든 보호된 엔드포인트는 Bearer 토큰 인증이 필요합니다.

```
Authorization: Bearer <access_token>
```

### 에러 응답

| 코드 | 설명 |
|------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 422 | 유효성 검사 실패 |
| 500 | 서버 오류 |
"""

TAGS_METADATA = [
    {
        "name": "인증",
        "description": "로그인, 로그아웃, 토큰 갱신, MFA 설정"
    },
    {
        "name": "사용자",
        "description": "사용자 CRUD, 프로필 관리"
    },
    {
        "name": "역할",
        "description": "역할 및 권한 관리"
    },
    {
        "name": "부서",
        "description": "부서 계층 구조 관리"
    },
    {
        "name": "통제항목",
        "description": "ISMS-P 80개 통제항목 관리"
    },
    {
        "name": "증적",
        "description": "증적 등록, 버전 관리, 파일 업로드"
    },
    {
        "name": "정기 활동",
        "description": "정기적인 보안 활동 스케줄 관리"
    },
    {
        "name": "감사",
        "description": "내부감사 계획 및 체크리스트 관리"
    },
    {
        "name": "부적합",
        "description": "부적합 사항 및 시정조치 관리"
    },
    {
        "name": "심사원 계정",
        "description": "외부 심사원 임시 계정 관리"
    },
    {
        "name": "감사 로그",
        "description": "시스템 감사 추적 로그 조회"
    },
    {
        "name": "알림",
        "description": "알림 조회 및 설정 관리"
    },
    {
        "name": "대시보드",
        "description": "인증 준비 현황, 통계 조회"
    },
    {
        "name": "템플릿",
        "description": "문서 템플릿 관리"
    },
    {
        "name": "마이그레이션",
        "description": "데이터 마이그레이션 유틸리티"
    },
]

app = FastAPI(
    title=settings.APP_NAME,
    description=API_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_tags=TAGS_METADATA,
    contact={
        "name": "ISMS 관리 시스템 지원팀",
        "email": "support@example.com",
    },
    license_info={
        "name": "Proprietary",
    },
)

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")

# WebSocket 엔드포인트 등록 (7.3)
app.websocket("/ws/notifications")(websocket_endpoint)

# CORS 설정 - 환경 변수 기반
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# Rate Limiting 미들웨어 (감사 로그 전에 등록하여 먼저 체크)
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# 감사 로그 미들웨어
app.add_middleware(AuditLogMiddleware)


# 보안 헤더 미들웨어
@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "ISMS Management System API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return JSONResponse(
        status_code=200,
        content={"status": "healthy"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
