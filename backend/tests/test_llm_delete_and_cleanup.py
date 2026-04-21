"""
초안 삭제 엔드포인트와 정기 청소 태스크 테스트.

- DELETE /api/v1/llm/corrective-actions/{id}
  · 소유자 삭제 성공
  · 관리자(superuser) 타인 초안 삭제 성공
  · 비소유자/비관리자 403
  · 존재하지 않는 id 404

- cleanup_old_drafts Celery 태스크
  · 7일 경과 failed → 삭제
  · 1시간 이상 pending/running → failed 로 전이 (timeout)
  · succeeded 는 아무리 오래되어도 건드리지 않음
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.audit import AuditPlan, NonConformity
from app.models.control import ControlCategory, ControlDomain, ControlItem
from app.models.llm_suggestion import LLMSuggestion
from app.models.user import User
from app.services import llm_scheduler
from app.services.llm_scheduler import cleanup_old_drafts


@pytest.fixture
def sweeper_uses_test_db(monkeypatch):
    """
    cleanup_old_drafts 는 app.core.deps.SessionLocal (실 DB) 을 쓰도록 작성되어
    있다. 테스트에서는 in-memory SQLite 를 쓰므로, 태스크 모듈이 바라보는
    SessionLocal 을 conftest 의 TestingSessionLocal 로 리다이렉트한다.
    """
    # 순환 의존을 피하려고 여기서 import.
    from tests import conftest  # noqa: F401  — conftest 로드 보장

    from app.services.llm_scheduler import SessionLocal as _  # noqa: F401
    # llm_scheduler 모듈이 from ... import SessionLocal 로 불러왔기 때문에,
    # 해당 모듈의 이름 공간을 덮어써야 효과가 있다.
    from tests.conftest import TestingSessionLocal

    monkeypatch.setattr(llm_scheduler, "SessionLocal", TestingSessionLocal)
    return TestingSessionLocal


def _admin_headers(client: TestClient) -> dict:
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Admin123!@#"},
    )
    return {"Authorization": f"Bearer {r.json()['data']['accessToken']}"}


def _user_headers(client: TestClient) -> dict:
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "testuser@example.com", "password": "TestPass123!"},
    )
    return {"Authorization": f"Bearer {r.json()['data']['accessToken']}"}


def _seed_nc(db: Session, admin: User) -> NonConformity:
    domain = ControlDomain(code="D1", name="d", description="x", sort_order=1)
    db.add(domain); db.flush()
    cat = ControlCategory(
        domain_id=domain.id, code="C1", name="c", description="x", sort_order=1
    )
    db.add(cat); db.flush()
    item = ControlItem(category_id=cat.id, code="1.1.1", title="t", description="x")
    db.add(item); db.flush()
    plan = AuditPlan(
        title="p",
        audit_type="internal",
        status="in_progress",
        scope="전체",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        lead_auditor_id=admin.id,
    )
    db.add(plan); db.flush()
    nc = NonConformity(
        audit_plan_id=plan.id,
        control_item_id=item.id,
        nc_type="minor",
        severity="medium",
        title="t",
        description="d",
        requirement="r",
        status="open",
        detected_at=date(2026, 4, 20),
        due_date=date(2026, 5, 20),
    )
    db.add(nc); db.commit(); db.refresh(nc)
    return nc


def _mk_suggestion(
    db: Session,
    nc: NonConformity,
    creator: User,
    *,
    status: str,
    task_id: str,
    created_at: datetime | None = None,
) -> LLMSuggestion:
    row = LLMSuggestion(
        non_conformity_id=nc.id,
        task_id=task_id,
        status=status,
        model_name="qwen3.5:2b",
        created_by=creator.id,
    )
    db.add(row); db.commit(); db.refresh(row)
    # created_at 은 Base 의 client-side default(datetime.utcnow) 로 INSERT 시 채워진다.
    # 테스트에서 과거 시각을 원하면 저장 후 별도 UPDATE 로 덮어쓴다.
    if created_at is not None:
        row.created_at = created_at
        db.commit()
        db.refresh(row)
    return row


# -------- DELETE endpoint --------

class TestDeleteSuggestion:
    def test_owner_can_delete_own_suggestion(
        self, client: TestClient, db: Session, test_admin_user: User
    ):
        nc = _seed_nc(db, test_admin_user)
        s = _mk_suggestion(db, nc, test_admin_user, status="failed", task_id="t1")
        r = client.delete(
            f"/api/v1/llm/corrective-actions/{s.id}",
            headers=_admin_headers(client),
        )
        assert r.status_code == 204
        assert db.query(LLMSuggestion).filter(LLMSuggestion.id == s.id).first() is None

    def test_admin_can_delete_any_suggestion(
        self,
        client: TestClient,
        db: Session,
        test_admin_user: User,
        test_user: User,
    ):
        # superuser 가 아닌 일반 사용자의 초안을 관리자(superuser)가 삭제.
        nc = _seed_nc(db, test_admin_user)
        s = _mk_suggestion(db, nc, test_user, status="failed", task_id="t2")
        r = client.delete(
            f"/api/v1/llm/corrective-actions/{s.id}",
            headers=_admin_headers(client),
        )
        assert r.status_code == 204
        assert db.query(LLMSuggestion).filter(LLMSuggestion.id == s.id).first() is None

    def test_user_with_all_permission_can_delete_any_suggestion(
        self,
        client: TestClient,
        db: Session,
        test_admin_user: User,
        test_user: User,
        test_role_ciso,
    ):
        """
        실제 버그 재현 방지: CISO 역할(permissions='all', is_superuser=False)을 가진
        사용자도 타인 초안을 삭제할 수 있어야 한다. 이전 구현은 is_superuser 만
        관리자로 인정해서 403 을 냈다.
        """
        # test_user 에게 CISO 역할을 부여 (is_superuser 는 여전히 False).
        test_user.roles.append(test_role_ciso)
        db.commit()
        assert test_user.is_superuser is False
        assert any(
            (r.permissions or "").strip() == "all" for r in test_user.roles
        )

        nc = _seed_nc(db, test_admin_user)
        s = _mk_suggestion(
            db, nc, test_admin_user, status="failed", task_id="t-ciso"
        )
        r = client.delete(
            f"/api/v1/llm/corrective-actions/{s.id}",
            headers=_user_headers(client),
        )
        assert r.status_code == 204, r.text
        assert (
            db.query(LLMSuggestion).filter(LLMSuggestion.id == s.id).first() is None
        )

    def test_non_owner_non_admin_is_forbidden(
        self,
        client: TestClient,
        db: Session,
        test_admin_user: User,
        test_user: User,
        test_role_security_manager,
    ):
        # 일반 사용자가 관리자의 초안을 삭제 시도 → 403.
        # audit:read 권한이 필요하므로 test_user 에 보안담당자 역할을 부여.
        test_user.roles.append(test_role_security_manager)
        db.commit()
        nc = _seed_nc(db, test_admin_user)
        s = _mk_suggestion(db, nc, test_admin_user, status="failed", task_id="t3")
        r = client.delete(
            f"/api/v1/llm/corrective-actions/{s.id}",
            headers=_user_headers(client),
        )
        assert r.status_code == 403
        # 행은 그대로 남아있어야 한다.
        assert db.query(LLMSuggestion).filter(LLMSuggestion.id == s.id).first() is not None

    def test_delete_unknown_id_returns_404(
        self, client: TestClient, test_admin_user: User
    ):
        r = client.delete(
            "/api/v1/llm/corrective-actions/999999",
            headers=_admin_headers(client),
        )
        assert r.status_code == 404


# -------- cleanup_old_drafts sweeper --------

class TestCleanupOldDrafts:
    def test_deletes_failed_older_than_7_days(
        self, db: Session, test_admin_user: User, sweeper_uses_test_db
    ):
        nc = _seed_nc(db, test_admin_user)
        # 오래된 failed — 삭제 대상
        old_failed = _mk_suggestion(
            db,
            nc,
            test_admin_user,
            status="failed",
            task_id="old-failed",
            created_at=datetime.utcnow() - timedelta(days=8),
        )
        # 최근 failed — 유지
        recent_failed = _mk_suggestion(
            db,
            nc,
            test_admin_user,
            status="failed",
            task_id="recent-failed",
            created_at=datetime.utcnow() - timedelta(days=3),
        )

        # id 값을 미리 캡처 (sweeper 가 old_failed 를 삭제하면 이후 lazy load 시
        # ObjectDeletedError 가 발생한다).
        old_id = old_failed.id
        recent_id = recent_failed.id

        result = cleanup_old_drafts.apply().get()
        assert result["deleted_failed"] == 1
        db.expire_all()
        remaining_ids = {r.id for r in db.query(LLMSuggestion).all()}
        assert old_id not in remaining_ids
        assert recent_id in remaining_ids

    def test_times_out_stuck_pending_and_running(
        self, db: Session, test_admin_user: User, sweeper_uses_test_db
    ):
        nc = _seed_nc(db, test_admin_user)
        # 2시간 전에 시작된 pending — timeout 대상
        stuck_pending = _mk_suggestion(
            db,
            nc,
            test_admin_user,
            status="pending",
            task_id="stuck-pending",
            created_at=datetime.utcnow() - timedelta(hours=2),
        )
        # 2시간 전에 시작된 running — timeout 대상
        stuck_running = _mk_suggestion(
            db,
            nc,
            test_admin_user,
            status="running",
            task_id="stuck-running",
            created_at=datetime.utcnow() - timedelta(hours=2),
        )
        # 5분 전에 시작된 running — 건드리지 않음
        fresh_running = _mk_suggestion(
            db,
            nc,
            test_admin_user,
            status="running",
            task_id="fresh-running",
            created_at=datetime.utcnow() - timedelta(minutes=5),
        )

        result = cleanup_old_drafts.apply().get()
        assert result["timed_out"] == 2

        db.refresh(stuck_pending)
        db.refresh(stuck_running)
        db.refresh(fresh_running)
        assert stuck_pending.status == "failed"
        assert stuck_pending.error_message is not None
        assert "제한 시간" in stuck_pending.error_message
        assert stuck_running.status == "failed"
        assert fresh_running.status == "running"  # 변경되지 않음

    def test_never_touches_succeeded(
        self, db: Session, test_admin_user: User, sweeper_uses_test_db
    ):
        """
        합의된 정책의 핵심: succeeded 는 자동 삭제되지 않는다. 아무리 오래되어도.
        """
        nc = _seed_nc(db, test_admin_user)
        ancient_succeeded = _mk_suggestion(
            db,
            nc,
            test_admin_user,
            status="succeeded",
            task_id="ancient",
            created_at=datetime.utcnow() - timedelta(days=365),
        )
        ancient_succeeded.completed_at = datetime.utcnow() - timedelta(days=365)
        db.commit()

        cleanup_old_drafts.apply().get()

        db.refresh(ancient_succeeded)
        assert ancient_succeeded.status == "succeeded"
        assert (
            db.query(LLMSuggestion)
            .filter(LLMSuggestion.id == ancient_succeeded.id)
            .first()
            is not None
        )

    def test_empty_database_is_a_noop(self, db: Session, sweeper_uses_test_db):
        result = cleanup_old_drafts.apply().get()
        assert result == {
            "deleted_failed": 0,
            "timed_out": 0,
            "cutoff_failed_days": 7,
            "cutoff_stuck_hours": 1,
        }
