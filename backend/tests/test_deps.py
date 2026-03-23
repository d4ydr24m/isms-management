"""
의존성 주입 테스트
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.deps import (
    get_db,
    get_current_user,
    get_current_active_user,
    require_role,
    require_permission,
)
from app.core.security import create_access_token
from app.models.user import User, Role


def _mock_request():
    """쿠키 없는 mock Request 객체 생성"""
    request = MagicMock()
    request.cookies = {}
    return request


class TestGetCurrentUser:
    """현재 사용자 의존성 테스트"""

    def test_valid_token(self, db: Session, test_user: User):
        """유효한 토큰으로 사용자 조회"""
        token = create_access_token({"sub": test_user.email, "user_id": test_user.id})
        user = get_current_user(request=_mock_request(), token=token, db=db)
        assert user.id == test_user.id
        assert user.email == test_user.email

    def test_invalid_token(self, db: Session):
        """잘못된 토큰으로 사용자 조회 실패"""
        with pytest.raises(HTTPException) as excinfo:
            get_current_user(request=_mock_request(), token="invalid_token", db=db)
        assert excinfo.value.status_code == 401

    def test_expired_token(self, db: Session, test_user: User):
        """만료된 토큰으로 사용자 조회 실패"""
        token = create_access_token(
            {"sub": test_user.email, "user_id": test_user.id},
            expires_delta=timedelta(seconds=-1)
        )
        with pytest.raises(HTTPException) as excinfo:
            get_current_user(request=_mock_request(), token=token, db=db)
        assert excinfo.value.status_code == 401

    def test_user_not_found(self, db: Session):
        """존재하지 않는 사용자"""
        token = create_access_token({"sub": "nonexistent@example.com", "user_id": 9999})
        with pytest.raises(HTTPException) as excinfo:
            get_current_user(request=_mock_request(), token=token, db=db)
        assert excinfo.value.status_code == 401


class TestGetCurrentActiveUser:
    """활성 사용자 의존성 테스트"""

    def test_active_user(self, db: Session, test_user: User):
        """활성 사용자 조회"""
        user = get_current_active_user(current_user=test_user)
        assert user.is_active is True

    def test_inactive_user(self, db: Session, test_inactive_user: User):
        """비활성 사용자 접근 거부"""
        with pytest.raises(HTTPException) as excinfo:
            get_current_active_user(current_user=test_inactive_user)
        assert excinfo.value.status_code == 403

    def test_locked_user(self, db: Session, test_locked_user: User):
        """잠긴 사용자 접근 거부"""
        with pytest.raises(HTTPException) as excinfo:
            get_current_active_user(current_user=test_locked_user)
        assert excinfo.value.status_code == 403


class TestRequireRole:
    """역할 검증 의존성 테스트"""

    def test_user_has_required_role(self, db: Session, test_admin_user: User):
        """필요한 역할 보유"""
        checker = require_role(["CISO"])
        # admin_user는 CISO 역할을 가지고 있음
        result = checker(current_user=test_admin_user)
        assert result == test_admin_user

    def test_user_missing_role(self, db: Session, test_user: User):
        """필요한 역할 미보유"""
        checker = require_role(["CISO"])
        with pytest.raises(HTTPException) as excinfo:
            checker(current_user=test_user)
        assert excinfo.value.status_code == 403

    def test_multiple_allowed_roles(self, db: Session, test_admin_user: User):
        """여러 역할 중 하나 보유"""
        checker = require_role(["CISO", "보안담당자"])
        result = checker(current_user=test_admin_user)
        assert result == test_admin_user

    def test_superuser_bypass(self, db: Session, test_admin_user: User):
        """슈퍼유저는 모든 역할 통과"""
        checker = require_role(["존재하지않는역할"])
        result = checker(current_user=test_admin_user)
        assert result == test_admin_user


class TestRequirePermission:
    """권한 검증 의존성 테스트"""

    def test_user_has_permission(self, db: Session, test_admin_user: User):
        """필요한 권한 보유 (all 권한)"""
        checker = require_permission("evidence:read")
        result = checker(current_user=test_admin_user)
        assert result == test_admin_user

    def test_user_missing_permission(self, db: Session, test_user: User):
        """필요한 권한 미보유"""
        checker = require_permission("user:delete")
        with pytest.raises(HTTPException) as excinfo:
            checker(current_user=test_user)
        assert excinfo.value.status_code == 403

    def test_wildcard_permission(self, db: Session, test_user: User, test_role_security_manager: Role):
        """와일드카드 권한 (evidence:*)"""
        # 보안담당자 역할 추가
        test_user.roles.append(test_role_security_manager)

        checker = require_permission("evidence:delete")
        result = checker(current_user=test_user)
        assert result == test_user
