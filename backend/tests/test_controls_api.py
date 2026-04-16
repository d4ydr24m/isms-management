"""
통제항목 API 테스트
TDD - RED 단계: 테스트 먼저 작성
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.control import ControlDomain, ControlCategory, ControlItem


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
        objective="정보보호 목적 명시",
        requirements="정책 요구사항",
        is_required=True,
        is_personal_info=False,
        sort_order=1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def multiple_control_items(db: Session, test_control_category: ControlCategory) -> list:
    """여러 테스트용 통제항목 생성"""
    items = []
    for i in range(1, 6):
        item = ControlItem(
            category_id=test_control_category.id,
            code=f"1.1.{i}",
            title=f"정보보호 정책 {i}",
            description=f"정보보호 정책 설명 {i}",
            is_required=True,
            sort_order=i,
        )
        db.add(item)
        items.append(item)
    db.commit()
    for item in items:
        db.refresh(item)
    return items


class TestGetControls:
    """GET /controls 테스트"""

    def test_get_controls_list(
        self,
        client: TestClient,
        auth_headers: dict,
        test_control_item: ControlItem,
    ):
        """통제항목 목록 조회"""
        response = client.get("/api/v1/controls", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert len(data["items"]) >= 1

    def test_get_controls_pagination(
        self,
        client: TestClient,
        auth_headers: dict,
        multiple_control_items: list,
    ):
        """페이지네이션"""
        response = client.get(
            "/api/v1/controls?page=1&page_size=2",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total"] == 5

    def test_get_controls_filter_by_domain(
        self,
        client: TestClient,
        auth_headers: dict,
        test_control_item: ControlItem,
    ):
        """영역별 필터링"""
        response = client.get(
            "/api/v1/controls?domain_id=1",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

    def test_get_controls_search(
        self,
        client: TestClient,
        auth_headers: dict,
        test_control_item: ControlItem,
    ):
        """검색어로 필터링"""
        response = client.get(
            "/api/v1/controls?search=정보보호",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

    def test_get_controls_unauthenticated(self, client: TestClient):
        """인증 없이 접근 시 401"""
        response = client.get("/api/v1/controls")
        assert response.status_code == 401


class TestGetControlDetail:
    """GET /controls/{id} 테스트"""

    def test_get_control_detail(
        self,
        client: TestClient,
        auth_headers: dict,
        test_control_item: ControlItem,
    ):
        """통제항목 상세 조회"""
        response = client.get(
            f"/api/v1/controls/{test_control_item.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_control_item.id
        assert data["code"] == "1.1.1"
        assert data["title"] == "경영진의 참여"

    def test_get_control_detail_not_found(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        """존재하지 않는 통제항목 조회 시 404"""
        response = client.get(
            "/api/v1/controls/99999",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestGetControlEvidences:
    """GET /controls/{id}/evidences 테스트"""

    def test_get_control_evidences_empty(
        self,
        client: TestClient,
        auth_headers: dict,
        test_control_item: ControlItem,
    ):
        """증적이 없는 통제항목"""
        response = client.get(
            f"/api/v1/controls/{test_control_item.id}/evidences",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["total"] == 0


class TestGetControlDomains:
    """GET /controls/domains 테스트"""

    def test_get_control_domains(
        self,
        client: TestClient,
        auth_headers: dict,
        test_control_domain: ControlDomain,
    ):
        """통제영역 목록 조회"""
        response = client.get(
            "/api/v1/controls/domains",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["code"] == "1"
        assert data[0]["name"] == "관리체계 수립 및 운영"


class TestGetControlProgress:
    """GET /controls/progress 테스트"""

    def test_get_control_progress(
        self,
        client: TestClient,
        auth_headers: dict,
        test_control_item: ControlItem,
    ):
        """증적 확보율 통계 조회"""
        response = client.get(
            "/api/v1/controls/progress",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_controls" in data
        assert "controls_with_evidence" in data
        assert "coverage_rate" in data
        assert "by_domain" in data
        assert data["total_controls"] >= 1
