"""
ISMS 인증 범위 관리 API 라우터
/api/v1/isms-scope

자산, 담당자, 부서의 ISMS 인증 범위 포함/제외 관리
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_active_user, get_db, require_permission
from app.models.asset import Asset
from app.models.department import Department
from app.models.isms_scope import IsmsScopeChange, ScopeEntityType
from app.models.personnel import Personnel
from app.models.user import User

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic 스키마
# ---------------------------------------------------------------------------


class ScopeUpdateRequest(BaseModel):
    in_isms_scope: bool = Field(..., description="ISMS 인증 범위 포함 여부")
    reason: Optional[str] = Field(None, max_length=500, description="변경 사유")


class BulkScopeUpdateRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1, description="대상 ID 목록")
    in_isms_scope: bool = Field(..., description="ISMS 인증 범위 포함 여부")
    reason: Optional[str] = Field(None, max_length=500, description="변경 사유")


class ScopeStatsResponse(BaseModel):
    entity_type: str
    total: int
    in_scope: int
    out_of_scope: int


class ScopeSummaryResponse(BaseModel):
    assets: ScopeStatsResponse
    personnel: ScopeStatsResponse
    departments: ScopeStatsResponse


class AssetScopeItem(BaseModel):
    id: int
    asset_code: str
    name: str
    asset_type_name: Optional[str] = None
    department_name: Optional[str] = None
    status: Optional[str] = None
    in_isms_scope: bool
    scope_reason: Optional[str] = None

    class Config:
        from_attributes = True


class PersonnelScopeItem(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    position: Optional[str] = None
    department_name: Optional[str] = None
    in_isms_scope: bool
    scope_reason: Optional[str] = None

    class Config:
        from_attributes = True


class DepartmentScopeItem(BaseModel):
    id: int
    name: str
    code: str
    parent_name: Optional[str] = None
    in_isms_scope: bool
    scope_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ScopeChangeItem(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    entity_name: Optional[str] = None
    old_scope: bool
    new_scope: bool
    reason: Optional[str] = None
    changed_by_name: Optional[str] = None
    changed_at: str


class ScopeListResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# 통계
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=ScopeSummaryResponse)
def get_scope_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:read")),
):
    """ISMS 인증 범위 통계 조회"""
    # 자산 통계
    asset_total = db.query(func.count(Asset.id)).filter(Asset.is_active == True).scalar()
    asset_in = db.query(func.count(Asset.id)).filter(
        Asset.is_active == True, Asset.in_isms_scope == True
    ).scalar()

    # 담당자 통계
    personnel_total = db.query(func.count(Personnel.id)).filter(
        Personnel.is_active == True
    ).scalar()
    personnel_in = db.query(func.count(Personnel.id)).filter(
        Personnel.is_active == True, Personnel.in_isms_scope == True
    ).scalar()

    # 부서 통계
    dept_total = db.query(func.count(Department.id)).filter(
        Department.is_active == True
    ).scalar()
    dept_in = db.query(func.count(Department.id)).filter(
        Department.is_active == True, Department.in_isms_scope == True
    ).scalar()

    return ScopeSummaryResponse(
        assets=ScopeStatsResponse(
            entity_type="asset", total=asset_total,
            in_scope=asset_in, out_of_scope=asset_total - asset_in,
        ),
        personnel=ScopeStatsResponse(
            entity_type="personnel", total=personnel_total,
            in_scope=personnel_in, out_of_scope=personnel_total - personnel_in,
        ),
        departments=ScopeStatsResponse(
            entity_type="department", total=dept_total,
            in_scope=dept_in, out_of_scope=dept_total - dept_in,
        ),
    )


# ---------------------------------------------------------------------------
# 자산 범위 관리
# ---------------------------------------------------------------------------


@router.get("/assets", response_model=ScopeListResponse)
def list_asset_scope(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    in_isms_scope: Optional[bool] = Query(None, description="범위 필터"),
    search: Optional[str] = Query(None, description="이름/코드 검색"),
    department_id: Optional[int] = Query(None, description="부서 필터"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:read")),
):
    """자산 ISMS 범위 목록 조회"""
    query = db.query(Asset).options(
        joinedload(Asset.asset_type),
        joinedload(Asset.department),
    ).filter(Asset.is_active == True)

    if in_isms_scope is not None:
        query = query.filter(Asset.in_isms_scope == in_isms_scope)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (Asset.name.ilike(term)) | (Asset.asset_code.ilike(term))
        )
    if department_id is not None:
        query = query.filter(Asset.department_id == department_id)

    total = query.count()
    items = query.order_by(Asset.asset_code).offset((page - 1) * page_size).limit(page_size).all()

    return ScopeListResponse(
        items=[
            AssetScopeItem(
                id=a.id, asset_code=a.asset_code, name=a.name,
                asset_type_name=a.asset_type.name if a.asset_type else None,
                department_name=a.department.name if a.department else None,
                status=a.status, in_isms_scope=a.in_isms_scope,
                scope_reason=a.scope_reason,
            ) for a in items
        ],
        total=total, page=page, page_size=page_size,
    )


@router.put("/assets/{asset_id}")
def update_asset_scope(
    asset_id: int,
    data: ScopeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:update")),
):
    """자산 ISMS 범위 변경"""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="자산을 찾을 수 없습니다.")

    old_scope = asset.in_isms_scope
    if old_scope == data.in_isms_scope:
        return {"message": "변경 사항이 없습니다.", "id": asset_id}

    # 이력 기록
    change = IsmsScopeChange(
        entity_type=ScopeEntityType.ASSET.value,
        entity_id=asset_id,
        old_scope=old_scope,
        new_scope=data.in_isms_scope,
        reason=data.reason,
        changed_by=current_user.id,
        changed_at=datetime.now(timezone.utc),
    )
    db.add(change)

    asset.in_isms_scope = data.in_isms_scope
    asset.scope_reason = data.reason
    db.commit()

    return {"message": "자산 범위가 변경되었습니다.", "id": asset_id, "in_isms_scope": data.in_isms_scope}


@router.put("/bulk/assets")
def bulk_update_asset_scope(
    data: BulkScopeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:update")),
):
    """자산 ISMS 범위 일괄 변경"""
    assets = db.query(Asset).filter(Asset.id.in_(data.ids), Asset.is_active == True).all()
    if not assets:
        raise HTTPException(status_code=404, detail="대상 자산을 찾을 수 없습니다.")

    changed = 0
    for asset in assets:
        if asset.in_isms_scope != data.in_isms_scope:
            change = IsmsScopeChange(
                entity_type=ScopeEntityType.ASSET.value,
                entity_id=asset.id,
                old_scope=asset.in_isms_scope,
                new_scope=data.in_isms_scope,
                reason=data.reason,
                changed_by=current_user.id,
                changed_at=datetime.now(timezone.utc),
            )
            db.add(change)
            asset.in_isms_scope = data.in_isms_scope
            asset.scope_reason = data.reason
            changed += 1

    db.commit()
    return {"message": f"{changed}건의 자산 범위가 변경되었습니다.", "changed": changed}


# ---------------------------------------------------------------------------
# 담당자 범위 관리
# ---------------------------------------------------------------------------


@router.get("/personnel", response_model=ScopeListResponse)
def list_personnel_scope(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    in_isms_scope: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:read")),
):
    """담당자 ISMS 범위 목록 조회"""
    query = db.query(Personnel).options(
        joinedload(Personnel.department),
    ).filter(Personnel.is_active == True)

    if in_isms_scope is not None:
        query = query.filter(Personnel.in_isms_scope == in_isms_scope)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (Personnel.name.ilike(term)) | (Personnel.email.ilike(term))
        )
    if department_id is not None:
        query = query.filter(Personnel.department_id == department_id)

    total = query.count()
    items = query.order_by(Personnel.name).offset((page - 1) * page_size).limit(page_size).all()

    return ScopeListResponse(
        items=[
            PersonnelScopeItem(
                id=p.id, name=p.name, email=p.email,
                position=p.position,
                department_name=p.department.name if p.department else None,
                in_isms_scope=p.in_isms_scope,
                scope_reason=p.scope_reason,
            ) for p in items
        ],
        total=total, page=page, page_size=page_size,
    )


@router.put("/personnel/{personnel_id}")
def update_personnel_scope(
    personnel_id: int,
    data: ScopeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:update")),
):
    """담당자 ISMS 범위 변경"""
    person = db.query(Personnel).filter(Personnel.id == personnel_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="담당자를 찾을 수 없습니다.")

    old_scope = person.in_isms_scope
    if old_scope == data.in_isms_scope:
        return {"message": "변경 사항이 없습니다.", "id": personnel_id}

    change = IsmsScopeChange(
        entity_type=ScopeEntityType.PERSONNEL.value,
        entity_id=personnel_id,
        old_scope=old_scope,
        new_scope=data.in_isms_scope,
        reason=data.reason,
        changed_by=current_user.id,
        changed_at=datetime.now(timezone.utc),
    )
    db.add(change)

    person.in_isms_scope = data.in_isms_scope
    person.scope_reason = data.reason
    db.commit()

    return {"message": "담당자 범위가 변경되었습니다.", "id": personnel_id, "in_isms_scope": data.in_isms_scope}


@router.put("/bulk/personnel")
def bulk_update_personnel_scope(
    data: BulkScopeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:update")),
):
    """담당자 ISMS 범위 일괄 변경"""
    persons = db.query(Personnel).filter(
        Personnel.id.in_(data.ids), Personnel.is_active == True
    ).all()
    if not persons:
        raise HTTPException(status_code=404, detail="대상 담당자를 찾을 수 없습니다.")

    changed = 0
    for person in persons:
        if person.in_isms_scope != data.in_isms_scope:
            change = IsmsScopeChange(
                entity_type=ScopeEntityType.PERSONNEL.value,
                entity_id=person.id,
                old_scope=person.in_isms_scope,
                new_scope=data.in_isms_scope,
                reason=data.reason,
                changed_by=current_user.id,
                changed_at=datetime.now(timezone.utc),
            )
            db.add(change)
            person.in_isms_scope = data.in_isms_scope
            person.scope_reason = data.reason
            changed += 1

    db.commit()
    return {"message": f"{changed}건의 담당자 범위가 변경되었습니다.", "changed": changed}


# ---------------------------------------------------------------------------
# 부서 범위 관리
# ---------------------------------------------------------------------------


@router.get("/departments", response_model=ScopeListResponse)
def list_department_scope(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    in_isms_scope: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:read")),
):
    """부서 ISMS 범위 목록 조회"""
    query = db.query(Department).filter(Department.is_active == True)

    if in_isms_scope is not None:
        query = query.filter(Department.in_isms_scope == in_isms_scope)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (Department.name.ilike(term)) | (Department.code.ilike(term))
        )

    total = query.count()
    items = query.order_by(Department.code).offset((page - 1) * page_size).limit(page_size).all()

    return ScopeListResponse(
        items=[
            DepartmentScopeItem(
                id=d.id, name=d.name, code=d.code,
                parent_name=d.parent.name if d.parent else None,
                in_isms_scope=d.in_isms_scope,
                scope_reason=d.scope_reason,
            ) for d in items
        ],
        total=total, page=page, page_size=page_size,
    )


@router.put("/departments/{department_id}")
def update_department_scope(
    department_id: int,
    data: ScopeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:update")),
):
    """부서 ISMS 범위 변경"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")

    old_scope = dept.in_isms_scope
    if old_scope == data.in_isms_scope:
        return {"message": "변경 사항이 없습니다.", "id": department_id}

    change = IsmsScopeChange(
        entity_type=ScopeEntityType.DEPARTMENT.value,
        entity_id=department_id,
        old_scope=old_scope,
        new_scope=data.in_isms_scope,
        reason=data.reason,
        changed_by=current_user.id,
        changed_at=datetime.now(timezone.utc),
    )
    db.add(change)

    dept.in_isms_scope = data.in_isms_scope
    dept.scope_reason = data.reason
    db.commit()

    return {"message": "부서 범위가 변경되었습니다.", "id": department_id, "in_isms_scope": data.in_isms_scope}


@router.put("/bulk/departments")
def bulk_update_department_scope(
    data: BulkScopeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:update")),
):
    """부서 ISMS 범위 일괄 변경"""
    depts = db.query(Department).filter(
        Department.id.in_(data.ids), Department.is_active == True
    ).all()
    if not depts:
        raise HTTPException(status_code=404, detail="대상 부서를 찾을 수 없습니다.")

    changed = 0
    for dept in depts:
        if dept.in_isms_scope != data.in_isms_scope:
            change = IsmsScopeChange(
                entity_type=ScopeEntityType.DEPARTMENT.value,
                entity_id=dept.id,
                old_scope=dept.in_isms_scope,
                new_scope=data.in_isms_scope,
                reason=data.reason,
                changed_by=current_user.id,
                changed_at=datetime.now(timezone.utc),
            )
            db.add(change)
            dept.in_isms_scope = data.in_isms_scope
            dept.scope_reason = data.reason
            changed += 1

    db.commit()
    return {"message": f"{changed}건의 부서 범위가 변경되었습니다.", "changed": changed}


# ---------------------------------------------------------------------------
# 변경 이력
# ---------------------------------------------------------------------------


@router.get("/changes", response_model=ScopeListResponse)
def list_scope_changes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    entity_type: Optional[str] = Query(None, description="대상 유형 필터"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("scope:read")),
):
    """ISMS 범위 변경 이력 조회"""
    query = db.query(IsmsScopeChange).options(
        joinedload(IsmsScopeChange.changer),
    )

    if entity_type:
        query = query.filter(IsmsScopeChange.entity_type == entity_type)

    total = query.count()
    items = (
        query.order_by(IsmsScopeChange.changed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # 엔티티 이름 조회
    result_items = []
    for item in items:
        entity_name = _get_entity_name(db, item.entity_type, item.entity_id)
        result_items.append(ScopeChangeItem(
            id=item.id,
            entity_type=item.entity_type,
            entity_id=item.entity_id,
            entity_name=entity_name,
            old_scope=item.old_scope,
            new_scope=item.new_scope,
            reason=item.reason,
            changed_by_name=item.changer.name if item.changer else None,
            changed_at=item.changed_at.isoformat() if item.changed_at else "",
        ))

    return ScopeListResponse(
        items=result_items, total=total, page=page, page_size=page_size,
    )


def _get_entity_name(db: Session, entity_type: str, entity_id: int) -> Optional[str]:
    """엔티티 이름 조회 헬퍼"""
    if entity_type == ScopeEntityType.ASSET.value:
        asset = db.query(Asset).filter(Asset.id == entity_id).first()
        return f"{asset.asset_code} - {asset.name}" if asset else None
    elif entity_type == ScopeEntityType.PERSONNEL.value:
        person = db.query(Personnel).filter(Personnel.id == entity_id).first()
        return person.name if person else None
    elif entity_type == ScopeEntityType.DEPARTMENT.value:
        dept = db.query(Department).filter(Department.id == entity_id).first()
        return dept.name if dept else None
    return None
