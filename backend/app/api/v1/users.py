"""
사용자 관리 API 라우터
/api/v1/users
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_role, require_permission
from app.core.security import get_password_hash
from app.models.user import User, Role
from app.models.department import Department
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserList,
    UserRoleAssign,
)


router = APIRouter()


def _build_user_response(user: User) -> UserResponse:
    """User 모델에서 UserResponse를 생성하는 헬퍼"""
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        phone=user.phone,
        department_id=user.department_id,
        department_name=user.department.name if user.department else None,
        is_active=user.is_active,
        is_mfa_enabled=user.is_mfa_enabled,
        roles=[{"id": role.id, "name": role.name, "description": role.description} for role in user.roles],
        ip_whitelist_enabled=user.ip_whitelist_enabled,
        allowed_ips=user.allowed_ips,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        last_login_ip=user.last_login_ip,
    )


@router.get("", response_model=UserList)
def get_users(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="검색어 (이름, 이메일)"),
    department_id: Optional[int] = Query(None, description="부서 ID"),
    is_active: Optional[bool] = Query(None, description="활성 상태"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:read")),
) -> UserList:
    """
    사용자 목록 조회

    - **page**: 페이지 번호 (기본값: 1)
    - **size**: 페이지 크기 (기본값: 10)
    - **search**: 이름 또는 이메일 검색
    - **department_id**: 부서 필터
    - **is_active**: 활성 상태 필터
    """
    query = db.query(User)

    # 검색 필터
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )

    # 부서 필터
    if department_id:
        query = query.filter(User.department_id == department_id)

    # 활성 상태 필터
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    # 총 개수
    total = query.count()

    # 페이지네이션
    offset = (page - 1) * size
    users = query.offset(offset).limit(size).all()

    # 총 페이지 수
    pages = (total + size - 1) // size

    items = [_build_user_response(user) for user in users]

    return UserList(items=items, total=total, page=page, size=size, pages=pages)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
) -> UserResponse:
    """
    새 사용자 생성

    - **email**: 이메일 (필수, 고유)
    - **password**: 비밀번호 (필수)
    - **name**: 이름 (필수)
    - **phone**: 전화번호
    - **department_id**: 부서 ID
    """
    # 이메일 중복 체크
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다.",
        )

    # 부서 확인
    if user_data.department_id:
        dept = db.query(Department).filter(Department.id == user_data.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="부서를 찾을 수 없습니다.",
            )

    # 사용자 생성
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        name=user_data.name,
        phone=user_data.phone,
        department_id=user_data.department_id,
        is_active=True,
        is_superuser=False,
        is_mfa_enabled=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _build_user_response(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:read")),
) -> UserResponse:
    """
    사용자 상세 조회
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    return _build_user_response(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:update")),
) -> UserResponse:
    """
    사용자 정보 수정
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    # 이메일 중복 체크 (다른 사용자와)
    if user_data.email and user_data.email != user.email:
        existing = db.query(User).filter(User.email == user_data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 이메일입니다.",
            )

    # 업데이트
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return _build_user_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:delete")),
):
    """
    사용자 비활성화 (소프트 삭제)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    # 자기 자신 삭제 방지
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신을 삭제할 수 없습니다.",
        )

    # 소프트 삭제
    user.is_active = False
    db.commit()


@router.put("/{user_id}/roles", response_model=UserResponse)
def assign_roles(
    user_id: int,
    role_data: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:update")),
) -> UserResponse:
    """
    사용자 역할 할당
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다.",
        )

    # 역할 조회
    roles = db.query(Role).filter(Role.id.in_(role_data.role_ids)).all()
    if len(roles) != len(role_data.role_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="일부 역할을 찾을 수 없습니다.",
        )

    # 역할 할당
    user.roles = roles
    db.commit()
    db.refresh(user)

    return _build_user_response(user)
