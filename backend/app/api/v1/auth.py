"""
인증 API 라우터
/api/v1/auth
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, get_current_active_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    PasswordChange,
    OTPSetup,
    OTPVerify,
    RefreshTokenRequest,
)
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService


router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    사용자 로그인

    - **email**: 사용자 이메일
    - **password**: 비밀번호
    - **otp_code**: OTP 코드 (MFA 활성화 시 필요)
    """
    auth_service = AuthService(db)
    result = auth_service.authenticate(
        email=login_data.email,
        password=login_data.password,
        otp_code=login_data.otp_code,
    )

    if not result["success"]:
        if result.get("requires_mfa"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "message": result["error"],
                    "requires_mfa": True,
                },
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"],
        )

    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type=result["token_type"],
        expires_in=result["expires_in"],
    )


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    사용자 로그아웃
    """
    auth_service = AuthService(db)
    result = auth_service.logout(current_user, token="")

    return {"message": result["message"]}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    토큰 갱신

    - **refresh_token**: 리프레시 토큰
    """
    auth_service = AuthService(db)
    result = auth_service.refresh_tokens(refresh_data.refresh_token)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"],
        )

    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type=result["token_type"],
        expires_in=result["expires_in"],
    )


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


@router.post("/mfa/verify")
def verify_mfa(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    MFA 검증 및 활성화

    - **otp_code**: 인증기 앱의 OTP 코드
    - **secret**: 설정 단계에서 받은 시크릿
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

    return {"message": result["message"]}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """
    현재 로그인한 사용자 정보 조회
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        phone=current_user.phone,
        department_id=current_user.department_id,
        department_name=current_user.department.name if current_user.department else None,
        is_active=current_user.is_active,
        is_mfa_enabled=current_user.is_mfa_enabled,
        roles=[role.name for role in current_user.roles],
        created_at=current_user.created_at,
        last_login_at=current_user.last_login_at,
    )
