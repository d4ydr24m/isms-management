"""
보안 유틸리티 테스트
app/core/security.py 테스트
"""
import pytest
from datetime import datetime, timedelta

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_totp_secret,
    verify_totp,
    get_totp_uri,
    validate_password_policy,
)


class TestPasswordHashing:
    """비밀번호 해싱 테스트"""

    def test_password_hash_is_different_from_plain(self):
        """해시된 비밀번호는 원본과 다르다"""
        plain = "TestPassword123!"
        hashed = get_password_hash(plain)
        assert hashed != plain

    def test_password_hash_is_unique(self):
        """같은 비밀번호도 해시할 때마다 다르다 (salt)"""
        plain = "TestPassword123!"
        hash1 = get_password_hash(plain)
        hash2 = get_password_hash(plain)
        assert hash1 != hash2

    def test_verify_correct_password(self):
        """올바른 비밀번호 검증"""
        plain = "TestPassword123!"
        hashed = get_password_hash(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_wrong_password(self):
        """잘못된 비밀번호 검증"""
        plain = "TestPassword123!"
        hashed = get_password_hash(plain)
        assert verify_password("WrongPassword", hashed) is False

    def test_empty_password_hash(self):
        """빈 비밀번호 해싱"""
        hashed = get_password_hash("")
        assert hashed is not None
        assert len(hashed) > 0


class TestJWTTokens:
    """JWT 토큰 테스트"""

    def test_create_access_token(self):
        """액세스 토큰 생성"""
        data = {"sub": "user@example.com", "user_id": 1}
        token = create_access_token(data)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_with_custom_expiry(self):
        """커스텀 만료 시간으로 액세스 토큰 생성"""
        data = {"sub": "user@example.com"}
        token = create_access_token(data, expires_delta=timedelta(hours=1))
        decoded = decode_token(token)
        assert decoded is not None
        assert decoded["type"] == "access"

    def test_create_refresh_token(self):
        """리프레시 토큰 생성"""
        data = {"sub": "user@example.com", "user_id": 1}
        token = create_refresh_token(data)
        assert token is not None
        assert isinstance(token, str)

    def test_decode_valid_token(self):
        """유효한 토큰 디코딩"""
        data = {"sub": "user@example.com", "user_id": 1}
        token = create_access_token(data)
        decoded = decode_token(token)
        assert decoded is not None
        assert decoded["sub"] == "user@example.com"
        assert decoded["user_id"] == 1
        assert decoded["type"] == "access"

    def test_decode_refresh_token(self):
        """리프레시 토큰 디코딩"""
        data = {"sub": "user@example.com"}
        token = create_refresh_token(data)
        decoded = decode_token(token)
        assert decoded is not None
        assert decoded["type"] == "refresh"

    def test_decode_invalid_token(self):
        """잘못된 토큰 디코딩"""
        decoded = decode_token("invalid_token_string")
        assert decoded is None

    def test_decode_expired_token(self):
        """만료된 토큰 디코딩"""
        data = {"sub": "user@example.com"}
        token = create_access_token(data, expires_delta=timedelta(seconds=-1))
        decoded = decode_token(token)
        assert decoded is None

    def test_token_contains_expiry(self):
        """토큰에 만료 시간 포함"""
        data = {"sub": "user@example.com"}
        token = create_access_token(data)
        decoded = decode_token(token)
        assert "exp" in decoded


class TestTOTP:
    """TOTP 테스트"""

    def test_generate_totp_secret(self):
        """TOTP 시크릿 생성"""
        secret = generate_totp_secret()
        assert secret is not None
        assert len(secret) == 32  # base32 인코딩된 20바이트

    def test_totp_secrets_are_unique(self):
        """TOTP 시크릿은 매번 고유하다"""
        secret1 = generate_totp_secret()
        secret2 = generate_totp_secret()
        assert secret1 != secret2

    def test_verify_valid_totp(self):
        """유효한 TOTP 검증"""
        import pyotp
        secret = generate_totp_secret()
        totp = pyotp.TOTP(secret)
        token = totp.now()
        assert verify_totp(secret, token) is True

    def test_verify_invalid_totp(self):
        """잘못된 TOTP 검증"""
        secret = generate_totp_secret()
        assert verify_totp(secret, "000000") is False

    def test_get_totp_uri(self):
        """TOTP URI 생성"""
        from urllib.parse import unquote
        secret = generate_totp_secret()
        email = "user@example.com"
        uri = get_totp_uri(secret, email)
        decoded_uri = unquote(uri)
        assert uri is not None
        assert "otpauth://totp/" in uri
        assert email in decoded_uri  # URL 디코딩 후 이메일 확인
        assert "ISMS" in decoded_uri


class TestPasswordPolicy:
    """비밀번호 정책 테스트"""

    def test_valid_password(self):
        """유효한 비밀번호"""
        result = validate_password_policy("ValidPass123!")
        assert result["valid"] is True
        assert len(result["errors"]) == 0

    def test_password_too_short(self):
        """비밀번호 너무 짧음"""
        result = validate_password_policy("Abc1!")
        assert result["valid"] is False
        assert "최소 8자 이상" in str(result["errors"])

    def test_password_no_uppercase(self):
        """대문자 없음"""
        result = validate_password_policy("testpass123!")
        assert result["valid"] is False
        assert "대문자" in str(result["errors"])

    def test_password_no_lowercase(self):
        """소문자 없음"""
        result = validate_password_policy("TESTPASS123!")
        assert result["valid"] is False
        assert "소문자" in str(result["errors"])

    def test_password_no_digit(self):
        """숫자 없음"""
        result = validate_password_policy("TestPassword!")
        assert result["valid"] is False
        assert "숫자" in str(result["errors"])

    def test_password_no_special(self):
        """특수문자 없음"""
        result = validate_password_policy("TestPassword123")
        assert result["valid"] is False
        assert "특수문자" in str(result["errors"])

    def test_password_multiple_errors(self):
        """여러 오류"""
        result = validate_password_policy("abc")
        assert result["valid"] is False
        assert len(result["errors"]) > 1
