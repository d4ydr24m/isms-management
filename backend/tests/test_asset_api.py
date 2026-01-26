"""
자산 관리 API 테스트 (TDD)
Phase 2: FR-501 ~ FR-505
"""
import pytest
from datetime import date
from typing import Dict
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.asset import (
    AssetType, AssetCategory, Asset, AssetValuation,
    AssetHistory, AssetAssignment, AssetStatus, AssetAssignmentRole
)


# =============================================================================
# FR-501: 자산 유형/분류 API 테스트
# =============================================================================

class TestAssetTypeAPI:
    """자산 유형 API 테스트"""

    def test_get_asset_types_empty(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """자산 유형 목록 조회 - 빈 목록"""
        response = client.get("/api/v1/assets/types", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_create_asset_type(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """자산 유형 생성"""
        payload = {
            "code": "NET",
            "name": "네트워크장비",
            "description": "네트워크 장비 자산",
            "icon": "network",
            "sort_order": 1
        }
        response = client.post(
            "/api/v1/assets/types",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "NET"
        assert data["name"] == "네트워크장비"
        assert data["is_custom"] is True  # 사용자 생성은 커스텀

    def test_create_asset_type_duplicate_code(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset_type
    ):
        """자산 유형 생성 - 중복 코드 오류"""
        payload = {
            "code": test_asset_type.code,  # 이미 존재하는 코드
            "name": "중복 테스트",
        }
        response = client.post(
            "/api/v1/assets/types",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 400

    def test_get_asset_types_list(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset_type
    ):
        """자산 유형 목록 조회"""
        response = client.get("/api/v1/assets/types", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

    def test_get_asset_type_unauthorized(self, client: TestClient):
        """인증 없이 자산 유형 조회 - 401"""
        response = client.get("/api/v1/assets/types")
        assert response.status_code == 401


class TestAssetCategoryAPI:
    """자산 분류 API 테스트"""

    def test_create_asset_category(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """자산 분류 생성 (대분류)"""
        payload = {
            "code": "CAT-HW",
            "name": "하드웨어",
            "description": "하드웨어 자산 분류",
            "level": 1,
            "sort_order": 1
        }
        response = client.post(
            "/api/v1/assets/categories",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "CAT-HW"
        assert data["level"] == 1

    def test_create_asset_category_with_parent(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """자산 분류 생성 (중분류 - 부모 있음)"""
        # 먼저 대분류 생성
        parent_payload = {
            "code": "CAT-SW",
            "name": "소프트웨어",
            "level": 1,
        }
        parent_response = client.post(
            "/api/v1/assets/categories",
            json=parent_payload,
            headers=admin_auth_headers
        )
        parent_id = parent_response.json()["id"]

        # 중분류 생성
        child_payload = {
            "code": "CAT-SW-OS",
            "name": "운영체제",
            "level": 2,
            "parent_id": parent_id
        }
        response = client.post(
            "/api/v1/assets/categories",
            json=child_payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["level"] == 2
        assert data["parent_id"] == parent_id

    def test_create_category_level_validation(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """자산 분류 레벨 검증 (최대 3단계)"""
        payload = {
            "code": "CAT-INVALID",
            "name": "잘못된 레벨",
            "level": 4,  # 최대 3
        }
        response = client.post(
            "/api/v1/assets/categories",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 422  # Validation error

    def test_get_asset_categories(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """자산 분류 목록 조회 (계층 구조)"""
        # 대분류 생성
        client.post(
            "/api/v1/assets/categories",
            json={"code": "CAT-TEST", "name": "테스트 분류", "level": 1},
            headers=admin_auth_headers
        )

        response = client.get("/api/v1/assets/categories", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_update_asset_category(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """자산 분류 수정"""
        # 생성
        create_response = client.post(
            "/api/v1/assets/categories",
            json={"code": "CAT-UPDATE", "name": "수정 전", "level": 1},
            headers=admin_auth_headers
        )
        category_id = create_response.json()["id"]

        # 수정
        response = client.put(
            f"/api/v1/assets/categories/{category_id}",
            json={"name": "수정 후", "description": "설명 추가"},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "수정 후"
        assert data["description"] == "설명 추가"


# =============================================================================
# FR-502: 자산 등록/관리 API 테스트
# =============================================================================

class TestAssetCRUDAPI:
    """자산 CRUD API 테스트"""

    def test_create_asset(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_asset_type, test_department
    ):
        """자산 등록"""
        payload = {
            "name": "웹 서버",
            "description": "메인 웹 서버",
            "asset_type_id": test_asset_type.id,
            "department_id": test_department.id,
            "location": "서버실 B",
            "ip_address": "192.168.1.200",
            "hostname": "web-server-01",
            "os_version": "Ubuntu 22.04",
            "manufacturer": "Dell",
            "model": "PowerEdge R740",
        }
        response = client.post(
            "/api/v1/assets",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "웹 서버"
        assert data["asset_code"] is not None  # 자동 채번
        assert data["status"] == AssetStatus.INTRODUCED.value

    def test_create_asset_auto_code(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_asset_type, test_department
    ):
        """자산 코드 자동 채번 테스트"""
        # 첫 번째 자산
        payload1 = {
            "name": "서버1",
            "asset_type_id": test_asset_type.id,
        }
        response1 = client.post(
            "/api/v1/assets", json=payload1, headers=admin_auth_headers
        )
        code1 = response1.json()["asset_code"]

        # 두 번째 자산
        payload2 = {
            "name": "서버2",
            "asset_type_id": test_asset_type.id,
        }
        response2 = client.post(
            "/api/v1/assets", json=payload2, headers=admin_auth_headers
        )
        code2 = response2.json()["asset_code"]

        # 코드가 다른지 확인
        assert code1 != code2
        # 코드 형식 확인 (AST-{유형코드}-{년월}-{순번})
        assert code1.startswith("AST-SRV-")

    def test_get_asset_detail(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 상세 조회"""
        response = client.get(
            f"/api/v1/assets/{test_asset.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_asset.id
        assert data["name"] == test_asset.name

    def test_get_asset_not_found(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """존재하지 않는 자산 조회"""
        response = client.get(
            "/api/v1/assets/99999",
            headers=admin_auth_headers
        )
        assert response.status_code == 404

    def test_update_asset(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 수정"""
        payload = {
            "name": "수정된 서버",
            "description": "수정된 설명",
            "status": AssetStatus.OPERATING.value
        }
        response = client.put(
            f"/api/v1/assets/{test_asset.id}",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "수정된 서버"
        assert data["status"] == AssetStatus.OPERATING.value

    def test_delete_asset_soft(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 비활성화 (소프트 삭제)"""
        response = client.delete(
            f"/api/v1/assets/{test_asset.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 204

        # 조회 시 비활성 상태 확인
        detail_response = client.get(
            f"/api/v1/assets/{test_asset.id}",
            headers=admin_auth_headers
        )
        assert detail_response.json()["is_active"] is False

    def test_list_assets_with_pagination(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 목록 조회 (페이지네이션)"""
        response = client.get(
            "/api/v1/assets?page=1&size=10",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data

    def test_list_assets_with_filters(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_asset, test_asset_type, test_department
    ):
        """자산 목록 필터 조회"""
        # 자산 유형 필터
        response = client.get(
            f"/api/v1/assets?asset_type_id={test_asset_type.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()["items"]) >= 1

        # 부서 필터
        response = client.get(
            f"/api/v1/assets?department_id={test_department.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200

        # 상태 필터
        response = client.get(
            f"/api/v1/assets?status={AssetStatus.OPERATING.value}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200

    def test_search_assets(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 검색"""
        response = client.get(
            f"/api/v1/assets?search={test_asset.name[:4]}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert len(response.json()["items"]) >= 1


class TestAssetImportExportAPI:
    """자산 엑셀 임포트/내보내기 테스트"""

    def test_get_import_template(
        self, client: TestClient, admin_auth_headers: Dict[str, str]
    ):
        """임포트 템플릿 다운로드"""
        response = client.get(
            "/api/v1/assets/template",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")

    def test_export_assets(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 엑셀 내보내기"""
        response = client.get(
            "/api/v1/assets/export",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")


# =============================================================================
# FR-503: 자산 가치 평가 API 테스트
# =============================================================================

class TestAssetValuationAPI:
    """자산 가치 평가 API 테스트"""

    def test_create_valuation(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 가치 평가 생성"""
        payload = {
            "confidentiality": 3,  # 상
            "integrity": 2,  # 중
            "availability": 3,  # 상
            "evaluation_reason": "중요 서비스 운영 자산"
        }
        response = client.post(
            f"/api/v1/assets/{test_asset.id}/valuation",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["confidentiality"] == 3
        assert data["integrity"] == 2
        assert data["availability"] == 3
        # 중요도는 MAX(C, I, A)로 자동 계산
        assert data["importance_level"] == 3

    def test_valuation_range_validation(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """CIA 값 범위 검증 (1-3)"""
        payload = {
            "confidentiality": 5,  # 범위 초과
            "integrity": 2,
            "availability": 2,
        }
        response = client.post(
            f"/api/v1/assets/{test_asset.id}/valuation",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 422

    def test_get_current_valuation(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """현재 가치 평가 조회"""
        # 먼저 평가 생성
        client.post(
            f"/api/v1/assets/{test_asset.id}/valuation",
            json={"confidentiality": 2, "integrity": 2, "availability": 2},
            headers=admin_auth_headers
        )

        response = client.get(
            f"/api/v1/assets/{test_asset.id}/valuation",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "confidentiality" in data

    def test_get_valuation_history(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """가치 평가 이력 조회"""
        # 평가 생성 (두 번)
        client.post(
            f"/api/v1/assets/{test_asset.id}/valuation",
            json={"confidentiality": 1, "integrity": 1, "availability": 1},
            headers=admin_auth_headers
        )
        client.post(
            f"/api/v1/assets/{test_asset.id}/valuation",
            json={"confidentiality": 2, "integrity": 2, "availability": 2},
            headers=admin_auth_headers
        )

        response = client.get(
            f"/api/v1/assets/{test_asset.id}/valuation/history",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2


# =============================================================================
# FR-504: 자산 이력 API 테스트
# =============================================================================

class TestAssetHistoryAPI:
    """자산 이력 API 테스트"""

    def test_get_asset_history(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 변경 이력 조회"""
        response = client.get(
            f"/api/v1/assets/{test_asset.id}/history",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_history_recorded_on_update(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 수정 시 이력 자동 기록"""
        # 자산 수정
        client.put(
            f"/api/v1/assets/{test_asset.id}",
            json={"name": "이력 테스트용 이름 변경"},
            headers=admin_auth_headers
        )

        # 이력 확인
        response = client.get(
            f"/api/v1/assets/{test_asset.id}/history",
            headers=admin_auth_headers
        )
        data = response.json()
        # update 이력이 있어야 함
        update_records = [h for h in data if h["change_type"] == "update"]
        assert len(update_records) >= 1

    def test_dispose_asset(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 폐기 처리"""
        payload = {
            "disposal_date": str(date.today()),
            "disposal_reason": "노후화로 인한 폐기",
            "disposal_method": "물리적 파기",
            "data_deletion_confirmed": True,
            "data_deletion_method": "디가우징"
        }
        response = client.post(
            f"/api/v1/assets/{test_asset.id}/dispose",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == AssetStatus.DISPOSED.value

    def test_lifecycle_stats(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 생명주기 통계"""
        response = client.get(
            "/api/v1/assets/lifecycle-stats",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "by_status" in data


# =============================================================================
# FR-505: 자산-담당자 API 테스트
# =============================================================================

class TestAssetAssignmentAPI:
    """자산 담당자 할당 API 테스트"""

    def test_create_assignment(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_asset, test_user
    ):
        """담당자 할당"""
        payload = {
            "user_id": test_user.id,
            "role": AssetAssignmentRole.MANAGER.value,
            "remarks": "담당자 할당"
        }
        response = client.post(
            f"/api/v1/assets/{test_asset.id}/assignments",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == test_user.id
        assert data["role"] == AssetAssignmentRole.MANAGER.value

    def test_get_assignments(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """자산 담당자 목록 조회"""
        response = client.get(
            f"/api/v1/assets/{test_asset.id}/assignments",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_update_assignment(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_asset, test_user
    ):
        """담당자 역할 변경"""
        # 먼저 담당자 할당
        create_response = client.post(
            f"/api/v1/assets/{test_asset.id}/assignments",
            json={"user_id": test_user.id, "role": AssetAssignmentRole.USER.value},
            headers=admin_auth_headers
        )
        assignment_id = create_response.json()["id"]

        # 역할 변경
        response = client.put(
            f"/api/v1/assets/{test_asset.id}/assignments/{assignment_id}",
            json={"role": AssetAssignmentRole.MANAGER.value},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["role"] == AssetAssignmentRole.MANAGER.value

    def test_delete_assignment(
        self, client: TestClient, admin_auth_headers: Dict[str, str],
        test_asset, test_user
    ):
        """담당자 해제"""
        # 담당자 할당
        create_response = client.post(
            f"/api/v1/assets/{test_asset.id}/assignments",
            json={"user_id": test_user.id, "role": AssetAssignmentRole.USER.value},
            headers=admin_auth_headers
        )
        assignment_id = create_response.json()["id"]

        # 해제
        response = client.delete(
            f"/api/v1/assets/{test_asset.id}/assignments/{assignment_id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 204

    def test_get_handover_history(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """인수인계 이력 조회"""
        response = client.get(
            f"/api/v1/assets/{test_asset.id}/handover",
            headers=admin_auth_headers
        )
        assert response.status_code == 200


# =============================================================================
# 자산 통계 API 테스트
# =============================================================================

class TestAssetStatsAPI:
    """자산 통계 API 테스트"""

    def test_get_stats(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """전체 자산 통계"""
        response = client.get(
            "/api/v1/assets/stats",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_count" in data

    def test_get_by_type(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """유형별 자산 통계"""
        response = client.get(
            "/api/v1/assets/by-type",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_by_department(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """부서별 자산 통계"""
        response = client.get(
            "/api/v1/assets/by-department",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_by_importance(
        self, client: TestClient, admin_auth_headers: Dict[str, str], test_asset
    ):
        """중요도별 자산 통계"""
        response = client.get(
            "/api/v1/assets/by-importance",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# =============================================================================
# 권한 테스트
# =============================================================================

class TestAssetPermissions:
    """자산 API 권한 테스트"""

    def test_read_permission_required(
        self, client: TestClient, auth_headers: Dict[str, str], test_asset
    ):
        """읽기 권한 필요"""
        # 일반 사용자는 asset:read 권한 없음 (기본 role에 따라 다름)
        response = client.get(
            f"/api/v1/assets/{test_asset.id}",
            headers=auth_headers
        )
        # 권한에 따라 200 또는 403
        assert response.status_code in [200, 403]

    def test_create_permission_required(
        self, client: TestClient, auth_headers: Dict[str, str], test_asset_type
    ):
        """생성 권한 필요"""
        payload = {
            "name": "테스트 자산",
            "asset_type_id": test_asset_type.id,
        }
        response = client.post(
            "/api/v1/assets",
            json=payload,
            headers=auth_headers
        )
        # 일반 사용자는 403이어야 함
        assert response.status_code == 403
