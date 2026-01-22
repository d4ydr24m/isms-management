"""
부서 관리 API 라우터
/api/v1/departments
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_permission
from app.models.user import User
from app.models.department import Department
from app.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentTree,
    DepartmentList,
)
from app.schemas.user import UserResponse, UserList


router = APIRouter()


def build_department_tree(
    departments: List[Department],
    parent_id: Optional[int] = None,
) -> List[DepartmentTree]:
    """부서 트리 구조 생성"""
    tree = []
    for dept in departments:
        if dept.parent_id == parent_id:
            children = build_department_tree(departments, dept.id)
            tree.append(
                DepartmentTree(
                    id=dept.id,
                    name=dept.name,
                    code=dept.code,
                    parent_id=dept.parent_id,
                    is_active=dept.is_active,
                    user_count=len(dept.users),
                    children=children,
                )
            )
    return tree


@router.get("", response_model=DepartmentList)
def get_departments(
    tree: bool = Query(False, description="트리 구조로 반환"),
    is_active: Optional[bool] = Query(None, description="활성 상태"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DepartmentList:
    """
    부서 목록 조회

    - **tree**: True면 트리 구조로 반환
    - **is_active**: 활성 상태 필터
    """
    query = db.query(Department)

    if is_active is not None:
        query = query.filter(Department.is_active == is_active)

    departments = query.all()

    items = [
        DepartmentResponse(
            id=dept.id,
            name=dept.name,
            code=dept.code,
            description=dept.description,
            parent_id=dept.parent_id,
            manager_id=dept.manager_id,
            manager_name=None,  # TODO: manager 정보 조회
            is_active=dept.is_active,
            user_count=len(dept.users),
            created_at=dept.created_at,
        )
        for dept in departments
    ]

    return DepartmentList(items=items, total=len(items))


@router.get("/tree", response_model=List[DepartmentTree])
def get_department_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[DepartmentTree]:
    """
    부서 트리 구조 조회
    """
    departments = db.query(Department).filter(Department.is_active == True).all()
    return build_department_tree(departments)


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    dept_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
) -> DepartmentResponse:
    """
    새 부서 생성
    """
    # 코드 중복 체크
    existing = db.query(Department).filter(Department.code == dept_data.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 부서 코드입니다.",
        )

    # 상위 부서 확인
    if dept_data.parent_id:
        parent = db.query(Department).filter(Department.id == dept_data.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="상위 부서를 찾을 수 없습니다.",
            )

    # 부서 생성
    dept = Department(
        name=dept_data.name,
        code=dept_data.code,
        description=dept_data.description,
        parent_id=dept_data.parent_id,
        manager_id=dept_data.manager_id,
        is_active=True,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        code=dept.code,
        description=dept.description,
        parent_id=dept.parent_id,
        manager_id=dept.manager_id,
        manager_name=None,
        is_active=dept.is_active,
        user_count=0,
        created_at=dept.created_at,
    )


@router.get("/{dept_id}", response_model=DepartmentResponse)
def get_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DepartmentResponse:
    """
    부서 상세 조회
    """
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부서를 찾을 수 없습니다.",
        )

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        code=dept.code,
        description=dept.description,
        parent_id=dept.parent_id,
        manager_id=dept.manager_id,
        manager_name=None,
        is_active=dept.is_active,
        user_count=len(dept.users),
        created_at=dept.created_at,
    )


@router.put("/{dept_id}", response_model=DepartmentResponse)
def update_department(
    dept_id: int,
    dept_data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:update")),
) -> DepartmentResponse:
    """
    부서 정보 수정
    """
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부서를 찾을 수 없습니다.",
        )

    # 코드 중복 체크 (다른 부서와)
    if dept_data.code and dept_data.code != dept.code:
        existing = db.query(Department).filter(Department.code == dept_data.code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 존재하는 부서 코드입니다.",
            )

    # 순환 참조 방지
    if dept_data.parent_id and dept_data.parent_id == dept_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신을 상위 부서로 지정할 수 없습니다.",
        )

    # 업데이트
    update_data = dept_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dept, field, value)

    db.commit()
    db.refresh(dept)

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        code=dept.code,
        description=dept.description,
        parent_id=dept.parent_id,
        manager_id=dept.manager_id,
        manager_name=None,
        is_active=dept.is_active,
        user_count=len(dept.users),
        created_at=dept.created_at,
    )


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:delete")),
):
    """
    부서 비활성화 (소프트 삭제)
    """
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부서를 찾을 수 없습니다.",
        )

    # 하위 부서 확인
    children = db.query(Department).filter(Department.parent_id == dept_id).first()
    if children:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="하위 부서가 존재합니다. 먼저 하위 부서를 삭제하세요.",
        )

    # 소속 사용자 확인
    if dept.users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="소속 사용자가 존재합니다. 먼저 사용자를 다른 부서로 이동하세요.",
        )

    # 소프트 삭제
    dept.is_active = False
    db.commit()


@router.get("/{dept_id}/users", response_model=UserList)
def get_department_users(
    dept_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> UserList:
    """
    부서 소속 사용자 목록 조회
    """
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="부서를 찾을 수 없습니다.",
        )

    query = db.query(User).filter(User.department_id == dept_id)
    total = query.count()

    offset = (page - 1) * size
    users = query.offset(offset).limit(size).all()
    pages = (total + size - 1) // size

    items = [
        UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            phone=user.phone,
            department_id=user.department_id,
            department_name=dept.name,
            is_active=user.is_active,
            is_mfa_enabled=user.is_mfa_enabled,
            roles=[role.name for role in user.roles],
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )
        for user in users
    ]

    return UserList(items=items, total=total, page=page, size=size, pages=pages)
