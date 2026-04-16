"""
증적 관리 API 테스트
TDD - RED 단계: 테스트 먼저 작성
"""
import io
import pytest
from datetime import date, timedelta
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import Evidence, EvidenceVersion


@pytest.fixture
def test_control_domain(db: Session) -> ControlDomain:
    """테스트용 통제영역 생성"""
    domain = ControlDomain(
        code="1",
        name="관리체계 수립 및 운영",
        description="관리체계 수립 및 운영 관련 통제영역",
        sort_order=1,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@pytest.fixture
def test_control_category(db: Session, test_control_domain: ControlDomain) -> ControlCategory:
    """테스트용 통제항목 카테고리 생성"""
    category = ControlCategory(
        domain_id=test_control_domain.id,
        code="1.1",
        name="정보보호 정책",
        description="경영진의 참여",
        sort_order=1,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@pytest.fixture
def test_control_item(db: Session, test_control_category: ControlCategory) -> ControlItem:
    """테스트용 통제항목 생성"""
    item = ControlItem(
        category_id=test_control_category.id,
        code="1.1.1",
        title="경영진의 참여",
        description="조직의 정보보호 정책을 수립해야 한다",
        is_required=True,
        sort_order=1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def test_evidence(db: Session, test_user, test_control_item: ControlItem) -> Evidence:
    """테스트용 증적 생성"""
    evidence = Evidence(
        title="보안점검표 2024년 1월",
        description="월간 보안점검 결과",
        file_path="evidences/2024/01/abc123.pdf",
        file_name="보안점검표_2024년1월.pdf",
        file_size=1024,
        file_hash="a" * 64,
        mime_type="application/pdf",
        version="1.0",
        status="active",
        valid_from=date.today(),
        valid_until=date.today() + timedelta(days=365),
        uploader_id=test_user.id,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # 통제항목 연결
    evidence.control_items.append(test_control_item)
    db.commit()
    db.refresh(evidence)

    return evidence


class TestGetEvidences:
    """GET /evidences 테스트"""

    def test_get_evidences_list(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """증적 목록 조회"""
        response = client.get("/api/v1/evidences", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1

    def test_get_evidences_pagination(
        self,
        client: TestClient,
        auth_headers: dict,
        db: Session,
        test_user,
    ):
        """페이지네이션"""
        # 여러 증적 생성
        for i in range(5):
            evidence = Evidence(
                title=f"테스트 증적 {i}",
                file_path=f"path/file{i}.pdf",
                file_name=f"file{i}.pdf",
                file_size=1024,
                file_hash=f"{i}" * 64,
                version="1.0",
                status="active",
                uploader_id=test_user.id,
            )
            db.add(evidence)
        db.commit()

        response = client.get(
            "/api/v1/evidences?page=1&page_size=2",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["total"] == 5

    def test_get_evidences_filter_by_status(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """상태별 필터링"""
        response = client.get(
            "/api/v1/evidences?status=active",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert all(item["status"] == "active" for item in data["items"])

    def test_get_evidences_filter_by_control_id(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
        test_control_item: ControlItem,
    ):
        """통제항목별 필터링"""
        response = client.get(
            f"/api/v1/evidences?control_id={test_control_item.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

    def test_get_evidences_search(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """검색어로 필터링"""
        response = client.get(
            "/api/v1/evidences?search=보안점검표",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1


class TestCreateEvidence:
    """POST /evidences 테스트"""

    @patch("app.services.evidence_service.FileService")
    def test_create_evidence_success(
        self,
        mock_file_service_class,
        client: TestClient,
        auth_headers: dict,
        test_control_item: ControlItem,
    ):
        """증적 생성 성공"""
        # FileService 모킹
        mock_service = MagicMock()
        mock_service.upload_file.return_value = {
            "file_path": "evidences/2024/01/test.pdf",
            "file_hash": "a" * 64,
            "file_size": 1024,
            "mime_type": "application/pdf",
            "original_filename": "test.pdf",
        }
        mock_file_service_class.return_value = mock_service

        # 파일 업로드 요청
        files = {"file": ("test.pdf", io.BytesIO(b"test content"), "application/pdf")}
        data = {
            "title": "새 증적",
            "description": "새 증적 설명",
            "control_ids": str(test_control_item.id),
        }

        response = client.post(
            "/api/v1/evidences",
            headers=auth_headers,
            files=files,
            data=data,
        )

        assert response.status_code == 201
        result = response.json()
        assert result["title"] == "새 증적"
        assert result["version"] == "1.0"

    def test_create_evidence_without_file_fails(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        """파일 없이 증적 생성 시 실패"""
        data = {
            "title": "새 증적",
        }

        response = client.post(
            "/api/v1/evidences",
            headers=auth_headers,
            data=data,
        )

        assert response.status_code == 422  # Validation Error


class TestGetEvidenceDetail:
    """GET /evidences/{id} 테스트"""

    def test_get_evidence_detail(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """증적 상세 조회"""
        response = client.get(
            f"/api/v1/evidences/{test_evidence.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_evidence.id
        assert data["title"] == "보안점검표 2024년 1월"
        assert "control_ids" in data
        assert "control_codes" in data

    def test_get_evidence_detail_not_found(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        """존재하지 않는 증적 조회 시 404"""
        response = client.get(
            "/api/v1/evidences/99999",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestUpdateEvidence:
    """PUT /evidences/{id} 테스트"""

    def test_update_evidence_success(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """증적 수정 성공"""
        response = client.put(
            f"/api/v1/evidences/{test_evidence.id}",
            headers=auth_headers,
            json={
                "title": "수정된 제목",
                "description": "수정된 설명",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "수정된 제목"
        assert data["description"] == "수정된 설명"


class TestDeleteEvidence:
    """DELETE /evidences/{id} 테스트"""

    def test_delete_evidence_success(
        self,
        client: TestClient,
        admin_auth_headers: dict,
        test_evidence: Evidence,
    ):
        """증적 삭제 (soft delete) 성공"""
        response = client.delete(
            f"/api/v1/evidences/{test_evidence.id}",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200

        # 삭제 후 조회 시 archived 상태
        response = client.get(
            f"/api/v1/evidences/{test_evidence.id}",
            headers=admin_auth_headers,
        )
        assert response.json()["status"] == "archived"


class TestEvidenceVersions:
    """증적 버전 관리 테스트"""

    @patch("app.services.evidence_service.FileService")
    def test_create_new_version(
        self,
        mock_file_service_class,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """새 버전 생성"""
        # FileService 모킹
        mock_service = MagicMock()
        mock_service.upload_file.return_value = {
            "file_path": "evidences/2024/01/test_v2.pdf",
            "file_hash": "b" * 64,
            "file_size": 2048,
            "mime_type": "application/pdf",
            "original_filename": "test_v2.pdf",
        }
        mock_file_service_class.return_value = mock_service

        files = {"file": ("test_v2.pdf", io.BytesIO(b"updated content"), "application/pdf")}
        data = {"change_description": "내용 업데이트"}

        response = client.post(
            f"/api/v1/evidences/{test_evidence.id}/versions",
            headers=auth_headers,
            files=files,
            data=data,
        )

        assert response.status_code == 201
        result = response.json()
        # 버전이 증가해야 함
        assert result["version"] != "1.0"

    def test_get_version_history(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """버전 히스토리 조회"""
        response = client.get(
            f"/api/v1/evidences/{test_evidence.id}/versions",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestEvidenceDownloadAndPreview:
    """파일 다운로드 및 미리보기 테스트"""

    @patch("app.api.v1.evidences.FileService")
    def test_download_evidence(
        self,
        mock_file_service_class,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """파일 다운로드"""
        mock_service = MagicMock()
        mock_service.download_file.return_value = b"file content"
        mock_file_service_class.return_value = mock_service

        response = client.get(
            f"/api/v1/evidences/{test_evidence.id}/download",
            headers=auth_headers,
        )

        assert response.status_code == 200
        # Content-Type이 application/pdf 또는 application/octet-stream
        assert "application/pdf" in response.headers["content-type"] or "application/octet-stream" in response.headers["content-type"]

    @patch("app.api.v1.evidences.FileService")
    def test_get_preview_url(
        self,
        mock_file_service_class,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
    ):
        """미리보기 URL 조회"""
        mock_service = MagicMock()
        mock_service.get_presigned_url.return_value = "https://minio:9000/bucket/file.pdf?signature=xxx"
        mock_file_service_class.return_value = mock_service

        response = client.get(
            f"/api/v1/evidences/{test_evidence.id}/preview",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert data["url"].startswith("https://")


class TestEvidenceControlMapping:
    """증적-통제항목 매핑 테스트"""

    def test_add_control_mapping(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
        db: Session,
        test_control_category: ControlCategory,
    ):
        """통제항목 매핑 추가"""
        # 새 통제항목 생성
        new_control = ControlItem(
            category_id=test_control_category.id,
            code="1.1.2",
            title="정보보호 정책 배포",
            description="정책 배포",
            is_required=True,
            sort_order=2,
        )
        db.add(new_control)
        db.commit()
        db.refresh(new_control)

        response = client.post(
            f"/api/v1/evidences/{test_evidence.id}/controls",
            headers=auth_headers,
            json={"control_ids": [new_control.id]},
        )

        assert response.status_code == 200
        data = response.json()
        assert new_control.id in data["control_ids"]

    def test_remove_control_mapping(
        self,
        client: TestClient,
        auth_headers: dict,
        test_evidence: Evidence,
        test_control_item: ControlItem,
    ):
        """통제항목 매핑 해제"""
        response = client.delete(
            f"/api/v1/evidences/{test_evidence.id}/controls/{test_control_item.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200


class TestExpiringEvidences:
    """만료 예정 증적 테스트"""

    def test_get_expiring_evidences(
        self,
        client: TestClient,
        auth_headers: dict,
        db: Session,
        test_user,
    ):
        """만료 예정 증적 조회"""
        # 7일 후 만료 예정 증적 생성
        evidence = Evidence(
            title="곧 만료될 증적",
            file_path="path/expiring.pdf",
            file_name="expiring.pdf",
            file_size=1024,
            file_hash="c" * 64,
            version="1.0",
            status="active",
            valid_until=date.today() + timedelta(days=7),
            uploader_id=test_user.id,
        )
        db.add(evidence)
        db.commit()

        response = client.get(
            "/api/v1/evidences/expiring?days=30",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1
