"""
부적합 및 시정조치 관리 API

5.5 부적합 관리 API (FR-203)
5.6 시정조치 API (FR-203)
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, status, UploadFile, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_permission
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.nc_evidence_service import (
    NcEvidenceService,
    NcEvidenceServiceError,
    NotFoundError as NcEvidenceNotFoundError,
)
from app.schemas.audit import (
    NonConformityCreate,
    NonConformityUpdate,
    NonConformityResponse,
    NonConformityList,
    NonConformityHistory,
    CorrectiveActionCreate,
    CorrectiveActionUpdate,
    CorrectiveActionVerify,
    CorrectiveActionResponse,
)
from app.schemas.nc_evidence import (
    EvidenceRole,
    NcEvidenceAttachRequest,
    NcEvidenceItem,
    NcEvidenceList,
    NcEvidenceNoteUpdate,
    NcEvidenceRoleUpdate,
)

router = APIRouter(prefix="/nonconformities", tags=["부적합"])


# ========== 부적합 API ==========

@router.get("", response_model=NonConformityList)
def list_non_conformities(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    audit_plan_id: Optional[int] = None,
    status: Optional[List[str]] = Query(None),
    severity: Optional[str] = None,
    nc_type: Optional[str] = None,
    responsible_person_id: Optional[int] = None,
    due_date_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    부적합 목록 조회

    - **audit_plan_id**: 감사 계획 ID 필터
    - **status**: 상태 필터, 복수 선택 가능 (open/in_progress/resolved/closed/reopened)
    - **severity**: 심각도 필터 (critical/high/medium/low)
    - **nc_type**: 유형 필터 (major/minor/observation)
    - **responsible_person_id**: 담당자 ID 필터
    - **due_date_filter**: 기한 필터 (overdue: 기한 초과, upcoming: 7일 내 마감 예정)
    - **search**: 제목/통제항목 코드 검색
    """
    service = AuditService(db)
    ncs, total = service.list_non_conformities(
        page=page,
        size=size,
        audit_plan_id=audit_plan_id,
        status=status,
        severity=severity,
        nc_type=nc_type,
        responsible_person_id=responsible_person_id,
        due_date_filter=due_date_filter,
        search=search,
    )

    items = [_nc_to_response(nc) for nc in ncs]

    return NonConformityList(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.post("", response_model=NonConformityResponse, status_code=status.HTTP_201_CREATED)
def create_non_conformity(
    nc_data: NonConformityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:create")),
):
    """
    부적합 등록
    """
    service = AuditService(db)
    nc = service.create_non_conformity(nc_data)
    return _nc_to_response(nc)


@router.get("/{nc_id}", response_model=NonConformityResponse)
def get_non_conformity(
    nc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    부적합 상세 조회
    """
    service = AuditService(db)
    nc = service.get_non_conformity(nc_id)
    if not nc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부적합 사항을 찾을 수 없습니다.",
        )
    return _nc_to_response(nc)


@router.put("/{nc_id}", response_model=NonConformityResponse)
def update_non_conformity(
    nc_id: int,
    update_data: NonConformityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    부적합 수정
    """
    service = AuditService(db)
    nc = service.update_non_conformity(nc_id, update_data)
    if not nc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부적합 사항을 찾을 수 없습니다.",
        )
    return _nc_to_response(nc)


@router.get("/{nc_id}/history")
def get_non_conformity_history(
    nc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    부적합 이력 조회 (동일 통제항목 반복 지적)
    """
    service = AuditService(db)
    nc = service.get_non_conformity(nc_id)
    if not nc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부적합 사항을 찾을 수 없습니다.",
        )

    history = service.get_non_conformity_history(nc.control_item_id)
    if not history:
        return {"control_item_id": nc.control_item_id, "total_count": 0, "recent_non_conformities": []}

    # 동일 통제항목의 모든 부적합 조회
    ncs, _ = service.list_non_conformities(
        page=1,
        size=100,  # 최근 100건
    )
    related_ncs = [_nc_to_response(n) for n in ncs if n.control_item_id == nc.control_item_id]

    return {
        "control_item_id": history.control_item_id,
        "control_item_code": history.control_item_code,
        "control_item_title": history.control_item_title,
        "total_count": history.total_count,
        "recent_non_conformities": related_ncs[:10],  # 최근 10건
    }


# ========== 시정조치 API ==========

@router.post("/{nc_id}/corrective-actions", response_model=CorrectiveActionResponse, status_code=status.HTTP_201_CREATED)
def create_corrective_action(
    nc_id: int,
    ca_data: CorrectiveActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:create")),
):
    """
    시정조치 요청
    """
    service = AuditService(db)
    nc = service.get_non_conformity(nc_id)
    if not nc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부적합 사항을 찾을 수 없습니다.",
        )

    ca = service.create_corrective_action(nc_id, ca_data)
    return _ca_to_response(ca)


@router.put("/{nc_id}/corrective-actions/{ca_id}", response_model=CorrectiveActionResponse)
def update_corrective_action(
    nc_id: int,
    ca_id: int,
    update_data: CorrectiveActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    시정조치 계획/결과 등록
    """
    service = AuditService(db)
    ca = service.update_corrective_action(ca_id, update_data)
    if not ca:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시정조치를 찾을 수 없습니다.",
        )
    return _ca_to_response(ca)


@router.post("/{nc_id}/corrective-actions/{ca_id}/verify", response_model=CorrectiveActionResponse)
def verify_corrective_action(
    nc_id: int,
    ca_id: int,
    verify_data: CorrectiveActionVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    시정조치 검증 및 종료
    """
    service = AuditService(db)
    ca = service.verify_corrective_action(
        ca_id=ca_id,
        verify_data=verify_data,
        verifier_id=current_user.id,
    )
    if not ca:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시정조치를 찾을 수 없습니다.",
        )
    return _ca_to_response(ca)


@router.get("/{nc_id}/corrective-actions")
def list_corrective_actions(
    nc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    시정조치 목록 조회
    """
    service = AuditService(db)
    nc = service.get_non_conformity(nc_id)
    if not nc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부적합 사항을 찾을 수 없습니다.",
        )

    cas, total = service.list_corrective_actions(nc_id=nc_id)
    items = [_ca_to_response(ca) for ca in cas]

    return {"items": items, "total": total}


@router.delete("/{nc_id}/corrective-actions/{ca_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_corrective_action(
    nc_id: int,
    ca_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:delete")),
):
    """
    시정조치 삭제
    """
    from app.models.audit import CorrectiveAction as CAModel
    ca = db.query(CAModel).filter(CAModel.id == ca_id, CAModel.non_conformity_id == nc_id).first()
    if not ca:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시정조치를 찾을 수 없습니다.",
        )
    db.delete(ca)
    db.commit()


# ========== 부적합-증적 매핑 API ==========
# 왜 별도 라우터가 아닌가: URL prefix 가 /nonconformities 이며 같은 권한 체계를
# 사용하므로 같은 router 에 묶는다. 로직은 NcEvidenceService 로 분리되어 있다.

def _mapping_to_response(mapping) -> NcEvidenceItem:
    ev = mapping.evidence
    # DB 에 저장된 role 문자열을 Enum 으로 안전하게 변환. 알 수 없는 값은 reference 로 떨어뜨린다.
    try:
        role_value = EvidenceRole(mapping.role)
    except ValueError:
        role_value = EvidenceRole.REFERENCE
    return NcEvidenceItem(
        mapping_id=mapping.id,
        evidence_id=ev.id,
        title=ev.title,
        file_name=ev.file_name,
        file_size=ev.file_size,
        mime_type=ev.mime_type,
        mapping_note=mapping.mapping_note,
        role=role_value,
        mapped_by=mapping.mapped_by,
        mapped_at=mapping.created_at,
        uploader_name=getattr(ev, "uploader_name", None),
    )


@router.get("/{nc_id}/evidences", response_model=NcEvidenceList)
def list_nc_evidences(
    nc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """부적합에 연결된 증적 목록."""
    service = NcEvidenceService(db)
    try:
        mappings = service.list_mappings(nc_id)
    except NcEvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    items = [_mapping_to_response(m) for m in mappings]
    return NcEvidenceList(items=items, total=len(items))


@router.post(
    "/{nc_id}/evidences/attach",
    response_model=NcEvidenceList,
    status_code=status.HTTP_201_CREATED,
)
def attach_existing_evidences(
    nc_id: int,
    payload: NcEvidenceAttachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """기존 증적 ID들을 부적합에 연결한다. 이미 연결된 항목은 무시된다."""
    service = NcEvidenceService(db)
    try:
        service.attach_existing(
            nc_id=nc_id,
            evidence_ids=payload.evidence_ids,
            user_id=current_user.id,
            mapping_note=payload.mapping_note,
            role=payload.role.value,
        )
    except NcEvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except NcEvidenceServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    mappings = service.list_mappings(nc_id)
    items = [_mapping_to_response(m) for m in mappings]
    return NcEvidenceList(items=items, total=len(items))


@router.post(
    "/{nc_id}/evidences/upload",
    response_model=NcEvidenceItem,
    status_code=status.HTTP_201_CREATED,
)
def upload_and_attach_evidence(
    nc_id: int,
    file: UploadFile = File(..., description="업로드할 증적 파일"),
    title: str = Form(..., description="증적 제목"),
    mapping_note: Optional[str] = Form(None, description="매핑 메모"),
    role: EvidenceRole = Form(
        EvidenceRole.REFERENCE,
        description="증적 역할 (before/after/support/reference)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """새 파일을 업로드하여 증적으로 등록한 뒤 부적합에 즉시 연결한다."""
    service = NcEvidenceService(db)
    try:
        mapping = service.upload_and_attach(
            nc_id=nc_id,
            file=file.file,
            filename=file.filename or "unknown",
            content_type=file.content_type or "application/octet-stream",
            title=title,
            uploader_id=current_user.id,
            mapping_note=mapping_note,
            role=role.value,
        )
    except NcEvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except NcEvidenceServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    # 업로드 직후 evidence 필드 접근을 위해 refresh 체인
    db.refresh(mapping)
    return _mapping_to_response(mapping)


@router.patch(
    "/{nc_id}/evidences/{evidence_id}/note",
    response_model=NcEvidenceItem,
)
def update_mapping_note(
    nc_id: int,
    evidence_id: int,
    payload: NcEvidenceNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """단일 매핑의 mapping_note 만 수정한다."""
    service = NcEvidenceService(db)
    from app.models.nc_evidence import NonConformityEvidence

    row = (
        db.query(NonConformityEvidence)
        .filter(
            NonConformityEvidence.non_conformity_id == nc_id,
            NonConformityEvidence.evidence_id == evidence_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="연결된 증적을 찾을 수 없습니다.")
    try:
        updated = service.update_note(
            mapping_id=row.id, mapping_note=payload.mapping_note
        )
    except NcEvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return _mapping_to_response(updated)


@router.patch(
    "/{nc_id}/evidences/{evidence_id}/role",
    response_model=NcEvidenceItem,
)
def update_mapping_role(
    nc_id: int,
    evidence_id: int,
    payload: NcEvidenceRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """단일 매핑의 role 을 수정한다 (조치 전/후/보조/미지정)."""
    service = NcEvidenceService(db)
    from app.models.nc_evidence import NonConformityEvidence

    row = (
        db.query(NonConformityEvidence)
        .filter(
            NonConformityEvidence.non_conformity_id == nc_id,
            NonConformityEvidence.evidence_id == evidence_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="연결된 증적을 찾을 수 없습니다.")
    try:
        updated = service.update_role(mapping_id=row.id, role=payload.role.value)
    except NcEvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return _mapping_to_response(updated)


@router.delete(
    "/{nc_id}/evidences/{evidence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_evidence(
    nc_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """연결을 해제한다. 증적 자체는 삭제하지 않는다."""
    service = NcEvidenceService(db)
    try:
        service.detach(nc_id=nc_id, evidence_id=evidence_id)
    except NcEvidenceNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ========== 헬퍼 함수 ==========

def _nc_to_response(nc) -> NonConformityResponse:
    """NonConformity 모델을 응답 스키마로 변환"""
    return NonConformityResponse(
        id=nc.id,
        audit_plan_id=nc.audit_plan_id,
        audit_plan_title=nc.audit_plan.title if nc.audit_plan else None,
        control_item_id=nc.control_item_id,
        control_item_code=nc.control_item.code if nc.control_item else None,
        control_item_title=nc.control_item.title if nc.control_item else None,
        nc_type=nc.nc_type,
        severity=nc.severity,
        title=nc.title,
        description=nc.description,
        requirement=nc.requirement,
        responsible_person_ids=[p.id for p in nc.assignees] if nc.assignees else ([nc.responsible_person_id] if nc.responsible_person_id else []),
        responsible_person_names=[p.name for p in nc.assignees] if nc.assignees else ([nc.responsible_person.name] if nc.responsible_person else []),
        responsible_person_name=", ".join(p.name for p in nc.assignees) if nc.assignees else (nc.responsible_person.name if nc.responsible_person else None),
        department_id=nc.department_id,
        department_name=nc.department.name if nc.department else None,
        status=nc.status,
        detected_at=nc.detected_at,
        due_date=nc.due_date,
        closed_at=nc.closed_at,
        created_at=nc.created_at,
        updated_at=nc.updated_at,
        corrective_action_count=len(nc.corrective_actions) if nc.corrective_actions else 0,
    )


def _ca_to_response(ca) -> CorrectiveActionResponse:
    """CorrectiveAction 모델을 응답 스키마로 변환"""
    return CorrectiveActionResponse(
        id=ca.id,
        non_conformity_id=ca.non_conformity_id,
        action_plan=ca.action_plan,
        root_cause=ca.root_cause,
        preventive_measures=ca.preventive_measures,
        responsible_person_ids=[p.id for p in ca.assignees] if ca.assignees else ([ca.responsible_person_id] if ca.responsible_person_id else []),
        responsible_person_names=[p.name for p in ca.assignees] if ca.assignees else ([ca.responsible_person.name] if ca.responsible_person else []),
        responsible_person_name=", ".join(p.name for p in ca.assignees) if ca.assignees else (ca.responsible_person.name if ca.responsible_person else None),
        planned_completion_date=ca.planned_completion_date,
        actual_completion_date=ca.actual_completion_date,
        result_description=ca.result_description,
        result_evidence_id=ca.result_evidence_id,
        verified_by=ca.verified_by,
        verifier_name=ca.verifier.name if ca.verifier else None,
        verified_at=ca.verified_at,
        verification_result=ca.verification_result,
        verification_comment=ca.verification_comment,
        status=ca.status,
        created_at=ca.created_at,
        updated_at=ca.updated_at,
    )
