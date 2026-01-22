"""
감사 API 통합 테스트

TDD RED 단계: 감사 관련 API 엔드포인트 테스트
5.3 ~ 5.6 API 구현 테스트
"""
import pytest
from datetime import date, datetime, timedelta
from typing import Dict

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.audit import AuditPlan, NonConformity
from app.models.control import ControlItem
from app.models.user import User


class TestAuditPlanAPI:
    """5.3 내부감사 계획 API 테스트 (FR-201)"""

    def test_create_audit_plan(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_admin_user: User
    ):
        """POST /audits - 감사 계획 생성"""
        response = client.post(
            "/api/v1/audits",
            headers=admin_auth_headers,
            json={
                "title": "2024년 1차 내부감사",
                "description": "연간 내부감사",
                "audit_type": "internal",
                "start_date": "2024-03-01",
                "end_date": "2024-03-15",
                "scope": "전사 정보보호 관리체계",
                "lead_auditor_id": test_admin_user.id,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "2024년 1차 내부감사"
        assert data["status"] == "planning"

    def test_create_audit_plan_unauthorized(self, client: TestClient):
        """인증 없이 감사 계획 생성 실패"""
        response = client.post(
            "/api/v1/audits",
            json={
                "title": "테스트",
                "audit_type": "internal",
                "start_date": "2024-03-01",
                "end_date": "2024-03-15",
                "scope": "전사",
                "lead_auditor_id": 1,
            },
        )

        assert response.status_code == 401

    def test_get_audit_plans(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """GET /audits - 감사 계획 목록 조회"""
        response = client.get(
            "/api/v1/audits",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1

    def test_get_audit_plan_detail(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """GET /audits/{id} - 감사 계획 상세 조회"""
        response = client.get(
            f"/api/v1/audits/{sample_audit_plan.id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_audit_plan.id
        assert data["title"] == sample_audit_plan.title

    def test_get_audit_plan_not_found(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """GET /audits/{id} - 존재하지 않는 감사 계획"""
        response = client.get(
            "/api/v1/audits/99999",
            headers=admin_auth_headers,
        )

        assert response.status_code == 404

    def test_update_audit_plan(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """PUT /audits/{id} - 감사 계획 수정"""
        response = client.put(
            f"/api/v1/audits/{sample_audit_plan.id}",
            headers=admin_auth_headers,
            json={
                "title": "수정된 감사 제목",
                "status": "in_progress",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "수정된 감사 제목"
        assert data["status"] == "in_progress"

    def test_delete_audit_plan(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan
    ):
        """DELETE /audits/{id} - 감사 계획 삭제"""
        response = client.delete(
            f"/api/v1/audits/{sample_audit_plan.id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 204

        # 삭제 후 조회 불가 확인
        response = client.get(
            f"/api/v1/audits/{sample_audit_plan.id}",
            headers=admin_auth_headers,
        )
        assert response.status_code == 404

    def test_update_audit_team(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan, test_user: User
    ):
        """PUT /audits/{id}/team - 감사팀 구성 수정"""
        response = client.put(
            f"/api/v1/audits/{sample_audit_plan.id}/team",
            headers=admin_auth_headers,
            json={
                "lead_auditor_id": test_user.id,
                "team_member_ids": [test_user.id],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["lead_auditor_id"] == test_user.id


class TestChecklistAPI:
    """5.4 감사 체크리스트 API 테스트 (FR-202)"""

    def test_generate_checklist(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan, sample_control_items: list
    ):
        """POST /audits/{id}/checklist/generate - 체크리스트 자동 생성"""
        response = client.post(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist/generate",
            headers=admin_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= len(sample_control_items)

    def test_get_checklist(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan, sample_control_items: list
    ):
        """GET /audits/{id}/checklist - 체크리스트 조회"""
        # 먼저 체크리스트 생성
        client.post(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist/generate",
            headers=admin_auth_headers,
        )

        response = client.get(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0

    def test_submit_checklist_result(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan, sample_control_items: list
    ):
        """PUT /audits/{id}/checklist/{item_id} - 점검 결과 입력"""
        # 체크리스트 생성
        response = client.post(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist/generate",
            headers=admin_auth_headers,
        )
        checklist_id = response.json()["items"][0]["id"]

        # 점검 결과 입력
        response = client.put(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist/{checklist_id}",
            headers=admin_auth_headers,
            json={
                "result": "conformity",
                "finding": "정책 문서 확인 완료",
                "evidence_reference": "1,2,3",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["result"] == "conformity"

    def test_link_evidence_to_checklist(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan, sample_control_items: list
    ):
        """POST /audits/{id}/checklist/{item_id}/evidence - 근거 증적 연결"""
        # 체크리스트 생성
        response = client.post(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist/generate",
            headers=admin_auth_headers,
        )
        checklist_id = response.json()["items"][0]["id"]

        # 먼저 점검 결과 입력
        client.put(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist/{checklist_id}",
            headers=admin_auth_headers,
            json={"result": "conformity"},
        )

        # 증적 연결
        response = client.post(
            f"/api/v1/audits/{sample_audit_plan.id}/checklist/{checklist_id}/evidence",
            headers=admin_auth_headers,
            json={"evidence_ids": [1, 2, 3]},
        )

        assert response.status_code == 200


class TestNonConformityAPI:
    """5.5 부적합 관리 API 테스트 (FR-203)"""

    def test_create_non_conformity(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_audit_plan: AuditPlan, sample_control_items: list,
        test_user: User
    ):
        """POST /nonconformities - 부적합 등록"""
        response = client.post(
            "/api/v1/nonconformities",
            headers=admin_auth_headers,
            json={
                "audit_plan_id": sample_audit_plan.id,
                "control_item_id": sample_control_items[0].id,
                "nc_type": "major",
                "severity": "high",
                "title": "정보보호 정책 미수립",
                "description": "정보보호 정책이 수립되어 있지 않음",
                "requirement": "정보보호 정책을 수립하여야 한다",
                "responsible_person_id": test_user.id,
                "due_date": "2024-04-30",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "정보보호 정책 미수립"
        assert data["status"] == "open"

    def test_get_non_conformities(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_non_conformity: NonConformity
    ):
        """GET /nonconformities - 부적합 목록 조회"""
        response = client.get(
            "/api/v1/nonconformities",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1

    def test_get_non_conformities_with_filter(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_non_conformity: NonConformity
    ):
        """GET /nonconformities - 부적합 목록 필터 조회"""
        response = client.get(
            f"/api/v1/nonconformities?severity=high&audit_plan_id={sample_non_conformity.audit_plan_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert all(item["severity"] == "high" for item in data["items"])

    def test_get_non_conformity_detail(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_non_conformity: NonConformity
    ):
        """GET /nonconformities/{id} - 부적합 상세 조회"""
        response = client.get(
            f"/api/v1/nonconformities/{sample_non_conformity.id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_non_conformity.id

    def test_update_non_conformity(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_non_conformity: NonConformity
    ):
        """PUT /nonconformities/{id} - 부적합 수정"""
        response = client.put(
            f"/api/v1/nonconformities/{sample_non_conformity.id}",
            headers=admin_auth_headers,
            json={
                "title": "수정된 부적합 제목",
                "status": "in_progress",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "수정된 부적합 제목"

    def test_get_non_conformity_history(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_control_items: list, sample_non_conformity: NonConformity
    ):
        """GET /nonconformities/{id}/history - 부적합 이력 조회"""
        response = client.get(
            f"/api/v1/nonconformities/{sample_non_conformity.id}/history",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200


class TestCorrectiveActionAPI:
    """5.6 시정조치 API 테스트 (FR-203)"""

    def test_create_corrective_action(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_non_conformity: NonConformity, test_user: User
    ):
        """POST /nonconformities/{id}/corrective-actions - 시정조치 요청"""
        response = client.post(
            f"/api/v1/nonconformities/{sample_non_conformity.id}/corrective-actions",
            headers=admin_auth_headers,
            json={
                "action_plan": "정보보호 정책 수립 및 승인",
                "root_cause": "정보보호 조직 부재",
                "preventive_measures": "연간 정책 검토 프로세스 수립",
                "responsible_person_id": test_user.id,
                "planned_completion_date": "2024-04-15",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["action_plan"] == "정보보호 정책 수립 및 승인"
        assert data["status"] == "planned"

    def test_update_corrective_action(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_non_conformity: NonConformity, test_user: User
    ):
        """PUT /nonconformities/{id}/corrective-actions/{action_id} - 시정조치 계획/결과 등록"""
        # 시정조치 생성
        response = client.post(
            f"/api/v1/nonconformities/{sample_non_conformity.id}/corrective-actions",
            headers=admin_auth_headers,
            json={
                "action_plan": "정보보호 정책 수립",
                "responsible_person_id": test_user.id,
                "planned_completion_date": "2024-04-15",
            },
        )
        ca_id = response.json()["id"]

        # 시정조치 결과 등록
        response = client.put(
            f"/api/v1/nonconformities/{sample_non_conformity.id}/corrective-actions/{ca_id}",
            headers=admin_auth_headers,
            json={
                "actual_completion_date": "2024-04-10",
                "result_description": "정보보호 정책 수립 완료",
                "status": "completed",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"

    def test_verify_corrective_action(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        sample_non_conformity: NonConformity, test_user: User
    ):
        """POST /nonconformities/{id}/corrective-actions/{action_id}/verify - 검증 및 종료"""
        # 시정조치 생성 및 완료
        response = client.post(
            f"/api/v1/nonconformities/{sample_non_conformity.id}/corrective-actions",
            headers=admin_auth_headers,
            json={
                "action_plan": "정보보호 정책 수립",
                "responsible_person_id": test_user.id,
                "planned_completion_date": "2024-04-15",
            },
        )
        ca_id = response.json()["id"]

        client.put(
            f"/api/v1/nonconformities/{sample_non_conformity.id}/corrective-actions/{ca_id}",
            headers=admin_auth_headers,
            json={"status": "completed"},
        )

        # 검증
        response = client.post(
            f"/api/v1/nonconformities/{sample_non_conformity.id}/corrective-actions/{ca_id}/verify",
            headers=admin_auth_headers,
            json={
                "verification_result": "approved",
                "verification_comment": "정상적으로 이행됨 확인",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "verified"
        assert data["verification_result"] == "approved"
