"""
증적 관련 Pydantic 스키마 테스트
TDD - RED 단계: 테스트 먼저 작성
"""
import pytest
from datetime import date, datetime
from pydantic import ValidationError

from app.schemas.control import (
    ControlDomainResponse,
    ControlCategoryResponse,
    ControlItemResponse,
    ControlItemList,
    ControlProgressResponse,
)
from app.schemas.evidence import (
    EvidenceCreate,
    EvidenceUpdate,
    EvidenceResponse,
    EvidenceList,
    EvidenceVersionResponse,
    EvidenceTemplateResponse,
    EvidenceMappingRequest,
)


class TestControlSchemas:
    """통제항목 스키마 테스트"""

    def test_control_domain_response(self):
        """ControlDomainResponse 스키마 검증"""
        data = {
            "id": 1,
            "code": "1",
            "name": "관리체계 수립 및 운영",
            "description": "관리체계 수립 및 운영 관련 통제영역",
            "sort_order": 1,
            "categories": [],
        }
        schema = ControlDomainResponse(**data)
        assert schema.id == 1
        assert schema.code == "1"
        assert schema.name == "관리체계 수립 및 운영"

    def test_control_category_response(self):
        """ControlCategoryResponse 스키마 검증"""
        data = {
            "id": 1,
            "domain_id": 1,
            "code": "1.1",
            "name": "정보보호 정책",
            "description": "경영진의 참여",
            "sort_order": 1,
            "control_items": [],
        }
        schema = ControlCategoryResponse(**data)
        assert schema.id == 1
        assert schema.code == "1.1"

    def test_control_item_response(self):
        """ControlItemResponse 스키마 검증"""
        data = {
            "id": 1,
            "category_id": 1,
            "code": "1.1.1",
            "title": "경영진의 참여",
            "description": "정보보호 정책을 수립해야 한다",
            "objective": "정보보호 목적",
            "requirements": "요구사항 내용",
            "is_required": True,
            "is_personal_info": False,
            "sort_order": 1,
            "tags": "정책,관리",
            "evidence_count": 5,
        }
        schema = ControlItemResponse(**data)
        assert schema.id == 1
        assert schema.code == "1.1.1"
        assert schema.title == "경영진의 참여"
        assert schema.evidence_count == 5

    def test_control_item_list(self):
        """ControlItemList 페이지네이션 스키마 검증"""
        data = {
            "items": [
                {
                    "id": 1,
                    "category_id": 1,
                    "code": "1.1.1",
                    "title": "경영진의 참여",
                    "description": "정보보호 정책을 수립해야 한다",
                    "is_required": True,
                    "is_personal_info": False,
                    "sort_order": 1,
                    "evidence_count": 5,
                }
            ],
            "total": 80,
            "page": 1,
            "page_size": 20,
            "total_pages": 4,
        }
        schema = ControlItemList(**data)
        assert schema.total == 80
        assert len(schema.items) == 1

    def test_control_progress_response(self):
        """ControlProgressResponse 스키마 검증"""
        data = {
            "total_controls": 80,
            "controls_with_evidence": 45,
            "coverage_rate": 56.25,
            "by_domain": [
                {
                    "domain_id": 1,
                    "domain_name": "관리체계 수립 및 운영",
                    "total": 16,
                    "with_evidence": 10,
                    "coverage_rate": 62.5,
                }
            ],
        }
        schema = ControlProgressResponse(**data)
        assert schema.total_controls == 80
        assert schema.coverage_rate == 56.25


class TestEvidenceCreateSchema:
    """EvidenceCreate 스키마 테스트"""

    def test_evidence_create_valid(self):
        """유효한 증적 생성 데이터"""
        data = {
            "title": "보안점검표 2024년 1월",
            "description": "월간 보안점검 결과",
            "evidence_type": "점검표",
            "valid_from": "2024-01-01",
            "valid_until": "2024-12-31",
            "control_ids": [1, 2, 3],
        }
        schema = EvidenceCreate(**data)
        assert schema.title == "보안점검표 2024년 1월"
        assert schema.control_ids == [1, 2, 3]

    def test_evidence_create_minimal(self):
        """최소 필수 필드만으로 생성"""
        data = {
            "title": "증적 제목",
        }
        schema = EvidenceCreate(**data)
        assert schema.title == "증적 제목"
        assert schema.description is None
        assert schema.control_ids == []

    def test_evidence_create_title_required(self):
        """title 필수 검증"""
        with pytest.raises(ValidationError):
            EvidenceCreate()

    def test_evidence_create_title_max_length(self):
        """title 최대 길이 검증 (255자)"""
        with pytest.raises(ValidationError):
            EvidenceCreate(title="a" * 256)


class TestEvidenceUpdateSchema:
    """EvidenceUpdate 스키마 테스트"""

    def test_evidence_update_partial(self):
        """부분 업데이트"""
        data = {"title": "수정된 제목"}
        schema = EvidenceUpdate(**data)
        assert schema.title == "수정된 제목"
        assert schema.description is None

    def test_evidence_update_valid_dates(self):
        """유효기간 수정"""
        data = {
            "valid_from": "2024-01-01",
            "valid_until": "2024-12-31",
        }
        schema = EvidenceUpdate(**data)
        assert schema.valid_from == date(2024, 1, 1)
        assert schema.valid_until == date(2024, 12, 31)


class TestEvidenceResponseSchema:
    """EvidenceResponse 스키마 테스트"""

    def test_evidence_response_full(self):
        """전체 필드 포함 응답"""
        data = {
            "id": 1,
            "title": "보안점검표",
            "description": "설명",
            "file_path": "evidences/2024/01/abc123.pdf",
            "file_name": "보안점검표.pdf",
            "file_hash": "a" * 64,
            "file_size": 1024,
            "mime_type": "application/pdf",
            "version": "1.0",
            "status": "active",
            "valid_from": "2024-01-01",
            "valid_until": "2024-12-31",
            "uploader_id": 1,
            "uploader_name": "홍길동",
            "author": "작성자",
            "reviewed_by": None,
            "reviewed_at": None,
            "review_comment": None,
            "control_ids": [1, 2, 3],
            "control_codes": ["1.1.1", "1.1.2", "1.1.3"],
            "created_at": "2024-01-15T10:00:00",
            "updated_at": "2024-01-15T10:00:00",
        }
        schema = EvidenceResponse(**data)
        assert schema.id == 1
        assert schema.title == "보안점검표"
        assert schema.version == "1.0"
        assert schema.status == "active"
        assert schema.control_ids == [1, 2, 3]


class TestEvidenceListSchema:
    """EvidenceList 페이지네이션 스키마 테스트"""

    def test_evidence_list(self):
        """증적 목록 페이지네이션"""
        data = {
            "items": [
                {
                    "id": 1,
                    "title": "증적1",
                    "file_path": "path/file.pdf",
                    "file_name": "file.pdf",
                    "file_hash": "a" * 64,
                    "file_size": 1024,
                    "version": "1.0",
                    "status": "active",
                    "uploader_id": 1,
                    "uploader_name": "홍길동",
                    "control_ids": [],
                    "control_codes": [],
                    "created_at": "2024-01-15T10:00:00",
                    "updated_at": "2024-01-15T10:00:00",
                }
            ],
            "total": 100,
            "page": 1,
            "page_size": 20,
            "total_pages": 5,
        }
        schema = EvidenceList(**data)
        assert schema.total == 100
        assert schema.page == 1
        assert len(schema.items) == 1


class TestEvidenceVersionResponseSchema:
    """EvidenceVersionResponse 스키마 테스트"""

    def test_evidence_version_response(self):
        """버전 히스토리 응답"""
        data = {
            "id": 1,
            "evidence_id": 10,
            "version": "1.1",
            "file_path": "path/file_v1.1.pdf",
            "file_name": "file.pdf",
            "file_size": 2048,
            "file_hash": "b" * 64,
            "uploaded_by": 1,
            "uploader_name": "홍길동",
            "change_description": "내용 수정",
            "created_at": "2024-01-20T10:00:00",
        }
        schema = EvidenceVersionResponse(**data)
        assert schema.version == "1.1"
        assert schema.change_description == "내용 수정"


class TestEvidenceTemplateResponseSchema:
    """EvidenceTemplateResponse 스키마 테스트"""

    def test_evidence_template_response(self):
        """템플릿 응답"""
        data = {
            "id": 1,
            "name": "보안점검표 양식",
            "description": "월간 보안점검 양식",
            "category": "점검표",
            "file_path": "templates/security_checklist.xlsx",
            "file_name": "security_checklist.xlsx",
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "is_system_template": True,
            "created_by": None,
            "download_count": 50,
            "created_at": "2024-01-01T00:00:00",
        }
        schema = EvidenceTemplateResponse(**data)
        assert schema.name == "보안점검표 양식"
        assert schema.category == "점검표"
        assert schema.is_system_template is True


class TestEvidenceMappingRequestSchema:
    """EvidenceMappingRequest 스키마 테스트"""

    def test_evidence_mapping_request_valid(self):
        """유효한 매핑 요청"""
        data = {"control_ids": [1, 2, 3, 4, 5]}
        schema = EvidenceMappingRequest(**data)
        assert schema.control_ids == [1, 2, 3, 4, 5]

    def test_evidence_mapping_request_empty(self):
        """빈 매핑 요청 (매핑 해제용)"""
        data = {"control_ids": []}
        schema = EvidenceMappingRequest(**data)
        assert schema.control_ids == []

    def test_evidence_mapping_request_required(self):
        """control_ids 필수"""
        with pytest.raises(ValidationError):
            EvidenceMappingRequest()
