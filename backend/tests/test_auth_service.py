"""
인증 서비스 테스트
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.services.auth_service import AuthService
from app.models.user import User
from app.core.security import get_password_hash, verify_password


class TestAuthServiceLogin:
    """로그인 서비스 테스트"""

    def test_login_success(self, db: Session, test_user: User):
        """정상 로그인"""
        auth_service = AuthService(db)
        result = auth_service.authenticate(
            email="testuser@example.com",
            password="TestPass123!",
        )
        assert result["success"] is True
        assert "access_token" in result
        assert "refresh_token" in result

    def test_login_wrong_password(self, db: Session, test_user: User):
        """잘못된 비밀번호"""
        auth_service = AuthService(db)
        result = auth_service.authenticate(
            email="testuser@example.com",
            password="WrongPassword123!",
        )
        assert result["success"] is False
        assert "error" in result

    def test_login_nonexistent_user(self, db: Session):
        """존재하지 않는 사용자"""
        auth_service = AuthService(db)
        result = auth_service.authenticate(
            email="nonexistent@example.com",
            password="TestPass123!",
        )
        assert result["success"] is False

    def test_login_inactive_user(self, db: Session, test_inactive_user: User):
        """비활성 사용자 로그인 실패"""
        auth_service = AuthService(db)
        result = auth_service.authenticate(
            email="inactive@example.com",
            password="TestPass123!",
        )
        assert result["success"] is False
        assert "비활성" in result.get("error", "")

    def test_login_locked_user(self, db: Session, test_locked_user: User):
        """잠긴 사용자 로그인 실패"""
        auth_service = AuthService(db)
        result = auth_service.authenticate(
            email="locked@example.com",
            password="TestPass123!",
        )
        assert result["success"] is False
        assert "잠금" in result.get("error", "") or "잠겨" in result.get("error", "")


class TestAccountLockout:
    """계정 잠금 테스트"""

    def test_failed_attempts_increment(self, db: Session, test_user: User):
        """로그인 실패 시 실패 횟수 증가"""
        auth_service = AuthService(db)
        initial_attempts = test_user.failed_login_attempts

        auth_service.authenticate(
            email="testuser@example.com",
            password="WrongPassword",
        )

        db.refresh(test_user)
        assert test_user.failed_login_attempts == initial_attempts + 1

    def test_account_lockout_after_max_attempts(self, db: Session, test_user: User):
        """최대 실패 횟수 후 계정 잠금"""
        auth_service = AuthService(db)

        # 5번 실패
        for _ in range(5):
            auth_service.authenticate(
                email="testuser@example.com",
                password="WrongPassword",
            )

        db.refresh(test_user)
        assert test_user.locked_until is not None
        assert test_user.locked_until > datetime.utcnow()

    def test_successful_login_resets_attempts(self, db: Session, test_user: User):
        """성공적인 로그인 후 실패 횟수 초기화"""
        auth_service = AuthService(db)

        # 먼저 실패
        auth_service.authenticate(
            email="testuser@example.com",
            password="WrongPassword",
        )
        db.refresh(test_user)
        assert test_user.failed_login_attempts > 0

        # 성공적인 로그인
        auth_service.authenticate(
            email="testuser@example.com",
            password="TestPass123!",
        )
        db.refresh(test_user)
        assert test_user.failed_login_attempts == 0


class TestMFA:
    """MFA 테스트"""

    def test_mfa_required_when_enabled(self, db: Session, test_user: User):
        """MFA 활성화 시 OTP 필요"""
        auth_service = AuthService(db)

        # MFA 활성화
        test_user.is_mfa_enabled = True
        test_user.mfa_secret = "JBSWY3DPEHPK3PXP"
        db.commit()

        result = auth_service.authenticate(
            email="testuser@example.com",
            password="TestPass123!",
        )
        assert result["success"] is False
        assert result.get("requires_mfa") is True

    def test_mfa_with_valid_otp(self, db: Session, test_user: User):
        """유효한 OTP로 MFA 로그인"""
        import pyotp
        auth_service = AuthService(db)

        # MFA 활성화
        secret = "JBSWY3DPEHPK3PXP"
        test_user.is_mfa_enabled = True
        test_user.mfa_secret = secret
        db.commit()

        totp = pyotp.TOTP(secret)
        valid_otp = totp.now()

        result = auth_service.authenticate(
            email="testuser@example.com",
            password="TestPass123!",
            otp_code=valid_otp,
        )
        assert result["success"] is True

    def test_mfa_with_invalid_otp(self, db: Session, test_user: User):
        """잘못된 OTP로 MFA 로그인 실패"""
        auth_service = AuthService(db)

        # MFA 활성화
        test_user.is_mfa_enabled = True
        test_user.mfa_secret = "JBSWY3DPEHPK3PXP"
        db.commit()

        result = auth_service.authenticate(
            email="testuser@example.com",
            password="TestPass123!",
            otp_code="000000",
        )
        assert result["success"] is False


class TestPasswordChange:
    """비밀번호 변경 테스트"""

    def test_change_password_success(self, db: Session, test_user: User):
        """비밀번호 변경 성공"""
        auth_service = AuthService(db)
        result = auth_service.change_password(
            user=test_user,
            current_password="TestPass123!",
            new_password="NewSecurePass456!",
        )
        assert result["success"] is True

        # 새 비밀번호로 로그인 확인
        db.refresh(test_user)
        assert verify_password("NewSecurePass456!", test_user.hashed_password)

    def test_change_password_wrong_current(self, db: Session, test_user: User):
        """현재 비밀번호 오류"""
        auth_service = AuthService(db)
        result = auth_service.change_password(
            user=test_user,
            current_password="WrongPassword",
            new_password="NewSecurePass456!",
        )
        assert result["success"] is False

    def test_change_password_policy_violation(self, db: Session, test_user: User):
        """비밀번호 정책 위반"""
        auth_service = AuthService(db)
        result = auth_service.change_password(
            user=test_user,
            current_password="TestPass123!",
            new_password="weak",
        )
        assert result["success"] is False


class TestTokenRefresh:
    """토큰 갱신 테스트"""

    def test_refresh_token_success(self, db: Session, test_user: User):
        """토큰 갱신 성공"""
        auth_service = AuthService(db)

        # 먼저 로그인
        login_result = auth_service.authenticate(
            email="testuser@example.com",
            password="TestPass123!",
        )
        refresh_token = login_result["refresh_token"]

        # 토큰 갱신
        result = auth_service.refresh_tokens(refresh_token)
        assert result["success"] is True
        assert "access_token" in result
        assert "refresh_token" in result

    def test_refresh_with_invalid_token(self, db: Session):
        """잘못된 리프레시 토큰"""
        auth_service = AuthService(db)
        result = auth_service.refresh_tokens("invalid_token")
        assert result["success"] is False

    def test_refresh_with_access_token(self, db: Session, test_user: User):
        """액세스 토큰으로 갱신 시도 실패"""
        auth_service = AuthService(db)

        # 로그인
        login_result = auth_service.authenticate(
            email="testuser@example.com",
            password="TestPass123!",
        )
        access_token = login_result["access_token"]

        # 액세스 토큰으로 갱신 시도
        result = auth_service.refresh_tokens(access_token)
        assert result["success"] is False


class TestMFASetup:
    """MFA 설정 테스트"""

    def test_setup_mfa(self, db: Session, test_user: User):
        """MFA 설정"""
        auth_service = AuthService(db)
        result = auth_service.setup_mfa(test_user)

        assert result["success"] is True
        assert "secret" in result
        assert "uri" in result
        assert "qr_code_base64" in result

    def test_verify_and_enable_mfa(self, db: Session, test_user: User):
        """MFA 검증 및 활성화"""
        import pyotp
        auth_service = AuthService(db)

        # MFA 설정
        setup_result = auth_service.setup_mfa(test_user)
        secret = setup_result["secret"]

        # 유효한 OTP로 검증
        totp = pyotp.TOTP(secret)
        valid_otp = totp.now()

        result = auth_service.verify_and_enable_mfa(test_user, valid_otp, secret)
        assert result["success"] is True

        db.refresh(test_user)
        assert test_user.is_mfa_enabled is True
