"""
인증 API 테스트
"""
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import create_access_token, create_refresh_token


class TestLoginAPI:
    """로그인 API 테스트"""

    def test_login_success(self, client: TestClient, test_user: User):
        """정상 로그인"""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, test_user: User):
        """잘못된 비밀번호"""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "WrongPassword"}
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient):
        """존재하지 않는 사용자"""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@example.com", "password": "TestPass123!"}
        )
        assert response.status_code == 401

    def test_login_invalid_email_format(self, client: TestClient):
        """잘못된 이메일 형식"""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "invalid-email", "password": "TestPass123!"}
        )
        assert response.status_code == 422


class TestLogoutAPI:
    """로그아웃 API 테스트"""

    def test_logout_success(self, client: TestClient, test_user: User):
        """정상 로그아웃"""
        # 먼저 로그인
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        # 로그아웃
        response = client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

    def test_logout_without_token(self, client: TestClient):
        """토큰 없이 로그아웃"""
        response = client.post("/api/v1/auth/logout")
        assert response.status_code == 401


class TestRefreshTokenAPI:
    """토큰 갱신 API 테스트"""

    def test_refresh_token_success(self, client: TestClient, test_user: User):
        """토큰 갱신 성공"""
        # 로그인
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        refresh_token = login_response.json()["refresh_token"]

        # 갱신
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_with_invalid_token(self, client: TestClient):
        """잘못된 토큰으로 갱신"""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid_token"}
        )
        assert response.status_code == 401


class TestPasswordChangeAPI:
    """비밀번호 변경 API 테스트"""

    def test_change_password_success(self, client: TestClient, test_user: User):
        """비밀번호 변경 성공"""
        # 로그인
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        # 비밀번호 변경
        response = client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "TestPass123!",
                "new_password": "NewSecure456!",
                "confirm_password": "NewSecure456!"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

    def test_change_password_wrong_current(self, client: TestClient, test_user: User):
        """현재 비밀번호 오류"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        response = client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "WrongPassword",
                "new_password": "NewSecure456!",
                "confirm_password": "NewSecure456!"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400

    def test_change_password_mismatch(self, client: TestClient, test_user: User):
        """새 비밀번호 불일치"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        response = client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "TestPass123!",
                "new_password": "NewSecure456!",
                "confirm_password": "DifferentPass789!"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 422


class TestMFAAPI:
    """MFA API 테스트"""

    def test_mfa_setup(self, client: TestClient, test_user: User):
        """MFA 설정"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        response = client.post(
            "/api/v1/auth/mfa/setup",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "secret" in data
        assert "uri" in data
        assert "qr_code_base64" in data

    def test_mfa_verify(self, client: TestClient, db: Session, test_user: User):
        """MFA 검증 및 활성화"""
        import pyotp

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        # MFA 설정
        setup_response = client.post(
            "/api/v1/auth/mfa/setup",
            headers={"Authorization": f"Bearer {token}"}
        )
        secret = setup_response.json()["secret"]

        # OTP 생성
        totp = pyotp.TOTP(secret)
        otp_code = totp.now()

        # MFA 검증
        response = client.post(
            "/api/v1/auth/mfa/verify",
            json={"otp_code": otp_code, "secret": secret},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200


class TestMeAPI:
    """현재 사용자 정보 API 테스트"""

    def test_get_me(self, client: TestClient, test_user: User):
        """현재 사용자 정보 조회"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"
        assert data["name"] == "테스트 사용자"

    def test_get_me_without_token(self, client: TestClient):
        """토큰 없이 사용자 정보 조회"""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401
