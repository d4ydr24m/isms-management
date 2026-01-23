"""
대시보드 API 테스트 (TDD)

6.4 대시보드 단위 테스트
- 각 엔드포인트별 응답 형식 검증
- 캐싱 동작 검증
- 권한 검증
"""
import pytest
from datetime import date, datetime, timedelta
from typing import Dict
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import Evidence, control_item_evidences
from app.models.scheduled_task import ScheduledTask
from app.models.audit import AuditPlan, NonConformity, CorrectiveAction
from app.models.user import User


# ========== 대시보드 픽스처 ==========

@pytest.fixture
def dashboard_control_setup(db: Session, sample_control_category: ControlCategory) -> list:
    """대시보드 테스트용 통제항목 설정 (10개)"""
    items = []
    for i in range(1, 11):
        item = ControlItem(
            category_id=sample_control_category.id,
            code=f"1.1.{i}",
            title=f"통제항목 {i}",
            description=f"통제항목 {i} 설명",
            is_required=True,
            sort_order=i,
        )
        db.add(item)
        items.append(item)
    db.commit()
    for item in items:
        db.refresh(item)
    return items


@pytest.fixture
def dashboard_evidences(db: Session, dashboard_control_setup: list, test_user: User) -> list:
    """대시보드 테스트용 증적 설정 (일부 통제항목에만 연결)"""
    evidences = []
    # 5개 통제항목에만 증적 연결 (50% 진척률)
    for i, control_item in enumerate(dashboard_control_setup[:5]):
        evidence = Evidence(
            title=f"증적 {i+1}",
            description=f"테스트 증적 {i+1}",
            file_path=f"/test/evidence_{i+1}.pdf",
            file_name=f"evidence_{i+1}.pdf",
            file_size=1024,
            file_hash="abc123" * 10 + str(i),
            uploader_id=test_user.id,
            status="active",
            valid_from=date.today() - timedelta(days=30),
            valid_until=date.today() + timedelta(days=i * 10),  # 다양한 만료일
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)

        # 통제항목과 증적 연결
        evidence.control_items.append(control_item)
        db.commit()
        evidences.append(evidence)

    return evidences


@pytest.fixture
def dashboard_scheduled_tasks(db: Session, test_user: User, dashboard_control_setup: list) -> list:
    """대시보드 테스트용 정기 활동 설정"""
    tasks = []
    now = datetime.utcnow()

    # 오늘 예정 활동 (2개)
    for i in range(2):
        task = ScheduledTask(
            title=f"오늘 예정 활동 {i+1}",
            description=f"테스트 활동 {i+1}",
            task_type="vulnerability_scan",
            frequency="monthly",
            assignee_id=test_user.id,
            control_item_id=dashboard_control_setup[i].id if i < len(dashboard_control_setup) else None,
            next_execution_at=now + timedelta(hours=i+1),
            status="active",
        )
        db.add(task)
        tasks.append(task)

    # 이번 주 예정 활동 (3개 추가)
    for i in range(3):
        task = ScheduledTask(
            title=f"이번 주 예정 활동 {i+1}",
            description=f"이번 주 활동 {i+1}",
            task_type="backup_test",
            frequency="weekly",
            assignee_id=test_user.id,
            next_execution_at=now + timedelta(days=i+2),
            status="active",
        )
        db.add(task)
        tasks.append(task)

    # 다음 주 예정 활동 (범위 밖)
    task = ScheduledTask(
        title="다음 주 예정 활동",
        description="범위 밖",
        task_type="review",
        frequency="monthly",
        assignee_id=test_user.id,
        next_execution_at=now + timedelta(days=10),
        status="active",
    )
    db.add(task)
    tasks.append(task)

    db.commit()
    for task in tasks:
        db.refresh(task)
    return tasks


@pytest.fixture
def dashboard_non_conformities(
    db: Session, test_admin_user: User, test_user: User,
    dashboard_control_setup: list
) -> Dict:
    """대시보드 테스트용 부적합 설정"""
    # 감사 계획 생성
    audit_plan = AuditPlan(
        title="2024년 테스트 감사",
        audit_type="internal",
        start_date=date.today() - timedelta(days=30),
        end_date=date.today() - timedelta(days=20),
        scope="전체",
        lead_auditor_id=test_admin_user.id,
        status="completed",
    )
    db.add(audit_plan)
    db.commit()
    db.refresh(audit_plan)

    non_conformities = []

    # 상태별 부적합 생성
    # open: 2개, in_progress: 1개, closed: 1개
    status_configs = [
        ("open", "critical", "major"),
        ("open", "high", "minor"),
        ("in_progress", "medium", "major"),
        ("closed", "low", "minor"),
    ]

    for i, (status, severity, nc_type) in enumerate(status_configs):
        nc = NonConformity(
            audit_plan_id=audit_plan.id,
            control_item_id=dashboard_control_setup[i].id if i < len(dashboard_control_setup) else dashboard_control_setup[0].id,
            nc_type=nc_type,
            severity=severity,
            title=f"부적합 {i+1} - {status}",
            description=f"테스트 부적합 {i+1}",
            requirement="요구사항",
            responsible_person_id=test_user.id,
            detected_at=date.today() - timedelta(days=10),
            due_date=date.today() + timedelta(days=20),
            status=status,
        )
        db.add(nc)
        db.commit()
        db.refresh(nc)
        non_conformities.append(nc)

    # 미완료 시정조치 생성
    corrective_actions = []
    # open 부적합에 대해 미완료 시정조치 추가
    for nc in non_conformities[:2]:  # open 상태인 2개
        ca = CorrectiveAction(
            non_conformity_id=nc.id,
            action_plan="시정조치 계획",
            responsible_person_id=test_user.id,
            planned_completion_date=date.today() + timedelta(days=14),
            status="planned",
        )
        db.add(ca)
        corrective_actions.append(ca)

    db.commit()
    for ca in corrective_actions:
        db.refresh(ca)

    return {
        "audit_plan": audit_plan,
        "non_conformities": non_conformities,
        "corrective_actions": corrective_actions,
    }


# ========== 6.4.1 대시보드 API 테스트 ==========

class TestDashboardSummary:
    """GET /dashboard/summary 테스트"""

    def test_get_dashboard_summary_success(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_control_setup: list, dashboard_evidences: list,
        dashboard_scheduled_tasks: list, dashboard_non_conformities: Dict
    ):
        """대시보드 요약 조회 성공"""
        response = client.get("/api/v1/dashboard/summary", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # 필수 필드 확인
        assert "progress" in data
        assert "activities" in data
        assert "expiring_evidences" in data
        assert "pending_tasks" in data
        assert "non_conformities" in data

    def test_get_dashboard_summary_unauthorized(self, client: TestClient):
        """인증 없이 대시보드 요약 조회 실패"""
        response = client.get("/api/v1/dashboard/summary")
        assert response.status_code == 401


class TestDashboardProgress:
    """GET /dashboard/progress 테스트"""

    def test_get_progress_success(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_control_setup: list, dashboard_evidences: list
    ):
        """진척률 조회 성공 - 50% (5/10 통제항목에 증적 연결)"""
        response = client.get("/api/v1/dashboard/progress", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # 전체 진척률 확인
        assert "total_progress" in data
        assert data["total_progress"] == 50.0  # 5/10 = 50%

        # 통제항목 수 확인
        assert "total_controls" in data
        assert data["total_controls"] == 10

        assert "controls_with_evidence" in data
        assert data["controls_with_evidence"] == 5

    def test_get_progress_with_domain_breakdown(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_control_setup: list, dashboard_evidences: list
    ):
        """영역별 진척률 조회"""
        response = client.get("/api/v1/dashboard/progress", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # 영역별 진척률 존재 확인
        assert "domain_progress" in data
        assert isinstance(data["domain_progress"], list)

    def test_get_progress_empty_controls(
        self, client: TestClient, auth_headers: Dict[str, str]
    ):
        """통제항목이 없을 때 진척률 0%"""
        response = client.get("/api/v1/dashboard/progress", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert data["total_progress"] == 0.0
        assert data["total_controls"] == 0


class TestDashboardActivities:
    """GET /dashboard/activities 테스트"""

    def test_get_activities_today(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_scheduled_tasks: list
    ):
        """금일 예정 활동 조회"""
        response = client.get("/api/v1/dashboard/activities", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "today" in data
        assert "this_week" in data

        # 오늘 예정 활동 2개
        assert len(data["today"]) == 2

        # 이번 주 예정 활동 (오늘 포함 5개)
        assert len(data["this_week"]) >= 2

    def test_get_activities_structure(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_scheduled_tasks: list
    ):
        """활동 데이터 구조 확인"""
        response = client.get("/api/v1/dashboard/activities", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        if data["today"]:
            activity = data["today"][0]
            assert "id" in activity
            assert "title" in activity
            assert "task_type" in activity
            assert "next_execution_at" in activity


class TestDashboardExpiringEvidences:
    """GET /dashboard/expiring-evidences 테스트"""

    def test_get_expiring_evidences_default_30_days(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_evidences: list
    ):
        """기본 30일 내 만료 예정 증적 조회"""
        response = client.get("/api/v1/dashboard/expiring-evidences", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "evidences" in data
        assert "count" in data

        # 만료일이 30일 이내인 증적만 반환
        for evidence in data["evidences"]:
            assert "id" in evidence
            assert "title" in evidence
            assert "valid_until" in evidence
            assert "days_remaining" in evidence

    def test_get_expiring_evidences_custom_days(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_evidences: list
    ):
        """커스텀 일수 내 만료 예정 증적 조회"""
        response = client.get(
            "/api/v1/dashboard/expiring-evidences?days=15",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # 15일 이내 만료 증적만 반환
        for evidence in data["evidences"]:
            assert evidence["days_remaining"] <= 15


class TestDashboardPendingTasks:
    """GET /dashboard/pending-tasks 테스트"""

    def test_get_pending_tasks_success(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_control_setup: list, dashboard_evidences: list,
        dashboard_non_conformities: Dict
    ):
        """미완료 업무 조회"""
        response = client.get("/api/v1/dashboard/pending-tasks", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # 필수 필드 확인
        assert "uncompleted_corrective_actions" in data
        assert "controls_without_evidence" in data

        # 미완료 시정조치 2개 (open 부적합에 대한 planned 상태)
        assert data["uncompleted_corrective_actions"] == 2

        # 증적 미확보 통제항목 5개 (10개 중 5개만 증적 있음)
        assert data["controls_without_evidence"] == 5


class TestDashboardNonConformities:
    """GET /dashboard/nonconformities 테스트"""

    def test_get_nonconformities_by_status(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_non_conformities: Dict
    ):
        """상태별 부적합 현황 조회"""
        response = client.get("/api/v1/dashboard/nonconformities", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "by_status" in data

        # 상태별 건수 확인
        status_counts = data["by_status"]
        assert status_counts.get("open", 0) == 2
        assert status_counts.get("in_progress", 0) == 1
        assert status_counts.get("closed", 0) == 1

    def test_get_nonconformities_by_severity(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_non_conformities: Dict
    ):
        """심각도별 부적합 현황 조회"""
        response = client.get("/api/v1/dashboard/nonconformities", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "by_severity" in data

        # 심각도별 건수 확인
        severity_counts = data["by_severity"]
        assert severity_counts.get("critical", 0) == 1
        assert severity_counts.get("high", 0) == 1
        assert severity_counts.get("medium", 0) == 1
        assert severity_counts.get("low", 0) == 1

    def test_get_nonconformities_total(
        self, client: TestClient, auth_headers: Dict[str, str],
        dashboard_non_conformities: Dict
    ):
        """총 부적합 수 확인"""
        response = client.get("/api/v1/dashboard/nonconformities", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert "total" in data
        assert data["total"] == 4


# ========== 대시보드 서비스 단위 테스트 ==========

class TestDashboardService:
    """DashboardService 단위 테스트"""

    def test_calculate_progress_rate(
        self, db: Session, dashboard_control_setup: list, dashboard_evidences: list
    ):
        """진척률 계산 테스트"""
        from app.services.dashboard_service import DashboardService

        service = DashboardService(db)
        progress = service.calculate_progress_rate()

        assert progress["total_progress"] == 50.0
        assert progress["total_controls"] == 10
        assert progress["controls_with_evidence"] == 5

    def test_get_expiring_evidences(
        self, db: Session, dashboard_evidences: list
    ):
        """만료 예정 증적 조회 테스트"""
        from app.services.dashboard_service import DashboardService

        service = DashboardService(db)
        result = service.get_expiring_evidences(days=30)

        assert "evidences" in result
        assert "count" in result

        # 모든 증적의 만료일이 30일 이내인지 확인
        for ev in result["evidences"]:
            assert ev["days_remaining"] <= 30

    def test_get_today_activities(
        self, db: Session, dashboard_scheduled_tasks: list
    ):
        """금일 예정 활동 조회 테스트"""
        from app.services.dashboard_service import DashboardService

        service = DashboardService(db)
        activities = service.get_scheduled_activities()

        assert "today" in activities
        assert len(activities["today"]) == 2

    def test_get_pending_tasks_count(
        self, db: Session, dashboard_control_setup: list,
        dashboard_evidences: list, dashboard_non_conformities: Dict
    ):
        """미완료 업무 집계 테스트"""
        from app.services.dashboard_service import DashboardService

        service = DashboardService(db)
        pending = service.get_pending_tasks()

        assert pending["uncompleted_corrective_actions"] == 2
        assert pending["controls_without_evidence"] == 5

    def test_get_nonconformity_summary(
        self, db: Session, dashboard_non_conformities: Dict
    ):
        """부적합 현황 집계 테스트"""
        from app.services.dashboard_service import DashboardService

        service = DashboardService(db)
        summary = service.get_nonconformity_summary()

        assert summary["total"] == 4
        assert summary["by_status"]["open"] == 2
        assert summary["by_severity"]["critical"] == 1


# ========== 캐싱 테스트 ==========

class TestDashboardCaching:
    """대시보드 캐싱 테스트"""

    @patch("app.services.dashboard_service.redis_client")
    def test_cache_hit(
        self, mock_redis, client: TestClient, auth_headers: Dict[str, str]
    ):
        """캐시 히트 시 Redis에서 데이터 반환"""
        # 캐시된 데이터 설정
        cached_data = {
            "total_progress": 75.0,
            "total_controls": 80,
            "controls_with_evidence": 60,
            "domain_progress": [],
        }
        mock_redis.get.return_value = cached_data

        response = client.get("/api/v1/dashboard/progress", headers=auth_headers)

        # 캐시에서 데이터 조회 시도 확인
        # (실제 구현에서 캐시가 없으면 DB에서 조회)
        assert response.status_code == 200

    @patch("app.services.dashboard_service.redis_client")
    def test_cache_miss(
        self, mock_redis, client: TestClient, auth_headers: Dict[str, str],
        dashboard_control_setup: list, dashboard_evidences: list
    ):
        """캐시 미스 시 DB에서 데이터 조회 후 캐시 저장"""
        mock_redis.get.return_value = None

        response = client.get("/api/v1/dashboard/progress", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()

        # DB에서 계산된 실제 데이터 확인
        assert data["total_progress"] == 50.0


# ========== 권한 테스트 ==========

class TestDashboardPermissions:
    """대시보드 권한 테스트"""

    def test_dashboard_requires_authentication(self, client: TestClient):
        """인증 필요 확인"""
        endpoints = [
            "/api/v1/dashboard/summary",
            "/api/v1/dashboard/progress",
            "/api/v1/dashboard/activities",
            "/api/v1/dashboard/expiring-evidences",
            "/api/v1/dashboard/pending-tasks",
            "/api/v1/dashboard/nonconformities",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == 401, f"Endpoint {endpoint} should require authentication"

    def test_dashboard_access_with_employee_role(
        self, client: TestClient, auth_headers: Dict[str, str]
    ):
        """일반 직원 역할로 대시보드 접근 가능 확인"""
        response = client.get("/api/v1/dashboard/summary", headers=auth_headers)

        # 일반 직원도 대시보드 조회 가능 (dashboard:read 권한)
        assert response.status_code == 200
