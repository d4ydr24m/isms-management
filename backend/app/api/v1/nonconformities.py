"""
부적합 및 시정조치 관리 API

5.5 부적합 관리 API (FR-203)
5.6 시정조치 API (FR-203)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_permission
from app.models.user import User
from app.services.audit_service import AuditService
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

router = APIRouter(prefix="/nonconformities", tags=["부적합"])


# ========== 부적합 API ==========

@router.get("", response_model=NonConformityList)
def list_non_conformities(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    audit_plan_id: Optional[int] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    nc_type: Optional[str] = None,
    responsible_person_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    부적합 목록 조회

    - **audit_plan_id**: 감사 계획 ID 필터
    - **status**: 상태 필터 (open/in_progress/resolved/closed/reopened)
    - **severity**: 심각도 필터 (critical/high/medium/low)
    - **nc_type**: 유형 필터 (major/minor/observation)
    - **responsible_person_id**: 담당자 ID 필터
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
        evidence=nc.evidence,
        responsible_person_id=nc.responsible_person_id,
        responsible_person_name=nc.responsible_person.name if nc.responsible_person else None,
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
        responsible_person_id=ca.responsible_person_id,
        responsible_person_name=ca.responsible_person.name if ca.responsible_person else None,
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
