"""
통합 검색 API
/api/v1/search
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.user import User
from app.models.control import ControlItem, ControlCategory
from app.models.evidence import Evidence
from app.models.asset import Asset


router = APIRouter(prefix="/search", tags=["검색"])


class SearchControlResult(BaseModel):
    id: int
    code: str
    title: str
    description: str
    category_name: Optional[str] = None
    evidence_count: int = 0


class SearchEvidenceResult(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    uploader_name: Optional[str] = None
    file_name: Optional[str] = None


class SearchUserResult(BaseModel):
    id: int
    name: str
    email: str
    department: Optional[str] = None
    roles: List[str] = []
    is_active: bool = True


class SearchAssetResult(BaseModel):
    id: int
    name: str
    asset_code: str
    asset_type_name: Optional[str] = None
    department_name: Optional[str] = None
    status: str


class SearchResponse(BaseModel):
    controls: List[SearchControlResult] = []
    evidences: List[SearchEvidenceResult] = []
    users: List[SearchUserResult] = []
    assets: List[SearchAssetResult] = []
    total_count: int = 0


@router.get("", response_model=SearchResponse)
def search(
    query: str = Query(..., min_length=1, description="검색어"),
    category: Optional[str] = Query(None, description="카테고리 필터 (controls, evidences, users, assets)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SearchResponse:
    """
    통합 검색

    통제항목, 증적, 사용자, 자산을 검색합니다.
    """
    search_term = f"%{query}%"
    controls = []
    evidences = []
    users = []
    assets = []

    # 통제항목 검색
    if not category or category == "controls":
        control_rows = (
            db.query(ControlItem)
            .outerjoin(ControlCategory, ControlItem.category_id == ControlCategory.id)
            .filter(
                or_(
                    ControlItem.code.ilike(search_term),
                    ControlItem.title.ilike(search_term),
                    ControlItem.description.ilike(search_term),
                )
            )
            .limit(20)
            .all()
        )
        for item in control_rows:
            cat_name = None
            if item.category_id:
                cat = db.query(ControlCategory).filter(ControlCategory.id == item.category_id).first()
                if cat:
                    cat_name = cat.name
            controls.append(SearchControlResult(
                id=item.id,
                code=item.code,
                title=item.title,
                description=item.description or "",
                category_name=cat_name,
                evidence_count=0,
            ))

    # 증적 검색 (archived 제외)
    if not category or category == "evidences":
        evidence_rows = (
            db.query(Evidence)
            .filter(
                Evidence.status != "archived",
                or_(
                    Evidence.title.ilike(search_term),
                    Evidence.description.ilike(search_term),
                    Evidence.file_name.ilike(search_term),
                ),
            )
            .limit(20)
            .all()
        )
        for ev in evidence_rows:
            uploader_name = None
            if ev.uploader_id:
                uploader = db.query(User).filter(User.id == ev.uploader_id).first()
                if uploader:
                    uploader_name = uploader.name
            evidences.append(SearchEvidenceResult(
                id=ev.id,
                title=ev.title,
                description=ev.description,
                status=ev.status,
                uploader_name=uploader_name,
                file_name=ev.file_name,
            ))

    # 사용자 검색 (비활성 제외)
    if not category or category == "users":
        user_rows = (
            db.query(User)
            .filter(
                User.is_active == True,
                or_(
                    User.name.ilike(search_term),
                    User.email.ilike(search_term),
                ),
            )
            .limit(20)
            .all()
        )
        for u in user_rows:
            dept_name = u.department.name if u.department else None
            role_names = [r.name for r in u.roles]
            users.append(SearchUserResult(
                id=u.id,
                name=u.name,
                email=u.email,
                department=dept_name,
                roles=role_names,
                is_active=u.is_active,
            ))

    # 자산 검색 (비활성·폐기 제외)
    if not category or category == "assets":
        asset_rows = (
            db.query(Asset)
            .filter(
                Asset.is_active == True,
                or_(
                    Asset.name.ilike(search_term),
                    Asset.asset_code.ilike(search_term),
                    Asset.description.ilike(search_term),
                ),
            )
            .limit(20)
            .all()
        )
        for a in asset_rows:
            type_name = a.asset_type.name if a.asset_type else None
            dept_name = a.department.name if a.department else None
            assets.append(SearchAssetResult(
                id=a.id,
                name=a.name,
                asset_code=a.asset_code,
                asset_type_name=type_name,
                department_name=dept_name,
                status=a.status,
            ))

    total = len(controls) + len(evidences) + len(users) + len(assets)

    return SearchResponse(
        controls=controls,
        evidences=evidences,
        users=users,
        assets=assets,
        total_count=total,
    )
