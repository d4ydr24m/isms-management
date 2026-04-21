"""
NcEvidenceService 단위 테스트.

실제 DB는 conftest의 SQLite 인메모리를 쓰되, MinIO는 건드리지 않는다
(파일 I/O가 없는 attach/detach/list/update 경로만 검증).
upload_and_attach 테스트는 EvidenceService.create_evidence 가 MinIO 를
호출하므로 monkeypatch 로 file_service 를 가짜 구현으로 대체한다.
"""
from __future__ import annotations

from datetime import date
from io import BytesIO

import pytest
from sqlalchemy.orm import Session

from app.models.audit import AuditPlan, NonConformity
from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import Evidence
from app.models.nc_evidence import NonConformityEvidence
from app.models.user import User
from app.services.nc_evidence_service import (
    NcEvidenceService,
    NotFoundError,
)


# ---- 공통 픽스처 ----------------------------------------------------------

def _make_control_item(db: Session) -> ControlItem:
    domain = ControlDomain(code="D1", name="테스트도메인", description="x", sort_order=1)
    db.add(domain); db.flush()
    category = ControlCategory(
        domain_id=domain.id, code="C1", name="카테고리", description="x", sort_order=1
    )
    db.add(category); db.flush()
    item = ControlItem(
        category_id=category.id,
        code="1.1.1",
        title="테스트통제항목",
        description="x",
    )
    db.add(item); db.flush()
    return item


@pytest.fixture
def nc(db: Session, test_admin_user: User) -> NonConformity:
    ci = _make_control_item(db)
    plan = AuditPlan(
        title="테스트계획",
        audit_type="internal",
        status="in_progress",
        scope="전체",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        lead_auditor_id=test_admin_user.id,
    )
    db.add(plan); db.flush()
    row = NonConformity(
        audit_plan_id=plan.id,
        control_item_id=ci.id,
        nc_type="minor",
        severity="medium",
        title="테스트 부적합",
        description="설명",
        requirement="요구",
        status="open",
        detected_at=date(2026, 4, 20),
        due_date=date(2026, 5, 20),
    )
    db.add(row); db.commit(); db.refresh(row)
    return row


def _make_evidence(
    db: Session, test_admin_user: User, *, title: str = "e", mime: str = "image/png"
) -> Evidence:
    ev = Evidence(
        title=title,
        description=None,
        file_path=f"evidences/{title}.png",
        file_name=f"{title}.png",
        file_size=100,
        file_hash="a" * 64,
        mime_type=mime,
        version="1.0",
        status="active",
        uploader_id=test_admin_user.id,
    )
    db.add(ev); db.commit(); db.refresh(ev)
    return ev


# ---- 테스트 ---------------------------------------------------------------

class TestAttachExisting:
    def test_attaches_evidence_ids(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        e2 = _make_evidence(db, test_admin_user, title="b")
        service = NcEvidenceService(db)

        created = service.attach_existing(
            nc_id=nc.id,
            evidence_ids=[e1.id, e2.id],
            user_id=test_admin_user.id,
            mapping_note="테스트 메모",
        )
        assert len(created) == 2
        assert {c.evidence_id for c in created} == {e1.id, e2.id}
        assert all(c.mapping_note == "테스트 메모" for c in created)

    def test_deduplicates_duplicate_ids_in_same_request(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        created = service.attach_existing(
            nc_id=nc.id, evidence_ids=[e1.id, e1.id, e1.id], user_id=test_admin_user.id
        )
        assert len(created) == 1

    def test_skips_already_linked(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        service.attach_existing(
            nc_id=nc.id, evidence_ids=[e1.id], user_id=test_admin_user.id
        )
        # 두 번째 호출 — 이미 연결됨
        created = service.attach_existing(
            nc_id=nc.id, evidence_ids=[e1.id], user_id=test_admin_user.id
        )
        assert created == []
        # 하지만 총 매핑 수는 1 이어야 한다.
        assert len(service.list_mappings(nc.id)) == 1

    def test_raises_when_nc_not_found(self, db, test_admin_user):
        service = NcEvidenceService(db)
        with pytest.raises(NotFoundError):
            service.attach_existing(
                nc_id=999999, evidence_ids=[1], user_id=test_admin_user.id
            )

    def test_raises_when_evidence_id_does_not_exist(self, db, nc, test_admin_user):
        service = NcEvidenceService(db)
        with pytest.raises(NotFoundError):
            service.attach_existing(
                nc_id=nc.id, evidence_ids=[888888], user_id=test_admin_user.id
            )

    def test_empty_evidence_list_is_noop(self, db, nc, test_admin_user):
        service = NcEvidenceService(db)
        created = service.attach_existing(
            nc_id=nc.id, evidence_ids=[], user_id=test_admin_user.id
        )
        assert created == []


class TestDetach:
    def test_detach_removes_mapping(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        service.attach_existing(
            nc_id=nc.id, evidence_ids=[e1.id], user_id=test_admin_user.id
        )
        service.detach(nc_id=nc.id, evidence_id=e1.id)
        assert service.list_mappings(nc.id) == []
        # 증적 자체는 유지되어야 한다 (detach 는 링크만 제거).
        assert db.query(Evidence).filter(Evidence.id == e1.id).first() is not None

    def test_detach_unknown_link_raises(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        with pytest.raises(NotFoundError):
            service.detach(nc_id=nc.id, evidence_id=e1.id)


class TestListImageEvidences:
    def test_filters_non_image_mime(self, db, nc, test_admin_user):
        img = _make_evidence(db, test_admin_user, title="a", mime="image/png")
        pdf = _make_evidence(db, test_admin_user, title="b", mime="application/pdf")
        service = NcEvidenceService(db)
        service.attach_existing(
            nc_id=nc.id, evidence_ids=[img.id, pdf.id], user_id=test_admin_user.id
        )
        only_images = service.list_image_evidences(nc.id)
        assert [e.id for e in only_images] == [img.id]


class TestUpdateNote:
    def test_update_note_changes_text(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        [link] = service.attach_existing(
            nc_id=nc.id,
            evidence_ids=[e1.id],
            user_id=test_admin_user.id,
            mapping_note="원본",
        )
        updated = service.update_note(mapping_id=link.id, mapping_note="수정됨")
        assert updated.mapping_note == "수정됨"

    def test_update_note_with_none_clears(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        [link] = service.attach_existing(
            nc_id=nc.id,
            evidence_ids=[e1.id],
            user_id=test_admin_user.id,
            mapping_note="원본",
        )
        updated = service.update_note(mapping_id=link.id, mapping_note=None)
        assert updated.mapping_note is None

    def test_update_note_raises_when_not_found(self, db):
        service = NcEvidenceService(db)
        with pytest.raises(NotFoundError):
            service.update_note(mapping_id=999999, mapping_note="x")


class TestSourceSeparation:
    """결함 증적과 일반 증적의 source 분리가 제대로 동작하는지 확인."""

    def test_existing_evidence_defaults_to_library(self, db, test_admin_user):
        """서버 default='library' 가 적용되어 기존 경로로 만든 증적은 library 로 표시."""
        ev = _make_evidence(db, test_admin_user, title="lib")
        assert ev.source == "library"

    def test_evidence_search_filters_by_source(self, db, test_admin_user):
        """search_evidences 가 기본적으로 library 만 반환한다."""
        from app.services.evidence_service import EvidenceService

        # 의도적으로 nc_finding 출처로 만든 증적
        nc_ev = Evidence(
            title="nc finding",
            description=None,
            file_path="evidences/x.png",
            file_name="x.png",
            file_size=1,
            file_hash="b" * 64,
            mime_type="image/png",
            version="1.0",
            status="active",
            uploader_id=test_admin_user.id,
            source="nc_finding",
        )
        lib_ev = Evidence(
            title="library doc",
            description=None,
            file_path="evidences/y.pdf",
            file_name="y.pdf",
            file_size=1,
            file_hash="c" * 64,
            mime_type="application/pdf",
            version="1.0",
            status="active",
            uploader_id=test_admin_user.id,
            source="library",
        )
        db.add_all([nc_ev, lib_ev])
        db.commit()

        service = EvidenceService(db)
        # 기본(library) — nc_finding 은 숨겨져야 한다.
        default = service.search_evidences()
        default_titles = {e.title for e in default["items"]}
        assert "library doc" in default_titles
        assert "nc finding" not in default_titles

        # 명시적 nc_finding 필터
        only_nc = service.search_evidences(source="nc_finding")
        only_nc_titles = {e.title for e in only_nc["items"]}
        assert only_nc_titles == {"nc finding"}

        # 전체 (source=None)
        all_ev = service.search_evidences(source=None)
        all_titles = {e.title for e in all_ev["items"]}
        assert {"library doc", "nc finding"}.issubset(all_titles)


class TestEvidenceRole:
    def test_default_role_is_reference(self, db, nc, test_admin_user):
        e = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        [link] = service.attach_existing(
            nc_id=nc.id, evidence_ids=[e.id], user_id=test_admin_user.id
        )
        assert link.role == "reference"

    def test_attach_with_explicit_role(self, db, nc, test_admin_user):
        e = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        [link] = service.attach_existing(
            nc_id=nc.id,
            evidence_ids=[e.id],
            user_id=test_admin_user.id,
            role="before",
        )
        assert link.role == "before"

    def test_update_role_changes_value(self, db, nc, test_admin_user):
        e = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        [link] = service.attach_existing(
            nc_id=nc.id, evidence_ids=[e.id], user_id=test_admin_user.id, role="before"
        )
        updated = service.update_role(mapping_id=link.id, role="after")
        assert updated.role == "after"

    def test_update_role_raises_when_not_found(self, db):
        service = NcEvidenceService(db)
        with pytest.raises(NotFoundError):
            service.update_role(mapping_id=999999, role="before")

    def test_list_mappings_by_ids_returns_role(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        e2 = _make_evidence(db, test_admin_user, title="b")
        service = NcEvidenceService(db)
        service.attach_existing(
            nc_id=nc.id, evidence_ids=[e1.id], user_id=test_admin_user.id, role="before"
        )
        service.attach_existing(
            nc_id=nc.id, evidence_ids=[e2.id], user_id=test_admin_user.id, role="after"
        )
        rows = service.list_mappings_by_ids(nc.id, [e1.id, e2.id])
        role_by_eid = {r.evidence_id: r.role for r in rows}
        assert role_by_eid == {e1.id: "before", e2.id: "after"}


class TestCascadeDelete:
    def test_deleting_nc_removes_its_mappings(self, db, nc, test_admin_user):
        e1 = _make_evidence(db, test_admin_user, title="a")
        service = NcEvidenceService(db)
        service.attach_existing(
            nc_id=nc.id, evidence_ids=[e1.id], user_id=test_admin_user.id
        )
        db.delete(nc)
        db.commit()
        remaining = db.query(NonConformityEvidence).all()
        assert remaining == []
        # 증적은 살아 있어야 한다.
        assert db.query(Evidence).filter(Evidence.id == e1.id).first() is not None
