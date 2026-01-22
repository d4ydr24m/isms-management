"""
부서 관련 Pydantic 스키마
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class DepartmentBase(BaseModel):
    """부서 기본 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[int] = None
    manager_id: Optional[int] = None


class DepartmentCreate(DepartmentBase):
    """부서 생성 스키마"""
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)


class DepartmentUpdate(BaseModel):
    """부서 수정 스키마"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    parent_id: Optional[int] = None
    manager_id: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    """부서 응답 스키마"""
    id: int
    name: str
    code: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    is_active: bool
    user_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentTree(BaseModel):
    """부서 트리 스키마"""
    id: int
    name: str
    code: str
    parent_id: Optional[int] = None
    is_active: bool
    user_count: int = 0
    children: List["DepartmentTree"] = []

    model_config = {"from_attributes": True}


# Forward reference 해결
DepartmentTree.model_rebuild()


class DepartmentList(BaseModel):
    """부서 목록 스키마"""
    items: List[DepartmentResponse]
    total: int
