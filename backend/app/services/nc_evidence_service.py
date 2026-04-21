"""
부적합(NonConformity) - 증적(Evidence) 매핑 서비스.

AuditService 에 섞지 않고 분리한 이유:
- AuditService 는 이미 부적합/시정조치/이력 등 범위가 넓음
- 매핑은 file_service/evidence_service 의존성과 맞닿으므로 독립 모듈이 읽기 편함
- LLM 어시스턴트에서도 '부적합에 연결된 이미지 증적' 만 조회하는 경로가 필요 → 이 모듈이 single source
"""
from __future__ import annotations

from datetime import datetime
from typing import BinaryIO, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.audit import NonConformity
from app.models.evidence import Evidence
from app.models.nc_evidence import NonConformityEvidence


class NcEvidenceServiceError(Exception):
    """매핑 서비스용 도메인 예외. 라우터가 HTTPException 으로 변환한다."""


class NotFoundError(NcEvidenceServiceError):
    """부적합 또는 증적을 찾지 못함."""


class NcEvidenceService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---- 조회 ----------------------------------------------------------------

    def list_mappings(self, nc_id: int) -> List[NonConformityEvidence]:
        """부적합에 연결된 매핑 레코드를 최신순으로 반환한다."""
        self._require_nc(nc_id)
        return (
            self.db.query(NonConformityEvidence)
            .options(joinedload(NonConformityEvidence.evidence))
            .filter(NonConformityEvidence.non_conformity_id == nc_id)
            .order_by(NonConformityEvidence.created_at.desc())
            .all()
        )

    def list_image_evidences(self, nc_id: int) -> List[Evidence]:
        """
        LLM 어시스턴트 전용 헬퍼. 이미지 MIME 인 증적 Evidence 만 돌려준다.

        정렬: 최근 연결된 매핑 순. 라우터가 아닌 LLM 파이프라인에서만 사용.
        """
        mappings = self.list_mappings(nc_id)
        out: List[Evidence] = []
        for m in mappings:
            ev = m.evidence
            if ev and (ev.mime_type or "").lower().startswith("image/"):
                out.append(ev)
        return out

    def list_mappings_by_ids(
        self, nc_id: int, evidence_ids: List[int]
    ) -> List[NonConformityEvidence]:
        """
        특정 매핑 레코드들을 evidence.id 기준으로 조회한다 (role 조회에 사용).

        LLM 태스크에서 사용자가 지정한 evidence_ids 에 해당하는 매핑의 role 을
        얻기 위함. Evidence 만으로는 role 을 알 수 없으므로 별도 헬퍼로 제공.
        """
        if not evidence_ids:
            return []
        return (
            self.db.query(NonConformityEvidence)
            .options(joinedload(NonConformityEvidence.evidence))
            .filter(
                NonConformityEvidence.non_conformity_id == nc_id,
                NonConformityEvidence.evidence_id.in_(evidence_ids),
            )
            .all()
        )

    # ---- 연결/해제 -----------------------------------------------------------

    def attach_existing(
        self,
        *,
        nc_id: int,
        evidence_ids: List[int],
        user_id: Optional[int],
        mapping_note: Optional[str] = None,
        role: str = "reference",
    ) -> List[NonConformityEvidence]:
        """
        이미 저장된 증적을 부적합에 연결한다.

        - 중복 연결은 무시되고 기존 레코드를 반환한다 (UniqueConstraint 보장).
        - 비어있거나 존재하지 않는 증적 ID 는 NotFoundError 로 거른다.
        - mapping_note 는 '이번에 새로 만든 매핑'에만 적용된다.
          (기존 매핑의 메모를 건드리지 않기 위해.)
        """
        self._require_nc(nc_id)
        evidence_ids = list(dict.fromkeys(evidence_ids))  # 중복 제거, 순서 유지
        if not evidence_ids:
            return []

        existing_ids = {
            eid
            for (eid,) in self.db.query(Evidence.id)
            .filter(Evidence.id.in_(evidence_ids))
            .all()
        }
        missing = [eid for eid in evidence_ids if eid not in existing_ids]
        if missing:
            raise NotFoundError(f"존재하지 않는 증적 ID: {missing}")

        already_linked = {
            eid
            for (eid,) in self.db.query(NonConformityEvidence.evidence_id)
            .filter(
                NonConformityEvidence.non_conformity_id == nc_id,
                NonConformityEvidence.evidence_id.in_(evidence_ids),
            )
            .all()
        }

        created: List[NonConformityEvidence] = []
        for eid in evidence_ids:
            if eid in already_linked:
                continue
            link = NonConformityEvidence(
                non_conformity_id=nc_id,
                evidence_id=eid,
                mapped_by=user_id,
                mapping_note=mapping_note,
                role=role,
            )
            self.db.add(link)
            created.append(link)
        self.db.commit()
        for link in created:
            self.db.refresh(link)
        return created

    def detach(self, *, nc_id: int, evidence_id: int) -> None:
        """증적 연결을 해제한다. 증적 자체는 삭제하지 않는다."""
        self._require_nc(nc_id)
        row = (
            self.db.query(NonConformityEvidence)
            .filter(
                NonConformityEvidence.non_conformity_id == nc_id,
                NonConformityEvidence.evidence_id == evidence_id,
            )
            .first()
        )
        if row is None:
            raise NotFoundError("연결되지 않은 증적입니다.")
        self.db.delete(row)
        self.db.commit()

    def update_note(
        self, *, mapping_id: int, mapping_note: Optional[str]
    ) -> NonConformityEvidence:
        row = (
            self.db.query(NonConformityEvidence)
            .filter(NonConformityEvidence.id == mapping_id)
            .first()
        )
        if row is None:
            raise NotFoundError("매핑을 찾을 수 없습니다.")
        row.mapping_note = mapping_note
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return row

    def update_role(
        self, *, mapping_id: int, role: str
    ) -> NonConformityEvidence:
        row = (
            self.db.query(NonConformityEvidence)
            .filter(NonConformityEvidence.id == mapping_id)
            .first()
        )
        if row is None:
            raise NotFoundError("매핑을 찾을 수 없습니다.")
        row.role = role
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return row

    # ---- 업로드 + 자동 연결 (합성 로직) --------------------------------------

    def upload_and_attach(
        self,
        *,
        nc_id: int,
        file: BinaryIO,
        filename: str,
        content_type: str,
        title: str,
        uploader_id: int,
        mapping_note: Optional[str] = None,
        role: str = "reference",
    ) -> NonConformityEvidence:
        """
        새 증적을 업로드하고 같은 트랜잭션에서 부적합에 연결한다.

        EvidenceService.create_evidence 를 그대로 재사용하여 중복 구현을 피한다.
        """
        self._require_nc(nc_id)

        # 순환 import 회피: 함수 내부에서 지연 import
        from app.services.evidence_service import EvidenceService

        # 결함 증적으로 분류하여 '증적 관리' 목록에 섞이지 않도록 한다.
        evidence = EvidenceService(self.db).create_evidence(
            file=file,
            filename=filename,
            content_type=content_type,
            title=title,
            uploader_id=uploader_id,
            source="nc_finding",
        )
        link = NonConformityEvidence(
            non_conformity_id=nc_id,
            evidence_id=evidence.id,
            mapped_by=uploader_id,
            mapping_note=mapping_note,
            role=role,
        )
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    # ---- 내부 ----------------------------------------------------------------

    def _require_nc(self, nc_id: int) -> NonConformity:
        nc = self.db.query(NonConformity).filter(NonConformity.id == nc_id).first()
        if nc is None:
            raise NotFoundError("부적합을 찾을 수 없습니다.")
        return nc
