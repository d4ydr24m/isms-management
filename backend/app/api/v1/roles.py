"""
역할 관리 API 라우터
/api/v1/roles
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_permission
from app.models.user import User, Role
from app.schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleList,
    PermissionResponse,
    PermissionList,
)


router = APIRouter()


# 시스템 권한 정의
SYSTEM_PERMISSIONS = [
    # 대시보드
    {"code": "dashboard:read", "name": "대시보드 조회", "description": "대시보드를 조회합니다.", "category": "대시보드"},
    # 인증 범위
    {"code": "scope:read", "name": "인증 범위 조회", "description": "ISMS 인증 범위를 조회합니다.", "category": "인증 범위"},
    {"code": "scope:update", "name": "인증 범위 수정", "description": "ISMS 인증 범위를 변경합니다.", "category": "인증 범위"},
    # 통제항목
    {"code": "control:read", "name": "통제항목 조회", "description": "통제항목 목록 및 상세를 조회합니다.", "category": "통제항목"},
    {"code": "control:update", "name": "통제항목 수정", "description": "통제항목 정보를 수정합니다.", "category": "통제항목"},
    # 증적관리
    {"code": "evidence:create", "name": "증적 생성", "description": "새 증적을 등록합니다.", "category": "증적관리"},
    {"code": "evidence:read", "name": "증적 조회", "description": "증적 목록 및 상세를 조회합니다.", "category": "증적관리"},
    {"code": "evidence:update", "name": "증적 수정", "description": "증적 정보를 수정합니다.", "category": "증적관리"},
    {"code": "evidence:delete", "name": "증적 삭제", "description": "증적을 삭제합니다.", "category": "증적관리"},
    # 자산관리
    {"code": "asset:create", "name": "자산 생성", "description": "새 자산을 등록합니다.", "category": "자산관리"},
    {"code": "asset:read", "name": "자산 조회", "description": "자산 목록 및 상세를 조회합니다.", "category": "자산관리"},
    {"code": "asset:update", "name": "자산 수정", "description": "자산 정보를 수정합니다.", "category": "자산관리"},
    {"code": "asset:delete", "name": "자산 삭제", "description": "자산을 삭제합니다.", "category": "자산관리"},
    # 위험관리
    {"code": "risk:create", "name": "위험 생성", "description": "위험 시나리오를 생성합니다.", "category": "위험관리"},
    {"code": "risk:read", "name": "위험 조회", "description": "위험 시나리오를 조회합니다.", "category": "위험관리"},
    {"code": "risk:update", "name": "위험 수정", "description": "위험 시나리오를 수정합니다.", "category": "위험관리"},
    {"code": "risk:delete", "name": "위험 삭제", "description": "위험 시나리오를 삭제합니다.", "category": "위험관리"},
    # 감사
    {"code": "audit:create", "name": "감사 생성", "description": "새 감사 계획을 생성합니다.", "category": "감사"},
    {"code": "audit:read", "name": "감사 조회", "description": "감사 계획 및 결과를 조회합니다.", "category": "감사"},
    {"code": "audit:update", "name": "감사 수정", "description": "감사 계획 및 결과를 수정합니다.", "category": "감사"},
    {"code": "audit:delete", "name": "감사 삭제", "description": "감사 계획을 삭제합니다.", "category": "감사"},
    # 조직관리
    {"code": "user:create", "name": "사용자 생성", "description": "새 사용자를 생성합니다.", "category": "조직관리"},
    {"code": "user:read", "name": "사용자 조회", "description": "사용자 목록 및 상세를 조회합니다.", "category": "조직관리"},
    {"code": "user:update", "name": "사용자 수정", "description": "사용자 정보를 수정합니다.", "category": "조직관리"},
    {"code": "user:delete", "name": "사용자 삭제", "description": "사용자를 비활성화합니다.", "category": "조직관리"},
    # 역할
    {"code": "role:create", "name": "역할 생성", "description": "새 역할을 생성합니다.", "category": "역할"},
    {"code": "role:read", "name": "역할 조회", "description": "역할 목록을 조회합니다.", "category": "역할"},
    {"code": "role:update", "name": "역할 수정", "description": "역할 정보를 수정합니다.", "category": "역할"},
    {"code": "role:delete", "name": "역할 삭제", "description": "역할을 삭제합니다.", "category": "역할"},
    # 시스템
    {"code": "system:admin", "name": "시스템 관리", "description": "시스템 설정을 관리합니다.", "category": "시스템"},
]


@router.get("", response_model=RoleList)
def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RoleList:
    """
    역할 목록 조회 (사용자 역할 할당 등에 사용되므로 인증만 요구)
    """
    roles = db.query(Role).all()

    items = [
        RoleResponse(
            id=role.id,
            name=role.name,
            description=role.description,
            permissions=role.permissions.split(",") if role.permissions else [],
            is_system_role=role.is_system_role,
            user_count=len(role.users),
            created_at=role.created_at,
        )
        for role in roles
    ]

    return RoleList(items=items, total=len(items))


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role:create")),
) -> RoleResponse:
    """
    새 역할 생성
    """
    # 이름 중복 체크
    existing = db.query(Role).filter(Role.name == role_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 역할 이름입니다.",
        )

    # 역할 생성
    role = Role(
        name=role_data.name,
        description=role_data.description,
        permissions=",".join(role_data.permissions),
        is_system_role=False,
    )
    db.add(role)
    db.commit()
    db.refresh(role)

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=role.permissions.split(",") if role.permissions else [],
        is_system_role=role.is_system_role,
        user_count=0,
        created_at=role.created_at,
    )


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role:update")),
) -> RoleResponse:
    """
    역할 수정
    """
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="역할을 찾을 수 없습니다.",
        )

    # 시스템 역할은 권한만 수정 가능 (이름/설명 변경 불가)
    if role.is_system_role:
        if role_data.name and role_data.name != role.name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="시스템 역할의 이름은 변경할 수 없습니다.",
            )
        if role_data.description is not None and role_data.description != role.description:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="시스템 역할의 설명은 변경할 수 없습니다.",
            )
        # CISO 역할은 권한도 변경 불가 (항상 all)
        if role.name == "CISO":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CISO 역할의 권한은 변경할 수 없습니다.",
            )
    else:
        # 커스텀 역할: 이름 중복 체크
        if role_data.name and role_data.name != role.name:
            existing = db.query(Role).filter(Role.name == role_data.name).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 존재하는 역할 이름입니다.",
                )

    # 업데이트
    if not role.is_system_role:
        if role_data.name:
            role.name = role_data.name
        if role_data.description is not None:
            role.description = role_data.description
    if role_data.permissions is not None:
        role.permissions = ",".join(role_data.permissions)

    db.commit()
    db.refresh(role)

    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=role.permissions.split(",") if role.permissions else [],
        is_system_role=role.is_system_role,
        user_count=len(role.users),
        created_at=role.created_at,
    )


@router.get("/{role_id}/permissions", response_model=PermissionList)
def get_role_permissions(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role:read")),
) -> PermissionList:
    """
    역할의 권한 목록 조회
    """
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="역할을 찾을 수 없습니다.",
        )

    role_permissions = role.permissions.split(",") if role.permissions else []

    # 역할이 가진 권한만 필터링
    items = []
    for perm in SYSTEM_PERMISSIONS:
        if perm["code"] in role_permissions or "all" in role_permissions:
            items.append(PermissionResponse(**perm))

    return PermissionList(items=items)


@router.get("/permissions/all", response_model=PermissionList)
def get_all_permissions(
    current_user: User = Depends(get_current_active_user),
) -> PermissionList:
    """
    시스템 전체 권한 목록 조회 (역할 관리 페이지에서 사용)
    """
    items = [PermissionResponse(**perm) for perm in SYSTEM_PERMISSIONS]
    return PermissionList(items=items)
