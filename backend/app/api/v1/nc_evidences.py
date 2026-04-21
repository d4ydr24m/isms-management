"""
결함 증적 관리 API.

'감사 관리 > 결함 증적 관리' 메뉴 전용 엔드포인트. 부적합에 연결된 증적을
전 NC 범위로 한눈에 볼 수 있게 제공한다.

부적합 상세 페이지의 첨부 카드는 여전히 /nonconformities/{nc_id}/evidences 를 사용한다.
본 라우터는 교차 조회(관리자용 리스트) 만 담당한다.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, require_permission
from app.models.audit import NonConformity
from app.models.evidence import Evidence
from app.models.nc_evidence import NonConformityEvidence
from app.models.user import User
from app.schemas.nc_evidence import NcEvidenceItem


router = APIRouter(prefix="/nc-evidences", tags=["결함 증적 관리"])


class NcEvidenceRow(NcEvidenceItem):
    """
    결함 증적 관리 페이지 전용 확장 응답.

    기본 NcEvidenceItem 에 부적합(어느 NC 에 연결돼있는지) 정보를 더한다.
    """

    non_conformity_id: int
    non_conformity_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NcEvidenceListPage(BaseModel):
    items: List[NcEvidenceRow]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=NcEvidenceListPage)
def list_nc_evidences(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    non_conformity_id: Optional[int] = Query(None, description="특정 부적합 필터"),
    search: Optional[str] = Query(None, description="증적 제목/파일명 부분 일치"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    모든 부적합에 걸친 결함 증적 매핑 목록 (페이지네이션).

    필터:
    - non_conformity_id: 특정 NC 에 연결된 매핑만
    - search: 증적 제목 또는 파일명 부분 일치
    """
    query = (
        db.query(NonConformityEvidence)
        .options(
            joinedload(NonConformityEvidence.evidence),
            joinedload(NonConformityEvidence.non_conformity),
        )
    )

    if non_conformity_id is not None:
        query = query.filter(
            NonConformityEvidence.non_conformity_id == non_conformity_id
        )

    if search:
        pattern = f"%{search}%"
        query = query.join(Evidence, NonConformityEvidence.evidence_id == Evidence.id).filter(
            (Evidence.title.ilike(pattern)) | (Evidence.file_name.ilike(pattern))
        )

    total = query.count()
    offset = (page - 1) * page_size
    rows = (
        query.order_by(NonConformityEvidence.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items: List[NcEvidenceRow] = []
    for m in rows:
        ev = m.evidence
        nc = m.non_conformity
        items.append(
            NcEvidenceRow(
                mapping_id=m.id,
                evidence_id=ev.id,
                title=ev.title,
                file_name=ev.file_name,
                file_size=ev.file_size,
                mime_type=ev.mime_type,
                mapping_note=m.mapping_note,
                mapped_by=m.mapped_by,
                mapped_at=m.created_at,
                uploader_name=getattr(ev, "uploader_name", None),
                non_conformity_id=m.non_conformity_id,
                non_conformity_title=nc.title if nc else None,
            )
        )

    total_pages = (total + page_size - 1) // page_size if page_size else 1
    return NcEvidenceListPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
