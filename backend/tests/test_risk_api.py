"""
위험 관리 API 테스트 (TDD)
Phase 2: FR-601 ~ FR-607
"""
import pytest
from datetime import date, timedelta
from typing import Dict
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


# =============================================================================
# 4.3: 위협 DB API 테스트 (FR-601)
# =============================================================================

class TestThreatAPI:
    """위협 API 테스트"""

    def test_get_threats_empty(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """위협 목록 조회 - 빈 목록"""
        response = client.get("/api/v1/threats", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_create_threat(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_threat_category
    ):
        """위협 생성"""
        payload = {
            "code": "T-API-001",
            "name": "API 테스트 위협",
            "description": "API 테스트용 위협",
            "category_id": test_threat_category.id,
            "threat_level": 3
        }
        response = client.post(
            "/api/v1/threats",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "T-API-001"
        assert data["threat_level"] == 3
        assert data["is_custom"] is True

    def test_create_threat_duplicate_code(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_threat
    ):
        """위협 생성 - 중복 코드 오류"""
        payload = {
            "code": test_threat.code,
            "name": "중복 위협",
        }
        response = client.post(
            "/api/v1/threats",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 400

    def test_get_threat_by_id(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_threat
    ):
        """위협 상세 조회"""
        response = client.get(
            f"/api/v1/threats/{test_threat.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_threat.id
        assert data["code"] == test_threat.code

    def test_update_threat(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_threat
    ):
        """위협 수정"""
        payload = {
            "name": "수정된 위협명",
            "threat_level": 1
        }
        response = client.put(
            f"/api/v1/threats/{test_threat.id}",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "수정된 위협명"
        assert data["threat_level"] == 1

    def test_get_threats_by_asset_type(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset_type
    ):
        """자산 유형별 위협 조회"""
        response = client.get(
            f"/api/v1/threats/by-asset-type/{test_asset_type.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_get_threats_unauthorized(self, client: TestClient):
        """인증 없이 위협 조회 - 401"""
        response = client.get("/api/v1/threats")
        assert response.status_code == 401


# =============================================================================
# 4.4: 취약점 DB API 테스트 (FR-602)
# =============================================================================

class TestVulnerabilityAPI:
    """취약점 API 테스트"""

    def test_get_vulnerabilities(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """취약점 목록 조회"""
        response = client.get("/api/v1/vulnerabilities", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_create_vulnerability(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_vulnerability_category
    ):
        """취약점 생성"""
        payload = {
            "code": "V-API-001",
            "name": "API 테스트 취약점",
            "description": "API 테스트용 취약점",
            "category_id": test_vulnerability_category.id,
            "vulnerability_level": 3
        }
        response = client.post(
            "/api/v1/vulnerabilities",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "V-API-001"
        assert data["is_custom"] is True

    def test_get_vulnerability_by_id(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_vulnerability
    ):
        """취약점 상세 조회"""
        response = client.get(
            f"/api/v1/vulnerabilities/{test_vulnerability.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_vulnerability.id

    def test_create_vulnerability_assessment(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_asset, test_vulnerability
    ):
        """취약점 점검 결과 등록"""
        payload = {
            "asset_id": test_asset.id,
            "vulnerability_id": test_vulnerability.id,
            "is_vulnerable": True,
            "assessment_date": str(date.today()),
            "findings": "취약점 발견됨"
        }
        response = client.post(
            "/api/v1/vulnerabilities/assessments",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["is_vulnerable"] is True

    def test_get_vulnerability_assessments(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """취약점 점검 결과 조회"""
        response = client.get(
            "/api/v1/vulnerabilities/assessments",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data


# =============================================================================
# 4.5: 위험 평가 API 테스트 (FR-603)
# =============================================================================

class TestRiskScenarioAPI:
    """위험 시나리오 API 테스트"""

    def test_get_risk_scenarios(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """시나리오 목록 조회"""
        response = client.get("/api/v1/risks/scenarios", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_create_risk_scenario(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """시나리오 생성"""
        payload = {
            "name": "API 테스트 시나리오",
            "description": "API 테스트용",
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=30))
        }
        response = client.post(
            "/api/v1/risks/scenarios",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "API 테스트 시나리오"
        assert data["status"] == "draft"

    def test_get_risk_scenario_by_id(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """시나리오 상세 조회"""
        response = client.get(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_risk_scenario.id

    def test_update_risk_scenario(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """시나리오 수정"""
        payload = {
            "name": "수정된 시나리오명",
            "status": "completed"
        }
        response = client.put(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "수정된 시나리오명"
        assert data["status"] == "completed"

    def test_delete_risk_scenario(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """시나리오 삭제"""
        # 먼저 생성
        create_response = client.post(
            "/api/v1/risks/scenarios",
            json={
                "name": "삭제할 시나리오",
                "start_date": str(date.today())
            },
            headers=admin_auth_headers
        )
        scenario_id = create_response.json()["id"]

        # 삭제
        response = client.delete(
            f"/api/v1/risks/scenarios/{scenario_id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 204


class TestRiskAssessmentAPI:
    """위험 평가 API 테스트"""

    def test_create_risk_assessment(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_risk_scenario, test_asset, test_threat, test_vulnerability
    ):
        """위험 평가 생성"""
        payload = {
            "asset_id": test_asset.id,
            "threat_id": test_threat.id,
            "vulnerability_id": test_vulnerability.id,
            "asset_value": 3,
            "threat_level": 3,
            "vulnerability_level": 3,
            "remarks": "고위험"
        }
        response = client.post(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/assessments",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["risk_score"] == 27
        assert data["risk_level"] == "high"

    def test_get_risk_assessments(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """시나리오별 위험 평가 목록 조회"""
        response = client.get(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/assessments",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_update_risk_assessment(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_assessment
    ):
        """위험 평가 수정"""
        payload = {
            "asset_value": 1,
            "threat_level": 1,
            "vulnerability_level": 1,
        }
        response = client.put(
            f"/api/v1/risks/assessments/{test_risk_assessment.id}",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["risk_score"] == 1
        assert data["risk_level"] == "low"

    def test_recalculate_scenario_risks(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """시나리오 전체 위험도 재계산"""
        response = client.post(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/calculate",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "recalculated_count" in data

    def test_compare_scenarios(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_risk_scenario, test_admin_user
    ):
        """시나리오 비교"""
        # 비교할 두 번째 시나리오 생성
        create_response = client.post(
            "/api/v1/risks/scenarios",
            json={
                "name": "비교 시나리오",
                "start_date": str(date.today())
            },
            headers=admin_auth_headers
        )
        scenario2_id = create_response.json()["id"]

        response = client.get(
            f"/api/v1/risks/scenarios/compare?scenario1_id={test_risk_scenario.id}&scenario2_id={scenario2_id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "scenario1_name" in data
        assert "scenario2_name" in data


# =============================================================================
# 4.6: DoA 관리 API 테스트 (FR-604)
# =============================================================================

class TestDoAAPI:
    """DoA 관리 API 테스트"""

    def test_get_current_doa(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_doa_config
    ):
        """현재 DoA 설정 조회"""
        response = client.get("/api/v1/risks/doa", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["threshold_value"] == test_doa_config.threshold_value

    def test_create_doa_config(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """DoA 설정 생성"""
        payload = {
            "threshold_value": 15,
            "effective_date": str(date.today()),
            "remarks": "새로운 DoA 기준"
        }
        response = client.post(
            "/api/v1/risks/doa",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["threshold_value"] == 15
        assert data["is_active"] is True

    def test_get_doa_history(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_doa_config
    ):
        """DoA 변경 이력 조회"""
        response = client.get("/api/v1/risks/doa/history", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_risks_exceeding_doa(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_risk_scenario, test_doa_config
    ):
        """DoA 초과 위험 목록 조회"""
        response = client.get(
            f"/api/v1/risks/exceeding-doa?scenario_id={test_risk_scenario.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data


# =============================================================================
# 4.7: 위험 처리 계획 API 테스트 (FR-605)
# =============================================================================

class TestRiskTreatmentAPI:
    """위험 처리 계획 API 테스트"""

    def test_get_treatment_plans(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """처리 계획 목록 조회"""
        response = client.get("/api/v1/risks/treatments", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_create_treatment_plan(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_risk_assessment, test_user
    ):
        """처리 계획 생성"""
        payload = {
            "strategy": "reduce",
            "description": "보안 솔루션 도입",
            "assignee_id": test_user.id,
            "due_date": str(date.today() + timedelta(days=90)),
            "budget": 10000000
        }
        response = client.post(
            f"/api/v1/risks/assessments/{test_risk_assessment.id}/treatments",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["strategy"] == "reduce"
        assert data["status"] == "planned"

    def test_get_treatment_plan_by_id(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_treatment_plan
    ):
        """처리 계획 상세 조회"""
        response = client.get(
            f"/api/v1/risks/treatments/{test_risk_treatment_plan.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_risk_treatment_plan.id

    def test_update_treatment_plan(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_treatment_plan
    ):
        """처리 계획 수정"""
        payload = {
            "status": "in_progress",
            "description": "진행 중"
        }
        response = client.put(
            f"/api/v1/risks/treatments/{test_risk_treatment_plan.id}",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"

    def test_create_treatment_action(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_treatment_plan
    ):
        """조치 결과 등록"""
        payload = {
            "action_description": "보안 패치 적용",
            "result": "완료",
            "residual_risk_score": 6
        }
        response = client.post(
            f"/api/v1/risks/treatments/{test_risk_treatment_plan.id}/actions",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["residual_risk_score"] == 6

    def test_get_treatment_progress(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """처리 진행률 조회"""
        response = client.get(
            "/api/v1/risks/treatments/progress",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "completion_rate" in data


# =============================================================================
# 4.8: SOA API 테스트 (FR-606)
# =============================================================================

class TestSOAAPI:
    """SOA API 테스트"""

    def test_get_soa_list(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """SOA 목록 조회"""
        response = client.get("/api/v1/soa", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_generate_soa(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """SOA 자동 생성"""
        response = client.post(
            "/api/v1/soa/generate",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "created_count" in data


# =============================================================================
# 4.9: 위험 평가 보고서 API 테스트 (FR-607)
# =============================================================================

class TestRiskReportAPI:
    """위험 평가 보고서 API 테스트"""

    def test_get_risk_report(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """위험 평가 보고서 조회"""
        response = client.get(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/report",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "scenario_name" in data
        assert "risk_distribution" in data

    def test_get_risk_matrix_data(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """위험 매트릭스 데이터 조회"""
        response = client.get(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/matrix",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "matrix" in data
        assert "labels" in data

    def test_export_risk_report_excel(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """위험 평가 보고서 Excel 내보내기"""
        response = client.get(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/report/export?format=excel",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 0

    def test_export_risk_report_word(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """위험 평가 보고서 Word 내보내기"""
        response = client.get(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/report/export?format=word",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 0

    def test_export_risk_report_invalid_format(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_risk_scenario
    ):
        """위험 평가 보고서 내보내기 - 잘못된 형식"""
        response = client.get(
            f"/api/v1/risks/scenarios/{test_risk_scenario.id}/report/export?format=pdf",
            headers=admin_auth_headers
        )
        assert response.status_code == 422  # Validation error

    def test_export_risk_report_not_found(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """위험 평가 보고서 내보내기 - 존재하지 않는 시나리오"""
        response = client.get(
            "/api/v1/risks/scenarios/99999/report/export?format=excel",
            headers=admin_auth_headers
        )
        assert response.status_code == 404
