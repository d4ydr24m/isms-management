"""
Pydantic 스키마 패키지
"""
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserList,
    UserInDB,
)
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    PasswordChange,
    OTPSetup,
    OTPVerify,
)
from app.schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    PermissionResponse,
)
from app.schemas.department import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentTree,
)

__all__ = [
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserList",
    "UserInDB",
    # Auth
    "LoginRequest",
    "TokenResponse",
    "PasswordChange",
    "OTPSetup",
    "OTPVerify",
    # Role
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "PermissionResponse",
    # Department
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "DepartmentTree",
]
