"""
API v1 패키지
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.roles import router as roles_router
from app.api.v1.departments import router as departments_router
from app.api.v1.controls import router as controls_router
from app.api.v1.evidences import router as evidences_router
from app.api.v1.scheduled_tasks import router as scheduled_tasks_router
from app.api.v1.audits import router as audits_router
from app.api.v1.nonconformities import router as nonconformities_router
from app.api.v1.auditor_accounts import router as auditor_accounts_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.templates import router as templates_router
from app.api.v1.migration import router as migration_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["인증"])
api_router.include_router(users_router, prefix="/users", tags=["사용자"])
api_router.include_router(roles_router, prefix="/roles", tags=["역할"])
api_router.include_router(departments_router, prefix="/departments", tags=["부서"])
api_router.include_router(controls_router, prefix="/controls", tags=["통제항목"])
api_router.include_router(evidences_router, prefix="/evidences", tags=["증적"])
api_router.include_router(scheduled_tasks_router, prefix="/scheduled-tasks", tags=["정기 활동"])
api_router.include_router(audits_router)
api_router.include_router(nonconformities_router)
api_router.include_router(auditor_accounts_router)
api_router.include_router(audit_logs_router)
api_router.include_router(notifications_router, prefix="/notifications", tags=["알림"])
api_router.include_router(templates_router, prefix="/templates", tags=["템플릿"])
api_router.include_router(migration_router, prefix="/migration", tags=["마이그레이션"])
