"""
SQLAlchemy 모델 패키지
모든 모델을 한 곳에서 import하여 alembic이 인식할 수 있도록 함
"""

from app.db.base import Base
from app.models.department import Department
from app.models.user import User, Role, UserRole, AuditorAccount
from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import (
    Evidence,
    EvidenceVersion,
    EvidenceTemplate,
    ControlItemEvidence,
)
from app.models.scheduled_task import ScheduledTask, TaskExecution
from app.models.audit import (
    AuditPlan,
    AuditChecklist,
    AuditChecklistResult,
    NonConformity,
    CorrectiveAction,
)
from app.models.notification import Notification, NotificationSetting
from app.models.audit_log import AuditLog
from app.models.asset import (
    AssetType,
    AssetCategory,
    Asset,
    AssetValuation,
    AssetHistory,
    AssetDisposal,
    AssetAssignment,
    AssetHandover,
)
from app.models.risk import (
    ThreatCategory,
    Threat,
    AssetTypeThreat,
    VulnerabilityCategory,
    Vulnerability,
    VulnerabilityAssessment,
    RiskScenario,
    RiskAssessment,
    DoAConfig,
    DoAHistory,
    RiskTreatmentPlan,
    RiskTreatmentAction,
    SOARecord,
)

__all__ = [
    "Base",
    "Department",
    "User",
    "Role",
    "UserRole",
    "AuditorAccount",
    "ControlDomain",
    "ControlCategory",
    "ControlItem",
    "Evidence",
    "EvidenceVersion",
    "EvidenceTemplate",
    "ControlItemEvidence",
    "ScheduledTask",
    "TaskExecution",
    "AuditPlan",
    "AuditChecklist",
    "AuditChecklistResult",
    "NonConformity",
    "CorrectiveAction",
    "Notification",
    "NotificationSetting",
    "AuditLog",
    # Phase 2 - Asset models
    "AssetType",
    "AssetCategory",
    "Asset",
    "AssetValuation",
    "AssetHistory",
    "AssetDisposal",
    "AssetAssignment",
    "AssetHandover",
    # Phase 2 - Risk models
    "ThreatCategory",
    "Threat",
    "AssetTypeThreat",
    "VulnerabilityCategory",
    "Vulnerability",
    "VulnerabilityAssessment",
    "RiskScenario",
    "RiskAssessment",
    "DoAConfig",
    "DoAHistory",
    "RiskTreatmentPlan",
    "RiskTreatmentAction",
    "SOARecord",
]
