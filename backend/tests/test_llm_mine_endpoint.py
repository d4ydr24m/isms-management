"""
'내 초안' 엔드포인트(GET /api/v1/llm/corrective-actions/mine) 단위 테스트.

배지용 경량 응답을 검증:
- 활성(pending/running) 카운트 계산
- NC 제목 동반 반환
- 사용자별 스코프 (다른 사용자의 초안은 보이지 않음)
- 정적 경로 /mine 가 동적 {task_id} 라우트보다 먼저 매칭 (라우트 순서 회귀 방지)
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.audit import AuditPlan, NonConformity
from app.models.control import ControlCategory, ControlDomain, ControlItem
from app.models.llm_suggestion import LLMSuggestion
from app.models.user import User


def _admin_headers(client: TestClient) -> dict:
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Admin123!@#"},
    )
    return {"Authorization": f"Bearer {r.json()['data']['accessToken']}"}


def _seed_nc(db: Session, admin: User, *, title: str = "t") -> NonConformity:
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
        title=title,
        description="d",
        requirement="r",
        status="open",
        detected_at=date(2026, 4, 20),
        due_date=date(2026, 5, 20),
    )
    db.add(nc); db.commit(); db.refresh(nc)
    return nc


def _make_suggestion(
    db: Session,
    nc: NonConformity,
    user: User,
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
        created_by=user.id,
    )
    if created_at is not None:
        row.created_at = created_at
    db.add(row); db.commit(); db.refresh(row)
    return row


def test_mine_returns_empty_when_no_drafts(client: TestClient, test_admin_user: User):
    headers = _admin_headers(client)
    r = client.get("/api/v1/llm/corrective-actions/mine", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["active_count"] == 0
    assert body["items"] == []


def test_mine_counts_only_active_statuses(
    client: TestClient, db: Session, test_admin_user: User
):
    nc = _seed_nc(db, test_admin_user)
    _make_suggestion(db, nc, test_admin_user, status="pending", task_id="t-p")
    _make_suggestion(db, nc, test_admin_user, status="running", task_id="t-r")
    _make_suggestion(db, nc, test_admin_user, status="succeeded", task_id="t-s")
    _make_suggestion(db, nc, test_admin_user, status="failed", task_id="t-f")

    r = client.get(
        "/api/v1/llm/corrective-actions/mine", headers=_admin_headers(client)
    )
    assert r.status_code == 200
    body = r.json()
    # pending + running = 2, succeeded/failed 는 active 에서 제외.
    assert body["active_count"] == 2
    # 모두 최신순으로 반환 (created_at DESC).
    assert len(body["items"]) == 4


def test_mine_includes_nc_title_and_excludes_result_text(
    client: TestClient, db: Session, test_admin_user: User
):
    nc = _seed_nc(db, test_admin_user, title="중복 로그인 제어 미흡")
    s = _make_suggestion(db, nc, test_admin_user, status="succeeded", task_id="t1")
    s.result_text = "# 1. 결함 현상 ..."
    db.commit()

    r = client.get(
        "/api/v1/llm/corrective-actions/mine", headers=_admin_headers(client)
    )
    body = r.json()
    item = body["items"][0]
    assert item["non_conformity_title"] == "중복 로그인 제어 미흡"
    assert item["non_conformity_id"] == nc.id
    # 배지 응답은 경량이어야 하므로 result_text 필드는 스키마에서 아예 빠져 있어야 한다.
    assert "result_text" not in item


def test_mine_is_scoped_to_current_user(
    client: TestClient, db: Session, test_admin_user: User, test_user: User
):
    nc = _seed_nc(db, test_admin_user)
    # 다른 사용자의 초안 — 응답에 절대 등장해선 안 된다.
    _make_suggestion(db, nc, test_user, status="pending", task_id="other-user")
    # 내 초안
    _make_suggestion(db, nc, test_admin_user, status="pending", task_id="mine")

    r = client.get(
        "/api/v1/llm/corrective-actions/mine", headers=_admin_headers(client)
    )
    body = r.json()
    assert body["active_count"] == 1
    assert [i["task_id"] for i in body["items"]] == ["mine"]


def test_mine_route_matches_before_dynamic_task_id_route(
    client: TestClient, test_admin_user: User
):
    """
    정적 /mine 이 동적 /{task_id} 보다 먼저 매칭돼야 한다. 순서가 뒤집히면
    `task_id='mine'` 조회로 떨어져 404 가 난다 — 그걸 감지.
    """
    r = client.get(
        "/api/v1/llm/corrective-actions/mine", headers=_admin_headers(client)
    )
    assert r.status_code == 200, (
        "정적 라우트 /mine 이 동적 /{task_id} 에 가로채였을 가능성. 라우터 등록 순서 확인."
    )
    assert "active_count" in r.json()


def test_mine_respects_limit_parameter(
    client: TestClient, db: Session, test_admin_user: User
):
    nc = _seed_nc(db, test_admin_user)
    for i in range(15):
        _make_suggestion(
            db,
            nc,
            test_admin_user,
            status="succeeded",
            task_id=f"task-{i}",
            created_at=datetime.utcnow() - timedelta(minutes=i),
        )
    r = client.get(
        "/api/v1/llm/corrective-actions/mine?limit=5",
        headers=_admin_headers(client),
    )
    body = r.json()
    assert len(body["items"]) == 5
