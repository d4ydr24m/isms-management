"""
사용자 관련 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_password_policy


class UserBase(BaseModel):
    """사용자 기본 스키마"""
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None


class UserCreate(UserBase):
    """사용자 생성 스키마"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        result = validate_password_policy(v)
        if not result["valid"]:
            raise ValueError("; ".join(result["errors"]))
        return v


class UserUpdate(BaseModel):
    """사용자 수정 스키마"""
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    department_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """사용자 응답 스키마"""
    id: int
    email: str
    name: str
    phone: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_active: bool
    is_mfa_enabled: bool
    roles: List[str] = []
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserList(BaseModel):
    """사용자 목록 스키마"""
    items: List[UserResponse]
    total: int
    page: int
    size: int
    pages: int


class UserInDB(UserBase):
    """데이터베이스 사용자 스키마"""
    id: int
    hashed_password: str
    is_active: bool
    is_superuser: bool
    is_mfa_enabled: bool
    mfa_secret: Optional[str] = None
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    password_changed_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserRoleAssign(BaseModel):
    """사용자 역할 할당 스키마"""
    role_ids: List[int] = Field(..., min_length=1)
