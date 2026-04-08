"""
감사 관리 API

5.3 내부감사 계획 API (FR-201)
5.4 감사 체크리스트 API (FR-202)
5.8 심사 대응 자료 패키지 (FR-205)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_permission
from app.models.user import User
from app.services.audit_service import AuditService
from app.schemas.audit import (
    AuditPlanCreate,
    AuditPlanUpdate,
    AuditPlanResponse,
    AuditPlanList,
    AuditTeamUpdate,
    ChecklistItemResponse,
    ChecklistResultCreate,
    ChecklistResultResponse,
    ChecklistEvidenceLink,
    AuditPackageResponse,
)

router = APIRouter(prefix="/audits", tags=["감사"])


# ========== 감사 계획 API ==========

@router.get("", response_model=AuditPlanList)
def list_audit_plans(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    audit_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    감사 계획 목록 조회

    - **page**: 페이지 번호
    - **size**: 페이지 크기
    - **audit_type**: 감사 유형 필터 (internal/external/certification)
    - **status**: 상태 필터 (planning/in_progress/completed/cancelled)
    - **search**: 검색어
    """
    service = AuditService(db)
    plans, total = service.list_audit_plans(
        page=page,
        size=size,
        audit_type=audit_type,
        status=status,
        search=search,
    )

    # 응답 변환
    items = []
    for plan in plans:
        items.append(_plan_to_response(plan))

    return AuditPlanList(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.post("", response_model=AuditPlanResponse, status_code=status.HTTP_201_CREATED)
def create_audit_plan(
    plan_data: AuditPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:create")),
):
    """
    감사 계획 생성
    """
    service = AuditService(db)
    plan = service.create_audit_plan(plan_data, current_user_id=current_user.id)
    return _plan_to_response(plan)


@router.get("/{plan_id}", response_model=AuditPlanResponse)
def get_audit_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    감사 계획 상세 조회
    """
    service = AuditService(db)
    plan = service.get_audit_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )
    return _plan_to_response(plan)


@router.put("/{plan_id}", response_model=AuditPlanResponse)
def update_audit_plan(
    plan_id: int,
    update_data: AuditPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    감사 계획 수정
    """
    service = AuditService(db)
    plan = service.update_audit_plan(plan_id, update_data)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )
    return _plan_to_response(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audit_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:delete")),
):
    """
    감사 계획 삭제
    """
    service = AuditService(db)
    result = service.delete_audit_plan(plan_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )


@router.put("/{plan_id}/team", response_model=AuditPlanResponse)
def update_audit_team(
    plan_id: int,
    team_data: AuditTeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    감사팀 구성 수정
    """
    service = AuditService(db)
    plan = service.update_audit_team(plan_id, team_data)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )
    return _plan_to_response(plan)


# ========== 체크리스트 API ==========

@router.get("/{plan_id}/checklist")
def get_checklist(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    체크리스트 조회
    """
    service = AuditService(db)
    plan = service.get_audit_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )

    checklists = service.get_checklists(plan_id)
    items = []
    for checklist in checklists:
        item = {
            "id": checklist.id,
            "audit_plan_id": checklist.audit_plan_id,
            "control_item_id": checklist.control_item_id,
            "control_item_code": checklist.control_item.code if checklist.control_item else None,
            "control_item_title": checklist.control_item.title if checklist.control_item else None,
            "question": checklist.question,
            "sort_order": checklist.sort_order,
            "latest_result": None,
            "created_at": checklist.created_at,
        }
        # 최신 결과 추가
        if checklist.results:
            latest = max(checklist.results, key=lambda r: r.checked_at)
            item["latest_result"] = {
                "id": latest.id,
                "checklist_id": latest.checklist_id,
                "result": latest.result,
                "finding": latest.finding,
                "evidence_reference": latest.evidence_reference,
                "auditor_id": latest.auditor_id,
                "auditor_name": latest.auditor.name if latest.auditor else None,
                "checked_at": latest.checked_at,
            }
        items.append(item)

    return {"items": items, "total": len(items)}


@router.post("/{plan_id}/checklist/generate", status_code=status.HTTP_201_CREATED)
def generate_checklist(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:create")),
):
    """
    체크리스트 자동 생성 (통제항목 기반)
    """
    service = AuditService(db)
    plan = service.get_audit_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )

    checklists = service.generate_checklist(plan_id)
    items = []
    for checklist in checklists:
        items.append({
            "id": checklist.id,
            "audit_plan_id": checklist.audit_plan_id,
            "control_item_id": checklist.control_item_id,
            "question": checklist.question,
            "sort_order": checklist.sort_order,
            "created_at": checklist.created_at,
        })

    return {"items": items, "total": len(items)}


@router.put("/{plan_id}/checklist/{checklist_id}", response_model=ChecklistResultResponse)
def submit_checklist_result(
    plan_id: int,
    checklist_id: int,
    result_data: ChecklistResultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    점검 결과 입력
    """
    service = AuditService(db)
    result = service.submit_checklist_result(
        checklist_id=checklist_id,
        result_data=result_data,
        auditor_id=current_user.id,
    )
    return {
        "id": result.id,
        "checklist_id": result.checklist_id,
        "result": result.result,
        "finding": result.finding,
        "evidence_reference": result.evidence_reference,
        "auditor_id": result.auditor_id,
        "auditor_name": current_user.name,
        "checked_at": result.checked_at,
    }


@router.post("/{plan_id}/checklist/{checklist_id}/evidence")
def link_evidence_to_checklist(
    plan_id: int,
    checklist_id: int,
    evidence_data: ChecklistEvidenceLink,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    체크리스트에 근거 증적 연결
    """
    service = AuditService(db)
    result = service.link_evidence_to_checklist(checklist_id, evidence_data.evidence_ids)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="증적 연결에 실패했습니다. 먼저 점검 결과를 입력해주세요.",
        )
    return {"success": True}


# ========== 심사 대응 자료 패키지 API ==========

@router.get("/{plan_id}/package", response_model=AuditPackageResponse)
def get_audit_package(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    심사 대응 자료 패키지 조회

    - D-Day 계산
    - 패키지 다운로드 URL
    """
    from datetime import datetime

    service = AuditService(db)
    plan = service.get_audit_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )

    d_day = service.calculate_d_day(plan_id)

    return AuditPackageResponse(
        audit_plan_id=plan_id,
        audit_plan_title=plan.title,
        d_day=d_day,
        package_url=None,  # TODO: 실제 패키지 생성 구현
        index_document_url=None,
        total_evidence_count=0,
        total_file_size=0,
        generated_at=datetime.utcnow(),
    )


# ========== 헬퍼 함수 ==========

def _plan_to_response(plan) -> AuditPlanResponse:
    """AuditPlan 모델을 응답 스키마로 변환"""
    return AuditPlanResponse(
        id=plan.id,
        title=plan.title,
        description=plan.description,
        audit_type=plan.audit_type,
        start_date=plan.start_date,
        end_date=plan.end_date,
        scope=plan.scope,
        control_domains=plan.control_domains,
        lead_auditor_id=plan.lead_auditor_id,
        lead_auditor_name=plan.lead_auditor.name if plan.lead_auditor else None,
        team_members=plan.team_members,
        status=plan.status,
        overall_result=plan.overall_result,
        final_report_path=plan.final_report_path,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        checklist_count=len(plan.checklists) if plan.checklists else 0,
        completed_checklist_count=sum(
            1 for c in plan.checklists if c.results
        ) if plan.checklists else 0,
        non_conformity_count=len(plan.non_conformities) if plan.non_conformities else 0,
    )
