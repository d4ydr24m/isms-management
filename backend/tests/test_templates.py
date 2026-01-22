"""
증적 템플릿 API 테스트
TDD - RED 단계: 테스트 먼저 작성
"""
import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.evidence import EvidenceTemplate


@pytest.fixture
def test_template(db: Session, test_admin_user) -> EvidenceTemplate:
    """테스트용 템플릿 생성"""
    template = EvidenceTemplate(
        name="보안점검표 템플릿",
        description="월간 보안점검 시 사용하는 템플릿",
        category="보안점검",
        file_path="templates/security_checklist.xlsx",
        file_name="보안점검표.xlsx",
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        is_system_template=False,
        created_by=test_admin_user.id,
        download_count=0,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@pytest.fixture
def system_template(db: Session, test_admin_user) -> EvidenceTemplate:
    """시스템 템플릿 생성"""
    template = EvidenceTemplate(
        name="ISMS-P 기본 템플릿",
        description="시스템 기본 제공 템플릿",
        category="기본",
        file_path="templates/system/isms_template.xlsx",
        file_name="ISMS-P_기본템플릿.xlsx",
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        is_system_template=True,
        created_by=test_admin_user.id,
        download_count=5,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


class TestGetTemplates:
    """GET /templates 테스트"""

    def test_get_templates_list(
        self,
        client: TestClient,
        auth_headers: dict,
        test_template: EvidenceTemplate,
    ):
        """템플릿 목록 조회"""
        response = client.get("/api/v1/templates", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1

    def test_get_templates_filter_by_category(
        self,
        client: TestClient,
        auth_headers: dict,
        test_template: EvidenceTemplate,
    ):
        """카테고리별 필터링"""
        response = client.get(
            "/api/v1/templates?category=보안점검",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert all(item["category"] == "보안점검" for item in data["items"])

    def test_get_templates_search(
        self,
        client: TestClient,
        auth_headers: dict,
        test_template: EvidenceTemplate,
    ):
        """검색어 필터링"""
        response = client.get(
            "/api/v1/templates?search=보안점검",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1


class TestCreateTemplate:
    """POST /templates 테스트"""

    @patch("app.api.v1.templates.FileService")
    def test_create_template_success(
        self,
        mock_file_service_class,
        client: TestClient,
        admin_auth_headers: dict,
    ):
        """템플릿 생성 성공"""
        # Mock FileService
        mock_file_service = MagicMock()
        mock_file_service.upload_file.return_value = {
            "file_path": "templates/new_template.xlsx",
            "original_filename": "새템플릿.xlsx",
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        mock_file_service_class.return_value = mock_file_service

        # 파일 업로드
        file_content = b"test file content"
        files = {"file": ("새템플릿.xlsx", io.BytesIO(file_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        data = {
            "name": "새 템플릿",
            "description": "테스트 설명",
            "category": "테스트",
        }

        response = client.post(
            "/api/v1/templates",
            headers=admin_auth_headers,
            files=files,
            data=data,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["name"] == "새 템플릿"
        assert result["category"] == "테스트"

    def test_create_template_unauthorized(
        self,
        client: TestClient,
        auth_headers: dict,  # 일반 사용자
    ):
        """권한 없는 사용자의 템플릿 생성 시도"""
        file_content = b"test file content"
        files = {"file": ("test.xlsx", io.BytesIO(file_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        data = {
            "name": "테스트",
            "description": "테스트",
            "category": "테스트",
        }

        response = client.post(
            "/api/v1/templates",
            headers=auth_headers,
            files=files,
            data=data,
        )

        assert response.status_code == 403


class TestGetTemplateById:
    """GET /templates/{id} 테스트"""

    def test_get_template_detail(
        self,
        client: TestClient,
        auth_headers: dict,
        test_template: EvidenceTemplate,
    ):
        """템플릿 상세 조회"""
        response = client.get(
            f"/api/v1/templates/{test_template.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_template.id
        assert data["name"] == "보안점검표 템플릿"

    def test_get_template_not_found(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        """존재하지 않는 템플릿 조회 시 404"""
        response = client.get(
            "/api/v1/templates/99999",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestDownloadTemplate:
    """GET /templates/{id}/download 테스트"""

    @patch("app.api.v1.templates.FileService")
    def test_download_template_success(
        self,
        mock_file_service_class,
        client: TestClient,
        auth_headers: dict,
        test_template: EvidenceTemplate,
        db: Session,
    ):
        """템플릿 다운로드 성공"""
        # Mock FileService
        mock_file_service = MagicMock()
        mock_file_service.download_file.return_value = b"file content"
        mock_file_service_class.return_value = mock_file_service

        initial_count = test_template.download_count

        response = client.get(
            f"/api/v1/templates/{test_template.id}/download",
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.content == b"file content"

        # 다운로드 횟수 증가 확인
        db.refresh(test_template)
        assert test_template.download_count == initial_count + 1

    @patch("app.api.v1.templates.FileService")
    def test_download_template_file_not_found(
        self,
        mock_file_service_class,
        client: TestClient,
        auth_headers: dict,
        test_template: EvidenceTemplate,
    ):
        """파일이 없는 템플릿 다운로드 시 404"""
        mock_file_service = MagicMock()
        mock_file_service.download_file.side_effect = FileNotFoundError("File not found")
        mock_file_service_class.return_value = mock_file_service

        response = client.get(
            f"/api/v1/templates/{test_template.id}/download",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestDeleteTemplate:
    """DELETE /templates/{id} 테스트"""

    @patch("app.api.v1.templates.FileService")
    def test_delete_template_success(
        self,
        mock_file_service_class,
        client: TestClient,
        admin_auth_headers: dict,
        test_template: EvidenceTemplate,
        db: Session,
    ):
        """템플릿 삭제 성공"""
        mock_file_service = MagicMock()
        mock_file_service_class.return_value = mock_file_service

        template_id = test_template.id

        response = client.delete(
            f"/api/v1/templates/{template_id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 204

        # DB에서 삭제 확인
        deleted = db.query(EvidenceTemplate).filter(EvidenceTemplate.id == template_id).first()
        assert deleted is None

    def test_delete_system_template_forbidden(
        self,
        client: TestClient,
        admin_auth_headers: dict,
        system_template: EvidenceTemplate,
    ):
        """시스템 템플릿 삭제 시도 시 403"""
        response = client.delete(
            f"/api/v1/templates/{system_template.id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 403

    def test_delete_template_not_found(
        self,
        client: TestClient,
        admin_auth_headers: dict,
    ):
        """존재하지 않는 템플릿 삭제 시 404"""
        response = client.delete(
            "/api/v1/templates/99999",
            headers=admin_auth_headers,
        )

        assert response.status_code == 404

    def test_delete_template_unauthorized(
        self,
        client: TestClient,
        auth_headers: dict,  # 일반 사용자
        test_template: EvidenceTemplate,
    ):
        """권한 없는 사용자의 삭제 시도"""
        response = client.delete(
            f"/api/v1/templates/{test_template.id}",
            headers=auth_headers,
        )

        assert response.status_code == 403
