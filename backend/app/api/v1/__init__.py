"""
API v1 패키지
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.roles import router as roles_router
from app.api.v1.departments import router as departments_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["인증"])
api_router.include_router(users_router, prefix="/users", tags=["사용자"])
api_router.include_router(roles_router, prefix="/roles", tags=["역할"])
api_router.include_router(departments_router, prefix="/departments", tags=["부서"])
