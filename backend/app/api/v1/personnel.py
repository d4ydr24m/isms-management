"""
담당자(Personnel) 관리 API 라우터
/api/v1/personnel
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_active_user, get_db, require_permission
from app.models.department import Department
from app.models.personnel import Personnel
from app.models.user import User

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic 스키마
# ---------------------------------------------------------------------------


class PersonnelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="이름")
    email: Optional[str] = Field(None, max_length=255, description="이메일")
    phone: Optional[str] = Field(None, max_length=20, description="전화번호")
    position: Optional[str] = Field(None, max_length=100, description="직위/직책")
    department_id: Optional[int] = Field(None, description="부서 ID")
    user_id: Optional[int] = Field(None, description="연결된 시스템 사용자 ID")
    is_active: bool = Field(True, description="활성 상태")
    note: Optional[str] = Field(None, description="비고")


class PersonnelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="이름")
    email: Optional[str] = Field(None, max_length=255, description="이메일")
    phone: Optional[str] = Field(None, max_length=20, description="전화번호")
    position: Optional[str] = Field(None, max_length=100, description="직위/직책")
    department_id: Optional[int] = Field(None, description="부서 ID")
    user_id: Optional[int] = Field(None, description="연결된 시스템 사용자 ID")
    is_active: Optional[bool] = Field(None, description="활성 상태")
    note: Optional[str] = Field(None, description="비고")


class PersonnelResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    is_active: bool
    note: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class PersonnelListResponse(BaseModel):
    items: List[PersonnelResponse]
    total: int
    page: int
    page_size: int


class PersonnelSearchItem(BaseModel):
    """검색 드롭다운용 간소화된 응답"""
    id: int
    name: str
    email: Optional[str] = None
    position: Optional[str] = None
    department_name: Optional[str] = None


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------


def _personnel_to_response(p: Personnel) -> PersonnelResponse:
    """Personnel 모델을 응답 스키마로 변환"""
    return PersonnelResponse(
        id=p.id,
        name=p.name,
        email=p.email,
        phone=p.phone,
        position=p.position,
        department_id=p.department_id,
        department_name=p.department.name if p.department else None,
        user_id=p.user_id,
        user_name=p.user.name if p.user else None,
        is_active=p.is_active,
        note=p.note,
        created_at=p.created_at.isoformat() if p.created_at else None,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
    )


def _validate_references(
    db: Session,
    department_id: Optional[int],
    user_id: Optional[int],
    exclude_personnel_id: Optional[int] = None,
):
    """부서 ID, 사용자 ID 유효성 검증"""
    if department_id is not None:
        dept = db.query(Department).filter(Department.id == department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="존재하지 않는 부서입니다.",
            )

    if user_id is not None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="존재하지 않는 사용자입니다.",
            )
        # user_id 중복 검사 (다른 담당자에 이미 연결된 경우)
        existing = db.query(Personnel).filter(
            Personnel.user_id == user_id,
        ).first()
        if existing and (exclude_personnel_id is None or existing.id != exclude_personnel_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="해당 사용자는 이미 다른 담당자에 연결되어 있습니다.",
            )


# ---------------------------------------------------------------------------
# 검색 (드롭다운용) - 다른 라우트보다 먼저 등록
# ---------------------------------------------------------------------------


@router.get("/search", response_model=List[PersonnelSearchItem])
def search_personnel(
    q: str = Query("", description="이름 또는 이메일 검색어"),
    limit: int = Query(200, ge=1, le=500, description="최대 결과 수"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),  # 담당자 검색은 공통 기능 (드롭다운용)
):
    """담당자 빠른 검색 (드롭다운 자동완성용)"""
    query = db.query(Personnel).options(
        joinedload(Personnel.department),
    ).filter(Personnel.is_active == True)

    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Personnel.name.ilike(search_term),
                Personnel.email.ilike(search_term),
            )
        )

    results = query.order_by(Personnel.name).limit(limit).all()

    return [
        PersonnelSearchItem(
            id=p.id,
            name=p.name,
            email=p.email,
            position=p.position,
            department_name=p.department.name if p.department else None,
        )
        for p in results
    ]


# ---------------------------------------------------------------------------
# 목록 조회
# ---------------------------------------------------------------------------


@router.get("", response_model=PersonnelListResponse)
def list_personnel(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    name: Optional[str] = Query(None, description="이름 필터"),
    department_id: Optional[int] = Query(None, description="부서 ID 필터"),
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    sort: Optional[str] = Query(None, description="정렬 필드"),
    order: Optional[str] = Query(None, description="정렬 순서 (asc/desc)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:read")),
):
    """담당자 목록 조회 (페이지네이션, 필터)"""
    query = db.query(Personnel).options(
        joinedload(Personnel.department),
        joinedload(Personnel.user),
    )

    # 필터 적용
    if name:
        query = query.filter(Personnel.name.ilike(f"%{name}%"))
    if department_id is not None:
        query = query.filter(Personnel.department_id == department_id)
    if is_active is not None:
        query = query.filter(Personnel.is_active == is_active)

    # 정렬
    sort_column_map = {
        'name': Personnel.name,
        'email': Personnel.email,
        'position': Personnel.position,
        'department_name': Personnel.department_id,
    }
    sort_col = sort_column_map.get(sort, Personnel.name)
    if order == 'desc':
        query = query.order_by(sort_col.desc().nullslast())
    else:
        query = query.order_by(sort_col.asc().nullslast())

    total = query.count()
    items = (
        query
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return PersonnelListResponse(
        items=[_personnel_to_response(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# 단건 조회
# ---------------------------------------------------------------------------


@router.get("/{personnel_id}", response_model=PersonnelResponse)
def get_personnel(
    personnel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:read")),
):
    """담당자 상세 조회"""
    p = (
        db.query(Personnel)
        .options(joinedload(Personnel.department), joinedload(Personnel.user))
        .filter(Personnel.id == personnel_id)
        .first()
    )
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="담당자를 찾을 수 없습니다.",
        )
    return _personnel_to_response(p)


# ---------------------------------------------------------------------------
# 생성
# ---------------------------------------------------------------------------


@router.post("", response_model=PersonnelResponse, status_code=status.HTTP_201_CREATED)
def create_personnel(
    data: PersonnelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
):
    """담당자 생성"""
    # 이메일 중복 검사
    if data.email:
        existing = db.query(Personnel).filter(Personnel.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 이메일입니다.",
            )

    _validate_references(db, data.department_id, data.user_id)

    p = Personnel(
        name=data.name,
        email=data.email,
        phone=data.phone,
        position=data.position,
        department_id=data.department_id,
        user_id=data.user_id,
        is_active=data.is_active,
        note=data.note,
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    # eager load relationships for response
    p = (
        db.query(Personnel)
        .options(joinedload(Personnel.department), joinedload(Personnel.user))
        .filter(Personnel.id == p.id)
        .first()
    )
    return _personnel_to_response(p)


# ---------------------------------------------------------------------------
# 수정
# ---------------------------------------------------------------------------


@router.put("/{personnel_id}", response_model=PersonnelResponse)
def update_personnel(
    personnel_id: int,
    data: PersonnelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:update")),
):
    """담당자 수정"""
    p = db.query(Personnel).filter(Personnel.id == personnel_id).first()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="담당자를 찾을 수 없습니다.",
        )

    update_data = data.model_dump(exclude_unset=True)

    # 이메일 중복 검사
    if "email" in update_data and update_data["email"]:
        existing = (
            db.query(Personnel)
            .filter(Personnel.email == update_data["email"], Personnel.id != personnel_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 이메일입니다.",
            )

    _validate_references(
        db,
        update_data.get("department_id", p.department_id),
        update_data.get("user_id", p.user_id),
        exclude_personnel_id=personnel_id,
    )

    for key, value in update_data.items():
        setattr(p, key, value)

    db.commit()
    db.refresh(p)

    p = (
        db.query(Personnel)
        .options(joinedload(Personnel.department), joinedload(Personnel.user))
        .filter(Personnel.id == p.id)
        .first()
    )
    return _personnel_to_response(p)


# ---------------------------------------------------------------------------
# 삭제 (소프트 삭제)
# ---------------------------------------------------------------------------


@router.delete("/{personnel_id}", status_code=status.HTTP_200_OK)
def delete_personnel(
    personnel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:delete")),
):
    """담당자 삭제 (비활성화)"""
    p = db.query(Personnel).filter(Personnel.id == personnel_id).first()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="담당자를 찾을 수 없습니다.",
        )

    p.is_active = False
    db.commit()

    return {"message": "담당자가 비활성화되었습니다.", "id": personnel_id}
