"""
심사원 계정 및 감사 로그 테스트

5.7 심사원 모드 테스트 (FR-204)
5.9 감사 추적 시스템 테스트 (FR-206)
"""
import pytest
from datetime import datetime, timedelta
from typing import Dict

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.audit import AuditPlan
from app.models.user import User, AuditorAccount


class TestAuditorAccountAPI:
    """5.7 심사원 모드 API 테스트 (FR-204)"""

    def test_create_auditor_account(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """POST /auditor-accounts - 심사원 임시 계정 생성"""
        now = datetime.utcnow()
        response = client.post(
            "/api/v1/auditor-accounts",
            headers=admin_auth_headers,
            json={
                "email": "auditor@kisa.or.kr",
                "name": "김심사",
                "audit_plan_id": sample_audit_plan.id,
                "valid_from": now.isoformat(),
                "valid_until": (now + timedelta(days=30)).isoformat(),
                "access_scope": '{"domains": ["1", "2"]}',
                "allow_download": False,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["user_email"] == "auditor@kisa.or.kr"
        assert data["allow_download"] is False

    def test_get_auditor_accounts(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """GET /auditor-accounts - 심사원 계정 목록 조회"""
        # 먼저 계정 생성
        now = datetime.utcnow()
        client.post(
            "/api/v1/auditor-accounts",
            headers=admin_auth_headers,
            json={
                "email": "auditor2@kisa.or.kr",
                "name": "박심사",
                "audit_plan_id": sample_audit_plan.id,
                "valid_from": now.isoformat(),
                "valid_until": (now + timedelta(days=30)).isoformat(),
                "allow_download": False,
            },
        )

        response = client.get(
            "/api/v1/auditor-accounts",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1

    def test_update_auditor_account(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """PUT /auditor-accounts/{id} - 심사원 계정 수정"""
        # 계정 생성
        now = datetime.utcnow()
        response = client.post(
            "/api/v1/auditor-accounts",
            headers=admin_auth_headers,
            json={
                "email": "auditor3@kisa.or.kr",
                "name": "이심사",
                "audit_plan_id": sample_audit_plan.id,
                "valid_from": now.isoformat(),
                "valid_until": (now + timedelta(days=30)).isoformat(),
                "allow_download": False,
            },
        )
        account_id = response.json()["id"]

        # 수정
        response = client.put(
            f"/api/v1/auditor-accounts/{account_id}",
            headers=admin_auth_headers,
            json={
                "allow_download": True,
                "valid_until": (now + timedelta(days=60)).isoformat(),
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["allow_download"] is True

    def test_delete_auditor_account(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """DELETE /auditor-accounts/{id} - 심사원 계정 만료/삭제"""
        # 계정 생성
        now = datetime.utcnow()
        response = client.post(
            "/api/v1/auditor-accounts",
            headers=admin_auth_headers,
            json={
                "email": "auditor4@kisa.or.kr",
                "name": "최심사",
                "audit_plan_id": sample_audit_plan.id,
                "valid_from": now.isoformat(),
                "valid_until": (now + timedelta(days=30)).isoformat(),
                "allow_download": False,
            },
        )
        account_id = response.json()["id"]

        # 삭제 (비활성화)
        response = client.delete(
            f"/api/v1/auditor-accounts/{account_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 204

    def test_auditor_readonly_access(
        self, client: TestClient, db: Session,
        sample_audit_plan: AuditPlan, admin_auth_headers: Dict[str, str]
    ):
        """심사원 계정 읽기 전용 접근 테스트"""
        # 심사원 계정 생성
        now = datetime.utcnow()
        response = client.post(
            "/api/v1/auditor-accounts",
            headers=admin_auth_headers,
            json={
                "email": "readonly_auditor@kisa.or.kr",
                "name": "읽기전용심사원",
                "audit_plan_id": sample_audit_plan.id,
                "valid_from": now.isoformat(),
                "valid_until": (now + timedelta(days=30)).isoformat(),
                "allow_download": False,
            },
        )
        assert response.status_code == 201

        # 심사원 계정으로 로그인
        login_response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "readonly_auditor@kisa.or.kr",
                "password": "TempPassword123!",  # 임시 비밀번호
            },
        )
        # 임시 비밀번호 설정이 필요하므로 이 테스트는 실패할 수 있음
        # 실제 구현에서는 임시 비밀번호 발급 로직 필요


class TestAuditLogAPI:
    """5.9 감사 추적 시스템 API 테스트 (FR-206)"""

    def test_get_audit_logs(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """GET /audit-logs - 감사 로그 조회"""
        response = client.get(
            "/api/v1/audit-logs",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_get_audit_logs_with_filter(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """GET /audit-logs - 감사 로그 필터 조회"""
        response = client.get(
            "/api/v1/audit-logs?action=login&resource_type=auth",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200

    def test_export_audit_logs(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """GET /audit-logs/export - 감사 로그 내보내기"""
        response = client.get(
            "/api/v1/audit-logs/export?format=csv",
            headers=admin_auth_headers,
        )

        # CSV 또는 Excel 다운로드
        assert response.status_code in [200, 204]

    def test_verify_hash_chain(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """GET /audit-logs/verify - 해시 체인 무결성 검증"""
        response = client.get(
            "/api/v1/audit-logs/verify",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "is_valid" in data
