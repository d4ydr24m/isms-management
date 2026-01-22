"""
사용자 관리 API 테스트
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, Role


class TestUserList:
    """사용자 목록 조회 테스트"""

    def test_get_users_as_admin(self, client: TestClient, test_admin_user: User):
        """관리자로 사용자 목록 조회"""
        # 로그인
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data

    def test_get_users_as_regular_user(self, client: TestClient, test_user: User):
        """일반 사용자로 목록 조회 (권한 필요)"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "testuser@example.com", "password": "TestPass123!"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        # 일반직원은 user:read 권한 없음
        assert response.status_code == 403

    def test_get_users_with_search(self, client: TestClient, test_admin_user: User, test_user: User):
        """검색 필터로 목록 조회"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/v1/users?search=테스트",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200


class TestUserCreate:
    """사용자 생성 테스트"""

    def test_create_user_as_admin(self, client: TestClient, test_admin_user: User, test_department):
        """관리자로 사용자 생성"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.post(
            "/api/v1/users",
            json={
                "email": "newuser@example.com",
                "password": "NewUser123!",
                "name": "새 사용자",
                "phone": "010-9999-9999",
                "department_id": test_department.id,
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["name"] == "새 사용자"

    def test_create_user_duplicate_email(self, client: TestClient, test_admin_user: User, test_user: User):
        """중복 이메일로 사용자 생성 실패"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.post(
            "/api/v1/users",
            json={
                "email": "testuser@example.com",  # 이미 존재하는 이메일
                "password": "NewUser123!",
                "name": "새 사용자",
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400

    def test_create_user_weak_password(self, client: TestClient, test_admin_user: User):
        """약한 비밀번호로 사용자 생성 실패"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.post(
            "/api/v1/users",
            json={
                "email": "newuser@example.com",
                "password": "weak",  # 정책 위반
                "name": "새 사용자",
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 422


class TestUserDetail:
    """사용자 상세 조회 테스트"""

    def test_get_user_detail(self, client: TestClient, test_admin_user: User, test_user: User):
        """사용자 상세 조회"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            f"/api/v1/users/{test_user.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testuser@example.com"

    def test_get_nonexistent_user(self, client: TestClient, test_admin_user: User):
        """존재하지 않는 사용자 조회"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/v1/users/9999",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404


class TestUserUpdate:
    """사용자 수정 테스트"""

    def test_update_user(self, client: TestClient, test_admin_user: User, test_user: User):
        """사용자 정보 수정"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.put(
            f"/api/v1/users/{test_user.id}",
            json={"name": "수정된 이름", "phone": "010-0000-1111"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "수정된 이름"
        assert data["phone"] == "010-0000-1111"


class TestUserDelete:
    """사용자 삭제 테스트"""

    def test_delete_user(self, client: TestClient, db: Session, test_admin_user: User, test_user: User):
        """사용자 비활성화"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.delete(
            f"/api/v1/users/{test_user.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 204

        # 비활성화 확인
        db.refresh(test_user)
        assert test_user.is_active is False

    def test_delete_self(self, client: TestClient, test_admin_user: User):
        """자기 자신 삭제 불가"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.delete(
            f"/api/v1/users/{test_admin_user.id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400


class TestRoleAssignment:
    """역할 할당 테스트"""

    def test_assign_roles(self, client: TestClient, db: Session, test_admin_user: User, test_user: User, test_role_security_manager: Role):
        """사용자에게 역할 할당"""
        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "Admin123!@#"}
        )
        token = login_response.json()["access_token"]

        response = client.put(
            f"/api/v1/users/{test_user.id}/roles",
            json={"role_ids": [test_role_security_manager.id]},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "보안담당자" in data["roles"]
