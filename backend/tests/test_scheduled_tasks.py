"""
정기 활동 스케줄러 테스트
TDD - RED 단계: 테스트 먼저 작성
"""
import pytest
from datetime import datetime, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.scheduled_task import ScheduledTask, TaskExecution
from app.models.control import ControlDomain, ControlCategory, ControlItem


@pytest.fixture
def test_control_domain(db: Session) -> ControlDomain:
    """테스트용 통제영역 생성"""
    domain = ControlDomain(
        code="1",
        name="관리체계 수립 및 운영",
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
        title="정보보호 정책 수립",
        description="정보보호 정책 수립",
        is_required=True,
        sort_order=1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def test_scheduled_task(db: Session, test_user, test_admin_user, test_control_item: ControlItem) -> ScheduledTask:
    """테스트용 정기 활동 생성"""
    task = ScheduledTask(
        title="월간 보안점검",
        description="매월 보안점검 수행",
        task_type="security_check",
        frequency="monthly",
        assignee_id=test_user.id,
        escalation_to_id=test_admin_user.id,
        control_item_id=test_control_item.id,
        next_execution_at=datetime.utcnow() + timedelta(days=7),
        status="active",
        escalation_days=3,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


class TestGetScheduledTasks:
    """GET /scheduled-tasks 테스트"""

    def test_get_scheduled_tasks_list(
        self,
        client: TestClient,
        auth_headers: dict,
        test_scheduled_task: ScheduledTask,
    ):
        """정기 활동 목록 조회"""
        response = client.get("/api/v1/scheduled-tasks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1

    def test_get_scheduled_tasks_filter_by_status(
        self,
        client: TestClient,
        auth_headers: dict,
        test_scheduled_task: ScheduledTask,
    ):
        """상태별 필터링"""
        response = client.get(
            "/api/v1/scheduled-tasks?status=active",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert all(item["status"] == "active" for item in data["items"])

    def test_get_scheduled_tasks_filter_by_frequency(
        self,
        client: TestClient,
        auth_headers: dict,
        test_scheduled_task: ScheduledTask,
    ):
        """주기별 필터링"""
        response = client.get(
            "/api/v1/scheduled-tasks?frequency=monthly",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert all(item["frequency"] == "monthly" for item in data["items"])


class TestCreateScheduledTask:
    """POST /scheduled-tasks 테스트"""

    def test_create_scheduled_task_success(
        self,
        client: TestClient,
        admin_auth_headers: dict,
        test_user,
        test_admin_user,
        test_control_item: ControlItem,
    ):
        """정기 활동 생성 성공"""
        response = client.post(
            "/api/v1/scheduled-tasks",
            headers=admin_auth_headers,
            json={
                "title": "분기별 백업 테스트",
                "description": "백업 및 복원 테스트",
                "task_type": "backup_test",
                "frequency": "quarterly",
                "assignee_id": test_user.id,
                "escalation_to_id": test_admin_user.id,
                "control_item_id": test_control_item.id,
                "next_execution_at": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "escalation_days": 5,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "분기별 백업 테스트"
        assert data["frequency"] == "quarterly"

    def test_create_scheduled_task_validation_error(
        self,
        client: TestClient,
        admin_auth_headers: dict,
    ):
        """필수 필드 누락 시 오류"""
        response = client.post(
            "/api/v1/scheduled-tasks",
            headers=admin_auth_headers,
            json={
                "title": "테스트",
            },
        )

        assert response.status_code == 422


class TestUpdateScheduledTask:
    """PUT /scheduled-tasks/{id} 테스트"""

    def test_update_scheduled_task_success(
        self,
        client: TestClient,
        admin_auth_headers: dict,
        test_scheduled_task: ScheduledTask,
    ):
        """정기 활동 수정 성공"""
        response = client.put(
            f"/api/v1/scheduled-tasks/{test_scheduled_task.id}",
            headers=admin_auth_headers,
            json={
                "title": "수정된 활동명",
                "description": "수정된 설명",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "수정된 활동명"

    def test_update_scheduled_task_not_found(
        self,
        client: TestClient,
        admin_auth_headers: dict,
    ):
        """존재하지 않는 정기 활동 수정 시 404"""
        response = client.put(
            "/api/v1/scheduled-tasks/99999",
            headers=admin_auth_headers,
            json={"title": "테스트"},
        )

        assert response.status_code == 404


class TestExecuteScheduledTask:
    """POST /scheduled-tasks/{id}/execute 테스트"""

    def test_execute_scheduled_task_success(
        self,
        client: TestClient,
        auth_headers: dict,
        test_scheduled_task: ScheduledTask,
    ):
        """정기 활동 실행 기록 성공"""
        response = client.post(
            f"/api/v1/scheduled-tasks/{test_scheduled_task.id}/execute",
            headers=auth_headers,
            json={
                "status": "completed",
                "result_summary": "점검 완료, 이상 없음",
            },
        )

        assert response.status_code == 200
        data = response.json()
        # task의 status는 active 유지, last_executed_at이 업데이트됨
        assert data["status"] == "active"
        assert data["last_executed_at"] is not None

    def test_execute_scheduled_task_with_evidence(
        self,
        client: TestClient,
        auth_headers: dict,
        test_scheduled_task: ScheduledTask,
        db: Session,
        test_user,
    ):
        """증적 연결하여 실행 기록"""
        # 증적 생성
        from app.models.evidence import Evidence

        evidence = Evidence(
            title="점검 결과",
            file_path="path/result.pdf",
            file_name="result.pdf",
            file_size=1024,
            file_hash="a" * 64,
            version="1.0",
            status="active",
            uploader_id=test_user.id,
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)

        response = client.post(
            f"/api/v1/scheduled-tasks/{test_scheduled_task.id}/execute",
            headers=auth_headers,
            json={
                "status": "completed",
                "result_summary": "점검 완료",
                "evidence_id": evidence.id,
            },
        )

        assert response.status_code == 200


class TestScheduledTaskGetById:
    """GET /scheduled-tasks/{id} 테스트"""

    def test_get_scheduled_task_detail(
        self,
        client: TestClient,
        auth_headers: dict,
        test_scheduled_task: ScheduledTask,
    ):
        """정기 활동 상세 조회"""
        response = client.get(
            f"/api/v1/scheduled-tasks/{test_scheduled_task.id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_scheduled_task.id
        assert data["title"] == "월간 보안점검"

    def test_get_scheduled_task_not_found(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        """존재하지 않는 정기 활동 조회 시 404"""
        response = client.get(
            "/api/v1/scheduled-tasks/99999",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestScheduledTaskExecutionHistory:
    """GET /scheduled-tasks/{id}/executions 테스트"""

    def test_get_execution_history(
        self,
        client: TestClient,
        auth_headers: dict,
        test_scheduled_task: ScheduledTask,
        db: Session,
        test_user,
    ):
        """실행 히스토리 조회"""
        # 실행 기록 생성
        execution = TaskExecution(
            task_id=test_scheduled_task.id,
            executed_by=test_user.id,
            status="completed",
            result_summary="완료",
        )
        db.add(execution)
        db.commit()

        response = client.get(
            f"/api/v1/scheduled-tasks/{test_scheduled_task.id}/executions",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
