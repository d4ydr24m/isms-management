"""
인증 API 라우터
/api/v1/auth
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db, get_current_user, get_current_active_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    PasswordChange,
    OTPSetup,
    OTPVerify,
    RefreshTokenRequest,
    MFADisableRequest,
    MFAEnableResponse,
    MFABackupCodesResponse,
    MFARegenerateBackupCodesRequest,
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService


router = APIRouter()


def _set_token_cookies(response: JSONResponse, access_token: str, refresh_token: str) -> None:
    """Set HttpOnly cookie for JWT tokens on the response."""
    secure = settings.ENVIRONMENT != "development"

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


def _clear_token_cookies(response: JSONResponse) -> None:
    """Clear JWT token cookies from the response."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    사용자 로그인

    - **email**: 사용자 이메일
    - **password**: 비밀번호
    - **otp_code**: OTP 코드 (MFA 활성화 시 필요)

    토큰을 JSON 응답 본문과 HttpOnly 쿠키 모두에 반환합니다.
    """
    # 클라이언트 IP 추출
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else None)

    auth_service = AuthService(db)
    result = auth_service.authenticate(
        email=login_data.email,
        password=login_data.password,
        otp_code=login_data.otp_code,
        client_ip=client_ip,
    )

    if not result["success"]:
        if result.get("requires_mfa"):
            # MFA 필요 시: 프론트엔드가 requiresMfa를 확인하여 MFA 페이지로 이동
            response_body = {
                "data": {
                    "accessToken": "",
                    "refreshToken": "",
                    "tokenType": "bearer",
                    "expiresIn": 0,
                    "requiresMfa": True,
                    "user": None,
                }
            }
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=response_body,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"],
        )

    # Fetch user info for the response
    user = db.query(User).filter(User.email == login_data.email).first()

    response_body = {
        "data": {
            "accessToken": result["access_token"],
            "refreshToken": result["refresh_token"],
            "tokenType": result["token_type"],
            "expiresIn": result["expires_in"],
            "requiresMfa": False,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "roles": [role.name for role in user.roles],
            },
        }
    }

    response = JSONResponse(content=response_body)
    _set_token_cookies(response, result["access_token"], result["refresh_token"])
    return response


@router.post("/logout")
def logout(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    사용자 로그아웃

    HttpOnly 쿠키의 토큰도 함께 제거합니다.
    만료된 토큰이라도 로그아웃 처리 및 감사 로그를 기록합니다.
    """
    from jose import jwt as jose_jwt

    # Extract token from cookie or Authorization header for blacklisting
    token = request.cookies.get("access_token") or ""
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    # 만료된 토큰도 디코딩하여 사용자 식별 (서명은 검증)
    current_user = None
    if token:
        try:
            payload = jose_jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False},
            )
            user_id = payload.get("user_id")
            if user_id:
                current_user = db.query(User).filter(User.id == user_id).first()
        except Exception:
            pass

    if current_user and token:
        auth_service = AuthService(db)
        auth_service.logout(current_user, token=token)

    response = JSONResponse(content={"message": "로그아웃 성공"})
    _clear_token_cookies(response)
    return response


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    request: Request,
    refresh_data: Optional[RefreshTokenRequest] = None,
    db: Session = Depends(get_db),
):
    """
    토큰 갱신

    - **refresh_token**: 리프레시 토큰 (본문 또는 HttpOnly 쿠키에서 읽음)
    """
    # Try to get refresh token from request body first, then fall back to cookie
    token = None
    if refresh_data and refresh_data.refresh_token:
        token = refresh_data.refresh_token
    else:
        token = request.cookies.get("refresh_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="리프레시 토큰이 필요합니다.",
        )

    auth_service = AuthService(db)
    result = auth_service.refresh_tokens(token)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"],
        )

    response_body = {
        "data": {
            "accessToken": result["access_token"],
            "refreshToken": result["refresh_token"],
            "tokenType": result["token_type"],
            "expiresIn": result["expires_in"],
        }
    }

    response = JSONResponse(content=response_body)
    _set_token_cookies(response, result["access_token"], result["refresh_token"])
    return response


@router.post("/password/change")
def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    비밀번호 변경

    - **current_password**: 현재 비밀번호
    - **new_password**: 새 비밀번호
    - **confirm_password**: 새 비밀번호 확인
    """
    auth_service = AuthService(db)
    result = auth_service.change_password(
        user=current_user,
        current_password=password_data.current_password,
        new_password=password_data.new_password,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"],
        )

    return {"message": result["message"]}


@router.post("/mfa/setup", response_model=OTPSetup)
def setup_mfa(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OTPSetup:
    """
    MFA(2단계 인증) 설정

    QR 코드와 시크릿 키를 반환합니다.
    """
    if current_user.is_mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 2단계 인증이 활성화되어 있습니다.",
        )

    auth_service = AuthService(db)
    result = auth_service.setup_mfa(current_user)

    return OTPSetup(
        secret=result["secret"],
        uri=result["uri"],
        qr_code_base64=result["qr_code_base64"],
    )


class MFAVerifyRequest(OTPVerify):
    """MFA 검증 요청 (시크릿 포함)"""
    secret: str


@router.post("/mfa/verify", response_model=MFAEnableResponse)
def verify_mfa(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    MFA 검증 및 활성화

    - **otp_code**: 인증기 앱의 OTP 코드
    - **secret**: 설정 단계에서 받은 시크릿

    활성화 성공 시 일회용 백업 코드 10개를 반환합니다.
    """
    auth_service = AuthService(db)
    result = auth_service.verify_and_enable_mfa(
        user=current_user,
        otp_code=verify_data.otp_code,
        secret=verify_data.secret,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"],
        )

    return MFAEnableResponse(
        message=result["message"],
        backup_codes=result["backup_codes"],
    )


@router.post("/mfa/backup-codes/regenerate", response_model=MFABackupCodesResponse)
def regenerate_backup_codes(
    request_data: MFARegenerateBackupCodesRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    MFA 백업 코드 재생성

    기존 백업 코드를 모두 무효화하고 새로운 10개의 코드를 생성합니다.

    - **password**: 비밀번호
    - **otp_code**: 현재 OTP 코드
    """
    auth_service = AuthService(db)
    result = auth_service.regenerate_backup_codes(
        user=current_user,
        password=request_data.password,
        otp_code=request_data.otp_code,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"],
        )

    return MFABackupCodesResponse(
        backup_codes=result["backup_codes"],
    )


@router.post("/mfa/disable")
def disable_mfa(
    request_data: MFADisableRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    MFA 비활성화

    - **password**: 현재 비밀번호
    - **otp_code**: 현재 OTP 코드
    """
    auth_service = AuthService(db)
    result = auth_service.disable_mfa(
        user=current_user,
        password=request_data.password,
        otp_code=request_data.otp_code,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"],
        )

    return {"message": "2단계 인증이 비활성화되었습니다."}


@router.get("/me")
def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
):
    """
    현재 로그인한 사용자 정보 조회
    """
    return {
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "phone": current_user.phone,
            "departmentId": current_user.department_id,
            "department": current_user.department.name if current_user.department else None,
            "isActive": current_user.is_active,
            "isMfaEnabled": current_user.is_mfa_enabled,
            "roles": [role.name for role in current_user.roles],
            "permissions": list({
                perm.strip()
                for role in current_user.roles
                for perm in (role.permissions.split(",") if role.permissions else [])
            }),
            "lastPasswordChange": current_user.password_changed_at.isoformat() if current_user.password_changed_at else None,
        }
    }
