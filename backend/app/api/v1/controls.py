"""
통제항목 API
ISMS-P 80개 통제항목 관리
"""
import re
from typing import List, Optional


def _clean_text(val: Optional[str]) -> Optional[str]:
    """Remove surrogate characters and special symbols from text"""
    if not val:
        return val
    # Remove surrogate characters
    val = val.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
    # Remove box/bullet unicode chars
    val = re.sub(r'[\u25a0-\u25ff\u2600-\u26ff\u2700-\u27bf\uf000-\uffff]', '', val)
    return val.strip() or None

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, get_current_active_user
from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import control_item_evidences
from app.models.user import User
from app.api.v1.system_settings import get_certification_type
from app.schemas.control import (
    ControlDomainResponse,
    ControlCategoryResponse,
    ControlItemResponse,
    ControlItemList,
    ControlProgressResponse,
    DomainProgress,
)
from app.schemas.evidence import EvidenceList, EvidenceSimpleResponse

router = APIRouter()


@router.get("/domains", response_model=List[ControlDomainResponse])
def get_control_domains(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    통제영역 목록 조회

    ISMS-P 통제영역 목록을 반환합니다.
    """
    cert_type = get_certification_type(db)
    is_isms_only = cert_type == "ISMS"

    domains = (
        db.query(ControlDomain)
        .options(
            joinedload(ControlDomain.categories)
            .joinedload(ControlCategory.control_items)
        )
        .order_by(ControlDomain.sort_order)
        .all()
    )

    result = []
    for domain in domains:
        categories = []
        for cat in domain.categories:
            items = [
                {
                    "id": item.id,
                    "code": item.code,
                    "title": item.title,
                    "is_required": item.is_required,
                }
                for item in cat.control_items
                if not (is_isms_only and item.is_personal_info)
            ]
            # ISMS 모드에서 개인정보 항목만 있는 카테고리는 제외
            if items or not is_isms_only:
                categories.append({
                    "id": cat.id,
                    "domain_id": cat.domain_id,
                    "code": cat.code,
                    "name": cat.name,
                    "description": cat.description,
                    "sort_order": cat.sort_order,
                    "control_items": items,
                })

        # ISMS 모드에서 카테고리가 없는 영역은 제외
        if categories or not is_isms_only:
            result.append({
                "id": domain.id,
                "code": domain.code,
                "name": domain.name,
                "description": domain.description,
                "sort_order": domain.sort_order,
                "categories": categories,
            })

    return result


@router.get("/progress", response_model=ControlProgressResponse)
def get_control_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    증적 확보율 통계 조회

    전체 및 영역별 증적 확보율을 반환합니다.
    인증 유형(ISMS/ISMS-P)에 따라 통제항목을 필터링합니다.
    """
    cert_type = get_certification_type(db)

    # 인증 유형에 따른 기본 필터
    base_query = db.query(ControlItem)
    if cert_type == "ISMS":
        base_query = base_query.filter(ControlItem.is_personal_info == False)

    # 전체 통제항목 수
    total_controls = base_query.count()

    # 증적이 있는 통제항목 수
    evidence_query = (
        db.query(func.count(func.distinct(control_item_evidences.c.control_item_id)))
        .join(ControlItem, ControlItem.id == control_item_evidences.c.control_item_id)
    )
    if cert_type == "ISMS":
        evidence_query = evidence_query.filter(ControlItem.is_personal_info == False)
    controls_with_evidence = evidence_query.scalar() or 0

    # 전체 커버리지
    coverage_rate = (
        (controls_with_evidence / total_controls * 100) if total_controls > 0 else 0
    )

    # 영역별 진행률
    by_domain = []
    domains = db.query(ControlDomain).order_by(ControlDomain.sort_order).all()

    for domain in domains:
        # ISMS 모드에서 개인정보 영역(C) 제외
        if cert_type == "ISMS" and domain.code == "C":
            continue

        # 해당 영역의 통제항목 수
        domain_q = (
            db.query(func.count(ControlItem.id))
            .join(ControlCategory)
            .filter(ControlCategory.domain_id == domain.id)
        )
        if cert_type == "ISMS":
            domain_q = domain_q.filter(ControlItem.is_personal_info == False)
        domain_controls = domain_q.scalar() or 0

        # 해당 영역에서 증적이 있는 통제항목 수
        domain_ev_q = (
            db.query(func.count(func.distinct(control_item_evidences.c.control_item_id)))
            .join(ControlItem, ControlItem.id == control_item_evidences.c.control_item_id)
            .join(ControlCategory)
            .filter(ControlCategory.domain_id == domain.id)
        )
        if cert_type == "ISMS":
            domain_ev_q = domain_ev_q.filter(ControlItem.is_personal_info == False)
        domain_with_evidence = domain_ev_q.scalar() or 0

        domain_coverage = (
            (domain_with_evidence / domain_controls * 100) if domain_controls > 0 else 0
        )

        by_domain.append(
            DomainProgress(
                domain_id=domain.id,
                domain_name=domain.name,
                total=domain_controls,
                with_evidence=domain_with_evidence,
                coverage_rate=round(domain_coverage, 2),
            )
        )

    return ControlProgressResponse(
        total_controls=total_controls,
        controls_with_evidence=controls_with_evidence,
        coverage_rate=round(coverage_rate, 2),
        by_domain=by_domain,
    )


@router.get("", response_model=ControlItemList)
def get_controls(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=200, description="페이지 크기"),
    domain_id: Optional[int] = Query(None, description="통제영역 ID"),
    category_id: Optional[int] = Query(None, description="통제항목 카테고리 ID"),
    search: Optional[str] = Query(None, description="검색어 (제목, 설명)"),
    is_required: Optional[bool] = Query(None, description="필수 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    통제항목 목록 조회

    페이지네이션 및 필터링 지원
    """
    query = db.query(ControlItem).join(ControlCategory)

    # ISMS 모드일 경우 개인정보 항목 제외
    cert_type = get_certification_type(db)
    if cert_type == "ISMS":
        query = query.filter(ControlItem.is_personal_info == False)

    # 영역 필터
    if domain_id:
        query = query.filter(ControlCategory.domain_id == domain_id)

    # 카테고리 필터
    if category_id:
        query = query.filter(ControlItem.category_id == category_id)

    # 필수 여부 필터
    if is_required is not None:
        query = query.filter(ControlItem.is_required == is_required)

    # 검색어 필터
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                ControlItem.title.ilike(search_term),
                ControlItem.description.ilike(search_term),
                ControlItem.code.ilike(search_term),
            )
        )

    # 전체 개수
    total = query.count()

    # 페이지네이션
    offset = (page - 1) * page_size
    items = (
        query
        .order_by(ControlItem.sort_order, ControlItem.code)
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # 각 통제항목의 증적 수 계산
    result_items = []
    for item in items:
        evidence_count = (
            db.query(func.count(control_item_evidences.c.evidence_id))
            .filter(control_item_evidences.c.control_item_id == item.id)
            .scalar() or 0
        )

        result_items.append(
            ControlItemResponse(
                id=item.id,
                category_id=item.category_id,
                code=item.code,
                title=item.title,
                description=item.description,
                objective=item.objective,
                requirements=item.requirements,
                is_required=item.is_required,
                is_personal_info=item.is_personal_info,
                key_checks=_clean_text(item.key_checks),
                related_laws=_clean_text(item.related_laws),
                evidence_examples=_clean_text(item.evidence_examples),
                sort_order=item.sort_order,
                tags=item.tags,
                evidence_count=evidence_count,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return ControlItemList(
        items=result_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{control_id}", response_model=ControlItemResponse)
def get_control(
    control_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    통제항목 상세 조회
    """
    item = db.query(ControlItem).filter(ControlItem.id == control_id).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="통제항목을 찾을 수 없습니다.",
        )

    # 증적 수 계산
    evidence_count = (
        db.query(func.count(control_item_evidences.c.evidence_id))
        .filter(control_item_evidences.c.control_item_id == item.id)
        .scalar() or 0
    )

    return ControlItemResponse(
        id=item.id,
        category_id=item.category_id,
        code=item.code,
        title=item.title,
        description=item.description,
        objective=item.objective,
        requirements=item.requirements,
        is_required=item.is_required,
        is_personal_info=item.is_personal_info,
        key_checks=_clean_text(item.key_checks),
        related_laws=_clean_text(item.related_laws),
        evidence_examples=_clean_text(item.evidence_examples),
        sort_order=item.sort_order,
        tags=item.tags,
        evidence_count=evidence_count,
    )


@router.get("/{control_id}/evidences", response_model=EvidenceList)
def get_control_evidences(
    control_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=200, description="페이지 크기"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    통제항목별 증적 목록 조회
    """
    from app.models.evidence import Evidence

    # 통제항목 존재 확인
    item = db.query(ControlItem).filter(ControlItem.id == control_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="통제항목을 찾을 수 없습니다.",
        )

    # 증적 조회
    query = (
        db.query(Evidence)
        .join(control_item_evidences)
        .filter(control_item_evidences.c.control_item_id == control_id)
    )

    total = query.count()

    offset = (page - 1) * page_size
    evidences = (
        query
        .order_by(Evidence.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    result_items = []
    for evidence in evidences:
        # 연결된 통제항목 정보
        control_ids = [ci.id for ci in evidence.control_items]
        control_codes = [ci.code for ci in evidence.control_items]

        result_items.append(
            EvidenceSimpleResponse(
                id=evidence.id,
                title=evidence.title,
                file_path=evidence.file_path,
                file_name=evidence.file_name,
                file_hash=evidence.file_hash,
                file_size=evidence.file_size,
                mime_type=evidence.mime_type,
                version=evidence.version,
                status=evidence.status,
                valid_from=evidence.valid_from,
                valid_until=evidence.valid_until,
                uploader_id=evidence.uploader_id,
                uploader_name=evidence.uploader.name if evidence.uploader else None,
                control_ids=control_ids,
                control_codes=control_codes,
                created_at=evidence.created_at,
                updated_at=evidence.updated_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return EvidenceList(
        items=result_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
