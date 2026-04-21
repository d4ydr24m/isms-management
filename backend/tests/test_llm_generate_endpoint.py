"""
LLM 초안 생성 API 의 트랜잭션 순서 회귀 테스트.

배경: 이전 구현은 `db.flush()` 만 한 상태에서 Celery task_fn.delay() 를 호출했다.
워커가 별도 세션으로 SELECT 하는 바람에 커밋 전 행을 읽지 못하고 'missing' 으로
조기 종료하는 레이스가 발생했다. 본 테스트는 router 가 반드시 **commit 이후에**
dispatch 하는지를 고정한다.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.audit import AuditPlan, NonConformity
from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import Evidence
from app.models.llm_suggestion import LLMSuggestion
from app.models.nc_evidence import NonConformityEvidence
from app.models.user import User


def _seed_basic(db: Session, admin: User) -> tuple[NonConformity, Evidence]:
    domain = ControlDomain(code="D1", name="d", description="x", sort_order=1)
    db.add(domain)
    db.flush()
    cat = ControlCategory(
        domain_id=domain.id, code="C1", name="c", description="x", sort_order=1
    )
    db.add(cat)
    db.flush()
    item = ControlItem(
        category_id=cat.id, code="1.1.1", title="t", description="x"
    )
    db.add(item)
    db.flush()
    plan = AuditPlan(
        title="p",
        audit_type="internal",
        status="in_progress",
        scope="전체",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        lead_auditor_id=admin.id,
    )
    db.add(plan)
    db.flush()
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
    db.add(nc)
    db.flush()
    ev = Evidence(
        title="shot",
        description=None,
        file_path="evidences/x.png",
        file_name="x.png",
        file_size=1,
        file_hash="a" * 64,
        mime_type="image/png",
        version="1.0",
        status="active",
        uploader_id=admin.id,
        source="nc_finding",
    )
    db.add(ev)
    db.flush()
    link = NonConformityEvidence(
        non_conformity_id=nc.id,
        evidence_id=ev.id,
        mapped_by=admin.id,
        role="before",
    )
    db.add(link)
    db.commit()
    db.refresh(nc)
    db.refresh(ev)
    return nc, ev


def _admin_headers(client: TestClient) -> dict:
    """
    conftest 의 admin_auth_headers 는 과거 응답 형태('access_token' 루트) 를 기준으로
    하여 현재 API({data: {accessToken}})와 호환되지 않는다. 본 테스트에서는 직접
    로그인하여 헤더를 만든다. conftest 픽스처를 건드리면 다른 테스트에 영향이 가므로 분리.
    """
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Admin123!@#"},
    )
    token = r.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_generate_endpoint_commits_row_before_dispatching_task(
    client: TestClient, db: Session, test_admin_user: User
):
    """
    task_fn.delay 가 불릴 때 이미 LLMSuggestion 행이 다른 세션에서 보여야 한다.
    워커의 동시성을 모사하기 위해 모킹 안에서 새 세션으로 SELECT 한다.
    """
    nc, ev = _seed_basic(db, test_admin_user)
    admin_auth_headers = _admin_headers(client)

    seen_from_other_session: dict = {"row": None}

    def fake_delay(suggestion_id: int):
        # 워커처럼 완전히 별도의 세션에서 조회한다. 라우터가 커밋하기 전이라면 None 일 것.
        from app.core.deps import SessionLocal

        sep = SessionLocal()
        try:
            row = (
                sep.query(LLMSuggestion)
                .filter(LLMSuggestion.id == suggestion_id)
                .first()
            )
            seen_from_other_session["row"] = row
        finally:
            sep.close()

        class _Result:
            id = f"fake-task-{suggestion_id}"

        return _Result()

    with patch(
        "app.services.llm_scheduler.generate_corrective_action_draft.delay",
        side_effect=fake_delay,
    ):
        response = client.post(
            "/api/v1/llm/corrective-actions/generate",
            headers=admin_auth_headers,
            json={"non_conformity_id": nc.id, "evidence_ids": [ev.id]},
        )

    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] == "pending"
    assert body["suggestion_id"] > 0

    # 핵심 단언: 워커 측 세션도 그 행을 볼 수 있어야 한다.
    assert seen_from_other_session["row"] is not None, (
        "task_fn.delay 호출 시점에 LLMSuggestion 행이 다른 세션에 커밋되어 있지 않다. "
        "라우터가 dispatch 전에 db.commit() 을 수행했는지 확인할 것."
    )
    assert seen_from_other_session["row"].id == body["suggestion_id"]
