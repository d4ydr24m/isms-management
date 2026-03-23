"""
FastAPI 의존성 주입
DB 세션, 인증, 권한 검증 등
"""
from datetime import datetime
from typing import Callable, Generator, List, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.user import User


# HTTP Bearer 토큰 스킴
security = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """
    데이터베이스 세션 의존성
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
    token: Optional[str] = None,
) -> User:
    """
    현재 인증된 사용자 반환

    Args:
        request: HTTP 요청 객체 (쿠키에서 토큰 추출용)
        credentials: HTTP Authorization 헤더의 Bearer 토큰
        db: 데이터베이스 세션
        token: 직접 전달된 토큰 (테스트용)

    Returns:
        User: 인증된 사용자

    Raises:
        HTTPException: 인증 실패 시 401
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 토큰 추출: 직접 전달 > Authorization 헤더 > HttpOnly 쿠키
    if token:
        access_token = token
    elif credentials:
        access_token = credentials.credentials
    elif request.cookies.get("access_token"):
        access_token = request.cookies.get("access_token")
    else:
        raise credentials_exception

    # 토큰 디코딩
    payload = decode_token(access_token)
    if payload is None:
        raise credentials_exception

    # 토큰 타입 확인
    if payload.get("type") != "access":
        raise credentials_exception

    # 토큰 블랙리스트 확인 (Redis 연결 가능 시)
    try:
        from app.services.session_service import session_service
        if session_service.is_token_blacklisted(access_token):
            raise credentials_exception
    except Exception:
        pass  # Redis 연결 실패 시 블랙리스트 체크 건너뜀

    # 사용자 조회
    email: str = payload.get("sub")
    user_id: int = payload.get("user_id")
    if email is None or user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    활성 상태인 현재 사용자 반환

    Args:
        current_user: 인증된 사용자

    Returns:
        User: 활성 사용자

    Raises:
        HTTPException: 비활성/잠금 사용자는 403
    """
    # 비활성 사용자 체크
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다.",
        )

    # 계정 잠금 체크
    if current_user.locked_until and current_user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="계정이 잠겨 있습니다. 잠시 후 다시 시도해주세요.",
        )

    # 비밀번호 만료 체크
    if current_user.password_changed_at:
        from datetime import timedelta
        expiry_date = current_user.password_changed_at + timedelta(
            days=settings.PASSWORD_EXPIRY_DAYS
        )
        if datetime.utcnow() > expiry_date:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="비밀번호가 만료되었습니다. 비밀번호를 변경해주세요.",
                headers={"X-Password-Expired": "true"},
            )

    return current_user


def require_role(allowed_roles: List[str]) -> Callable:
    """
    역할 기반 접근 제어 의존성 팩토리

    Args:
        allowed_roles: 허용된 역할 목록

    Returns:
        Callable: 역할 검증 의존성 함수
    """
    def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        # 슈퍼유저는 모든 역할 통과
        if current_user.is_superuser:
            return current_user

        # 사용자 역할 확인
        user_roles = [role.name for role in current_user.roles]
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"접근 권한이 없습니다. 필요한 역할: {', '.join(allowed_roles)}",
            )

        return current_user

    return role_checker


def require_permission(required_permission: str) -> Callable:
    """
    권한 기반 접근 제어 의존성 팩토리

    Args:
        required_permission: 필요한 권한 (예: "evidence:read")

    Returns:
        Callable: 권한 검증 의존성 함수
    """
    def permission_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        # 슈퍼유저는 모든 권한 통과
        if current_user.is_superuser:
            return current_user

        # 사용자 권한 수집
        user_permissions = set()
        for role in current_user.roles:
            permissions = role.permissions.split(",")
            for perm in permissions:
                perm = perm.strip()
                user_permissions.add(perm)

        # "all" 권한 체크
        if "all" in user_permissions:
            return current_user

        # 정확한 권한 매칭
        if required_permission in user_permissions:
            return current_user

        # 와일드카드 권한 매칭 (예: evidence:* -> evidence:read)
        permission_parts = required_permission.split(":")
        if len(permission_parts) == 2:
            wildcard_permission = f"{permission_parts[0]}:*"
            if wildcard_permission in user_permissions:
                return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"접근 권한이 없습니다. 필요한 권한: {required_permission}",
        )

    return permission_checker


def get_current_superuser(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    슈퍼유저만 접근 허용

    Args:
        current_user: 활성 사용자

    Returns:
        User: 슈퍼유저

    Raises:
        HTTPException: 슈퍼유저가 아닌 경우 403
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="슈퍼유저 권한이 필요합니다.",
        )
    return current_user
