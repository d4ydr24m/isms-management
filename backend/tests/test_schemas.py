"""
Pydantic 스키마 테스트
"""
import pytest
from datetime import datetime
from pydantic import ValidationError

from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserList,
    UserInDB,
)
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    PasswordChange,
    OTPSetup,
    OTPVerify,
)
from app.schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    PermissionResponse,
)


class TestUserSchemas:
    """사용자 스키마 테스트"""

    def test_user_create_valid(self):
        """유효한 사용자 생성 스키마"""
        user = UserCreate(
            email="test@example.com",
            password="TestPass123!",
            name="테스트 사용자",
            phone="010-1234-5678",
            department_id=1,
        )
        assert user.email == "test@example.com"
        assert user.name == "테스트 사용자"

    def test_user_create_invalid_email(self):
        """잘못된 이메일로 사용자 생성"""
        with pytest.raises(ValidationError) as excinfo:
            UserCreate(
                email="invalid-email",
                password="TestPass123!",
                name="테스트 사용자",
            )
        assert "email" in str(excinfo.value).lower()

    def test_user_create_short_password(self):
        """너무 짧은 비밀번호로 사용자 생성"""
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                password="short",
                name="테스트 사용자",
            )

    def test_user_update_partial(self):
        """부분 업데이트 스키마"""
        user = UserUpdate(name="새 이름")
        assert user.name == "새 이름"
        assert user.email is None
        assert user.phone is None

    def test_user_response(self):
        """사용자 응답 스키마"""
        user = UserResponse(
            id=1,
            email="test@example.com",
            name="테스트 사용자",
            phone="010-1234-5678",
            department_id=1,
            department_name="테스트부서",
            is_active=True,
            is_mfa_enabled=False,
            roles=["일반직원"],
            created_at=datetime.utcnow(),
            last_login_at=None,
        )
        assert user.id == 1
        assert "일반직원" in user.roles

    def test_user_list(self):
        """사용자 목록 스키마"""
        users = UserList(
            items=[
                UserResponse(
                    id=1,
                    email="test@example.com",
                    name="테스트 사용자",
                    is_active=True,
                    is_mfa_enabled=False,
                    roles=[],
                    created_at=datetime.utcnow(),
                )
            ],
            total=1,
            page=1,
            size=10,
            pages=1,
        )
        assert users.total == 1
        assert len(users.items) == 1


class TestAuthSchemas:
    """인증 스키마 테스트"""

    def test_login_request_valid(self):
        """유효한 로그인 요청"""
        login = LoginRequest(
            email="test@example.com",
            password="TestPass123!",
        )
        assert login.email == "test@example.com"

    def test_login_request_with_otp(self):
        """OTP 포함 로그인 요청"""
        login = LoginRequest(
            email="test@example.com",
            password="TestPass123!",
            otp_code="123456",
        )
        assert login.otp_code == "123456"

    def test_token_response(self):
        """토큰 응답 스키마"""
        token = TokenResponse(
            access_token="eyJ...",
            refresh_token="eyJ...",
            token_type="bearer",
            expires_in=1800,
        )
        assert token.token_type == "bearer"
        assert token.expires_in == 1800

    def test_password_change_valid(self):
        """유효한 비밀번호 변경 요청"""
        change = PasswordChange(
            current_password="OldPass123!",
            new_password="NewPass123!",
            confirm_password="NewPass123!",
        )
        assert change.new_password == change.confirm_password

    def test_password_change_mismatch(self):
        """비밀번호 확인 불일치"""
        with pytest.raises(ValidationError) as excinfo:
            PasswordChange(
                current_password="OldPass123!",
                new_password="NewPass123!",
                confirm_password="DifferentPass123!",
            )
        assert "match" in str(excinfo.value).lower() or "일치" in str(excinfo.value)

    def test_otp_setup(self):
        """OTP 설정 응답 스키마"""
        setup = OTPSetup(
            secret="JBSWY3DPEHPK3PXP",
            uri="otpauth://totp/ISMS:test@example.com?secret=...",
            qr_code_base64="data:image/png;base64,...",
        )
        assert setup.secret is not None

    def test_otp_verify(self):
        """OTP 검증 요청 스키마"""
        verify = OTPVerify(otp_code="123456")
        assert verify.otp_code == "123456"

    def test_otp_verify_invalid_length(self):
        """잘못된 OTP 길이"""
        with pytest.raises(ValidationError):
            OTPVerify(otp_code="12345")  # 6자리여야 함


class TestRoleSchemas:
    """역할 스키마 테스트"""

    def test_role_create_valid(self):
        """유효한 역할 생성"""
        role = RoleCreate(
            name="테스트역할",
            description="테스트 역할입니다",
            permissions=["evidence:read", "control:read"],
        )
        assert role.name == "테스트역할"
        assert len(role.permissions) == 2

    def test_role_update_partial(self):
        """부분 역할 업데이트"""
        role = RoleUpdate(description="새 설명")
        assert role.description == "새 설명"
        assert role.name is None

    def test_role_response(self):
        """역할 응답 스키마"""
        role = RoleResponse(
            id=1,
            name="CISO",
            description="최고정보보호책임자",
            permissions=["all"],
            is_system_role=True,
            user_count=1,
            created_at=datetime.utcnow(),
        )
        assert role.is_system_role is True

    def test_permission_response(self):
        """권한 응답 스키마"""
        perm = PermissionResponse(
            code="evidence:read",
            name="증적 조회",
            description="증적 목록 및 상세 조회",
            category="증적관리",
        )
        assert perm.code == "evidence:read"
