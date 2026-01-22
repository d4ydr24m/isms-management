"""
인증 서비스
로그인, 비밀번호 관리, MFA, 토큰 관리
"""
import io
import base64
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import qrcode
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
    validate_password_policy,
    generate_totp_secret,
    verify_totp,
    get_totp_uri,
)
from app.models.user import User


class AuthService:
    """인증 서비스 클래스"""

    def __init__(self, db: Session):
        self.db = db

    def authenticate(
        self,
        email: str,
        password: str,
        otp_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        사용자 인증

        Args:
            email: 사용자 이메일
            password: 비밀번호
            otp_code: OTP 코드 (MFA 활성화 시)

        Returns:
            Dict with success, tokens or error message
        """
        # 사용자 조회
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            return {"success": False, "error": "이메일 또는 비밀번호가 올바르지 않습니다."}

        # 계정 활성 상태 확인
        if not user.is_active:
            return {"success": False, "error": "비활성화된 계정입니다."}

        # 계정 잠금 확인
        if user.locked_until and user.locked_until > datetime.utcnow():
            remaining = (user.locked_until - datetime.utcnow()).seconds // 60
            return {
                "success": False,
                "error": f"계정이 잠겨 있습니다. {remaining}분 후 다시 시도해주세요.",
            }

        # 비밀번호 확인
        if not verify_password(password, user.hashed_password):
            self._handle_failed_login(user)
            return {"success": False, "error": "이메일 또는 비밀번호가 올바르지 않습니다."}

        # MFA 확인
        if user.is_mfa_enabled:
            if not otp_code:
                return {
                    "success": False,
                    "requires_mfa": True,
                    "error": "OTP 코드가 필요합니다.",
                }

            if not verify_totp(user.mfa_secret, otp_code):
                return {"success": False, "error": "OTP 코드가 올바르지 않습니다."}

        # 로그인 성공 처리
        self._handle_successful_login(user)

        # 토큰 생성
        token_data = {"sub": user.email, "user_id": user.id}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return {
            "success": True,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    def _handle_failed_login(self, user: User) -> None:
        """
        로그인 실패 처리

        Args:
            user: 사용자
        """
        user.failed_login_attempts += 1

        # 최대 실패 횟수 초과 시 계정 잠금
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(
                minutes=settings.ACCOUNT_LOCKOUT_DURATION_MINUTES
            )

        self.db.commit()

    def _handle_successful_login(self, user: User) -> None:
        """
        로그인 성공 처리

        Args:
            user: 사용자
        """
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.utcnow()
        self.db.commit()

    def change_password(
        self,
        user: User,
        current_password: str,
        new_password: str,
    ) -> Dict[str, Any]:
        """
        비밀번호 변경

        Args:
            user: 사용자
            current_password: 현재 비밀번호
            new_password: 새 비밀번호

        Returns:
            Dict with success or error message
        """
        # 현재 비밀번호 확인
        if not verify_password(current_password, user.hashed_password):
            return {"success": False, "error": "현재 비밀번호가 올바르지 않습니다."}

        # 비밀번호 정책 검증
        policy_result = validate_password_policy(new_password)
        if not policy_result["valid"]:
            return {
                "success": False,
                "error": "; ".join(policy_result["errors"]),
            }

        # 비밀번호 변경
        user.hashed_password = get_password_hash(new_password)
        user.password_changed_at = datetime.utcnow()
        self.db.commit()

        return {"success": True, "message": "비밀번호가 변경되었습니다."}

    def refresh_tokens(self, refresh_token: str) -> Dict[str, Any]:
        """
        토큰 갱신

        Args:
            refresh_token: 리프레시 토큰

        Returns:
            Dict with success and new tokens or error message
        """
        # 토큰 디코딩
        payload = decode_token(refresh_token)
        if payload is None:
            return {"success": False, "error": "유효하지 않은 토큰입니다."}

        # 리프레시 토큰인지 확인
        if payload.get("type") != "refresh":
            return {"success": False, "error": "리프레시 토큰이 아닙니다."}

        # 사용자 확인
        user_id = payload.get("user_id")
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            return {"success": False, "error": "사용자를 찾을 수 없습니다."}

        # 새 토큰 생성
        token_data = {"sub": user.email, "user_id": user.id}
        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)

        return {
            "success": True,
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    def setup_mfa(self, user: User) -> Dict[str, Any]:
        """
        MFA 설정

        Args:
            user: 사용자

        Returns:
            Dict with secret, uri, qr_code_base64
        """
        # 시크릿 생성
        secret = generate_totp_secret()

        # URI 생성
        uri = get_totp_uri(secret, user.email)

        # QR 코드 생성 (pillow 이미지로 변환)
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)

        # PIL Image로 생성하여 PNG 저장
        try:
            from PIL import Image
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
        except ImportError:
            # pillow 없을 경우 pypng 사용
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer)

        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()

        return {
            "success": True,
            "secret": secret,
            "uri": uri,
            "qr_code_base64": f"data:image/png;base64,{qr_code_base64}",
        }

    def verify_and_enable_mfa(
        self,
        user: User,
        otp_code: str,
        secret: str,
    ) -> Dict[str, Any]:
        """
        MFA 검증 및 활성화

        Args:
            user: 사용자
            otp_code: OTP 코드
            secret: MFA 시크릿

        Returns:
            Dict with success or error message
        """
        # OTP 검증
        if not verify_totp(secret, otp_code):
            return {"success": False, "error": "OTP 코드가 올바르지 않습니다."}

        # MFA 활성화
        user.mfa_secret = secret
        user.is_mfa_enabled = True
        self.db.commit()

        return {"success": True, "message": "2단계 인증이 활성화되었습니다."}

    def disable_mfa(
        self,
        user: User,
        password: str,
        otp_code: str,
    ) -> Dict[str, Any]:
        """
        MFA 비활성화

        Args:
            user: 사용자
            password: 비밀번호
            otp_code: OTP 코드

        Returns:
            Dict with success or error message
        """
        # 비밀번호 확인
        if not verify_password(password, user.hashed_password):
            return {"success": False, "error": "비밀번호가 올바르지 않습니다."}

        # OTP 확인
        if not verify_totp(user.mfa_secret, otp_code):
            return {"success": False, "error": "OTP 코드가 올바르지 않습니다."}

        # MFA 비활성화
        user.mfa_secret = None
        user.is_mfa_enabled = False
        self.db.commit()

        return {"success": True, "message": "2단계 인증이 비활성화되었습니다."}

    def logout(self, user: User, token: str) -> Dict[str, Any]:
        """
        로그아웃 처리

        TODO: Redis 블랙리스트에 토큰 추가

        Args:
            user: 사용자
            token: 액세스 토큰

        Returns:
            Dict with success
        """
        # 현재 단순 구현 - 추후 Redis 블랙리스트 구현
        return {"success": True, "message": "로그아웃되었습니다."}

    def check_password_expiry(self, user: User) -> bool:
        """
        비밀번호 만료 확인

        Args:
            user: 사용자

        Returns:
            bool: 만료 여부
        """
        if not user.password_changed_at:
            return True

        expiry_date = user.password_changed_at + timedelta(
            days=settings.PASSWORD_EXPIRY_DAYS
        )
        return datetime.utcnow() > expiry_date
