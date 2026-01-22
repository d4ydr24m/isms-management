"""
역할 관련 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class RoleBase(BaseModel):
    """역할 기본 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)


class RoleCreate(RoleBase):
    """역할 생성 스키마"""
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    permissions: List[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    """역할 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    permissions: Optional[List[str]] = None


class RoleResponse(BaseModel):
    """역할 응답 스키마"""
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str]
    is_system_role: bool
    user_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class RoleList(BaseModel):
    """역할 목록 스키마"""
    items: List[RoleResponse]
    total: int


class PermissionResponse(BaseModel):
    """권한 응답 스키마"""
    code: str
    name: str
    description: Optional[str] = None
    category: str


class PermissionList(BaseModel):
    """권한 목록 스키마"""
    items: List[PermissionResponse]
