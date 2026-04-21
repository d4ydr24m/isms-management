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
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.assets import router as assets_router
from app.api.v1.threats import router as threats_router
from app.api.v1.vulnerabilities import router as vulnerabilities_router
from app.api.v1.risks import router as risks_router
from app.api.v1.soa import router as soa_router
from app.api.v1.asset_risk_mapping import router as asset_risk_mapping_router
from app.api.v1.risk_calculation import router as risk_calculation_router
from app.api.v1.asset_impact import router as asset_impact_router
from app.api.v1.risk_control_linkage import router as risk_control_linkage_router
from app.api.v1.system_settings import router as system_settings_router
from app.api.v1.search import router as search_router
from app.api.v1.vuln_check import router as vuln_check_router
from app.api.v1.backup import router as backup_router
from app.api.v1.isms_scope import router as isms_scope_router
from app.api.v1.eol import router as eol_router
from app.api.v1.llm_corrective_actions import router as llm_corrective_actions_router
from app.api.v1.nc_evidences import router as nc_evidences_router

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
api_router.include_router(dashboard_router)
api_router.include_router(assets_router, prefix="/assets", tags=["자산"])
api_router.include_router(threats_router, prefix="/threats", tags=["위협"])
api_router.include_router(vulnerabilities_router, prefix="/vulnerabilities", tags=["취약점"])
api_router.include_router(risks_router, prefix="/risks", tags=["위험평가"])
api_router.include_router(soa_router, prefix="/soa", tags=["SOA"])
api_router.include_router(asset_risk_mapping_router, tags=["자산-위험 매핑"])
api_router.include_router(risk_calculation_router)
api_router.include_router(asset_impact_router, tags=["자산 영향 분석"])
api_router.include_router(risk_control_linkage_router, tags=["위험-통제 연계"])
api_router.include_router(system_settings_router)
api_router.include_router(search_router)
api_router.include_router(vuln_check_router, prefix="/vuln-check", tags=["취약점 점검"])
api_router.include_router(backup_router, prefix="/backup", tags=["백업/복원"])
api_router.include_router(isms_scope_router, prefix="/isms-scope", tags=["인증 범위"])
api_router.include_router(eol_router, prefix="/eol", tags=["EoL 조회"])
api_router.include_router(llm_corrective_actions_router)
api_router.include_router(nc_evidences_router)
