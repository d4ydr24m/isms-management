"""
심사원 계정 관리 API

5.7 심사원 모드 구현 (FR-204)
- 임시 계정 생성/수정/삭제
- 읽기 전용 접근 제어
- 모든 조회 활동 감사 로그 기록
"""
import secrets
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_permission, get_current_superuser
from app.core.security import get_password_hash
from app.models.user import User, Role, AuditorAccount
from app.models.audit import AuditPlan
from app.schemas.audit import (
    AuditorAccountCreate,
    AuditorAccountUpdate,
    AuditorAccountResponse,
    AuditorAccountList,
)
from app.services.audit_log_service import log_user_activity

router = APIRouter(prefix="/auditor-accounts", tags=["심사원 계정"])


def generate_temp_password(length: int = 16) -> str:
    """임시 비밀번호 생성"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.get("", response_model=AuditorAccountList)
def list_auditor_accounts(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    audit_plan_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    심사원 계정 목록 조회

    관리자만 조회 가능
    """
    query = db.query(AuditorAccount)

    if audit_plan_id:
        query = query.filter(AuditorAccount.audit_plan_id == audit_plan_id)
    if is_active is not None:
        query = query.filter(AuditorAccount.is_active == is_active)

    total = query.count()
    accounts = (
        query.order_by(AuditorAccount.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    items = [_account_to_response(acc) for acc in accounts]

    return AuditorAccountList(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.post("", response_model=AuditorAccountResponse, status_code=status.HTTP_201_CREATED)
def create_auditor_account(
    account_data: AuditorAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    심사원 임시 계정 생성

    - 새로운 사용자 생성
    - 심사원 역할 할당
    - 임시 비밀번호 발급
    """
    # 감사 계획 확인
    audit_plan = db.query(AuditPlan).filter(AuditPlan.id == account_data.audit_plan_id).first()
    if not audit_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="감사 계획을 찾을 수 없습니다.",
        )

    # 이메일 중복 확인
    existing_user = db.query(User).filter(User.email == account_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다.",
        )

    # 임시 비밀번호 생성
    temp_password = generate_temp_password()

    # 사용자 생성
    user = User(
        email=account_data.email,
        hashed_password=get_password_hash(temp_password),
        name=account_data.name,
        is_active=True,
        is_superuser=False,
        is_mfa_enabled=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 심사원 역할 할당
    auditor_role = db.query(Role).filter(Role.name == "외부심사원").first()
    if auditor_role:
        user.roles.append(auditor_role)
        db.commit()

    # 심사원 계정 생성
    auditor_account = AuditorAccount(
        user_id=user.id,
        audit_plan_id=account_data.audit_plan_id,
        valid_from=account_data.valid_from,
        valid_until=account_data.valid_until,
        access_scope=account_data.access_scope,
        allow_download=account_data.allow_download,
        is_active=True,
    )
    db.add(auditor_account)
    db.commit()
    db.refresh(auditor_account)

    # 감사 로그 기록
    log_user_activity(
        db=db,
        user=current_user,
        action="create",
        resource_type="auditor_account",
        resource_id=auditor_account.id,
        new_value={
            "user_email": account_data.email,
            "audit_plan_id": account_data.audit_plan_id,
            "valid_until": account_data.valid_until.isoformat(),
        },
    )

    response = _account_to_response(auditor_account)
    # 임시 비밀번호 포함 (최초 응답에만)
    response_dict = response.model_dump()
    response_dict["temp_password"] = temp_password

    return AuditorAccountResponse(**response_dict)


@router.get("/{account_id}", response_model=AuditorAccountResponse)
def get_auditor_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    심사원 계정 상세 조회
    """
    account = db.query(AuditorAccount).filter(AuditorAccount.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="심사원 계정을 찾을 수 없습니다.",
        )

    return _account_to_response(account)


@router.put("/{account_id}", response_model=AuditorAccountResponse)
def update_auditor_account(
    account_id: int,
    update_data: AuditorAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    심사원 계정 수정
    """
    account = db.query(AuditorAccount).filter(AuditorAccount.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="심사원 계정을 찾을 수 없습니다.",
        )

    # 변경 전 값 저장
    old_value = {
        "valid_until": account.valid_until.isoformat() if account.valid_until else None,
        "allow_download": account.allow_download,
        "is_active": account.is_active,
    }

    # 업데이트
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            setattr(account, key, value)

    db.commit()
    db.refresh(account)

    # 감사 로그 기록
    log_user_activity(
        db=db,
        user=current_user,
        action="update",
        resource_type="auditor_account",
        resource_id=account_id,
        old_value=old_value,
        new_value=update_dict,
    )

    return _account_to_response(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_auditor_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """
    심사원 계정 만료/삭제

    실제 삭제가 아닌 비활성화 처리
    """
    account = db.query(AuditorAccount).filter(AuditorAccount.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="심사원 계정을 찾을 수 없습니다.",
        )

    # 비활성화
    account.is_active = False
    account.valid_until = datetime.utcnow()  # 즉시 만료

    # 사용자도 비활성화
    user = db.query(User).filter(User.id == account.user_id).first()
    if user:
        user.is_active = False

    db.commit()

    # 감사 로그 기록
    log_user_activity(
        db=db,
        user=current_user,
        action="delete",
        resource_type="auditor_account",
        resource_id=account_id,
    )


def _account_to_response(account: AuditorAccount) -> AuditorAccountResponse:
    """AuditorAccount 모델을 응답 스키마로 변환"""
    return AuditorAccountResponse(
        id=account.id,
        user_id=account.user_id,
        user_email=account.user.email if account.user else None,
        user_name=account.user.name if account.user else None,
        audit_plan_id=account.audit_plan_id,
        audit_plan_title=account.audit_plan.title if account.audit_plan else None,
        valid_from=account.valid_from,
        valid_until=account.valid_until,
        access_scope=account.access_scope,
        allow_download=account.allow_download,
        is_active=account.is_active,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )
