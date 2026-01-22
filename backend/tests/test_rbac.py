"""
역할 기반 접근 제어 (RBAC) 테스트
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, Role


class TestRoleBasedAccess:
    """역할 기반 접근 제어 테스트"""

    def test_admin_can_access_all(self, client: TestClient, test_admin_user: User):
        """관리자(CISO)는 모든 API 접근 가능"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        # 사용자 목록
        assert client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"}).status_code == 200

        # 역할 목록
        assert client.get("/api/v1/roles", headers={"Authorization": f"Bearer {token}"}).status_code == 200

        # 부서 목록
        assert client.get("/api/v1/departments", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    def test_regular_user_limited_access(self, client: TestClient, test_user: User):
        """일반 직원은 제한된 접근"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        # 사용자 목록 - 권한 없음
        assert client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"}).status_code == 403

        # 역할 목록 - 권한 없음
        assert client.get("/api/v1/roles", headers={"Authorization": f"Bearer {token}"}).status_code == 403

        # 부서 목록 - 로그인한 사용자면 조회 가능
        assert client.get("/api/v1/departments", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    def test_security_manager_access(self, client: TestClient, db: Session, test_user: User, test_role_security_manager: Role):
        """보안담당자 권한 테스트"""
        # 보안담당자 역할 추가
        test_user.roles.append(test_role_security_manager)
        db.commit()

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        # 사용자 목록 - user:read 권한 있음
        response = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200


class TestRoleManagement:
    """역할 관리 API 테스트"""

    def test_get_roles(self, client: TestClient, test_admin_user: User):
        """역할 목록 조회"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/v1/roles",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_create_custom_role(self, client: TestClient, test_admin_user: User):
        """커스텀 역할 생성"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.post(
            "/api/v1/roles",
            json={
                "name": "증적관리자",
                "description": "증적 관리 전용 역할",
                "permissions": ["evidence:create", "evidence:read", "evidence:update"],
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "증적관리자"
        assert data["is_system_role"] is False

    def test_cannot_modify_system_role(self, client: TestClient, test_admin_user: User, test_role_ciso: Role):
        """시스템 역할 수정 불가"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.put(
            f"/api/v1/roles/{test_role_ciso.id}",
            json={"name": "새이름"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403

    def test_get_role_permissions(self, client: TestClient, test_admin_user: User, test_role_ciso: Role):
        """역할 권한 조회"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            f"/api/v1/roles/{test_role_ciso.id}/permissions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_get_all_permissions(self, client: TestClient, test_admin_user: User):
        """전체 권한 목록 조회"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/v1/roles/permissions/all",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0


class TestUnauthorizedAccess:
    """인증되지 않은 접근 테스트"""

    def test_no_token(self, client: TestClient):
        """토큰 없이 접근 시도"""
        response = client.get("/api/v1/users")
        assert response.status_code == 401

    def test_invalid_token(self, client: TestClient):
        """잘못된 토큰으로 접근 시도"""
        response = client.get(
            "/api/v1/users",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401

    def test_inactive_user_access(self, client: TestClient, db: Session, test_user: User):
        """비활성 사용자 접근 시도"""
        # 먼저 로그인
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        # 사용자 비활성화
        test_user.is_active = False
        db.commit()

        # 접근 시도
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403
