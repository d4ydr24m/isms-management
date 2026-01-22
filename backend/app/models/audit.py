from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class AuditPlan(Base):
    """
    감사 계획 모델
    """

    __tablename__ = "audit_plans"

    title = Column(String(255), nullable=False, comment="감사 제목")
    description = Column(Text, nullable=True, comment="감사 설명")
    audit_type = Column(
        String(50),
        nullable=False,
        comment="감사 유형 (internal/external/certification)",
    )

    # 일정
    start_date = Column(Date, nullable=False, comment="감사 시작일")
    end_date = Column(Date, nullable=False, comment="감사 종료일")

    # 범위
    scope = Column(Text, nullable=False, comment="감사 범위 (부서, 프로세스 등)")
    control_domains = Column(
        Text, nullable=True, comment="대상 통제영역 JSON (쉼표로 구분)"
    )

    # 감사팀
    lead_auditor_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="수감사인 ID"
    )
    team_members = Column(Text, nullable=True, comment="감사팀 구성원 ID JSON")

    # 상태
    status = Column(
        String(20),
        default="planning",
        nullable=False,
        comment="상태 (planning/in_progress/completed/cancelled)",
    )

    # 결과
    overall_result = Column(
        String(20), nullable=True, comment="전체 결과 (conformity/non_conformity)"
    )
    final_report_path = Column(String(500), nullable=True, comment="최종 보고서 파일 경로")

    # 관계
    lead_auditor = relationship("User", foreign_keys=[lead_auditor_id], backref="led_audits")
    checklists = relationship("AuditChecklist", back_populates="audit_plan", cascade="all, delete-orphan")
    non_conformities = relationship("NonConformity", back_populates="audit_plan", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<AuditPlan(id={self.id}, title={self.title}, audit_type={self.audit_type})>"


class AuditChecklist(Base):
    """
    감사 체크리스트 모델
    """

    __tablename__ = "audit_checklists"

    audit_plan_id = Column(
        Integer, ForeignKey("audit_plans.id"), nullable=False, comment="감사 계획 ID"
    )
    control_item_id = Column(
        Integer, ForeignKey("control_items.id"), nullable=False, comment="통제항목 ID"
    )
    question = Column(Text, nullable=False, comment="점검 질문")
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")

    # 관계
    audit_plan = relationship("AuditPlan", back_populates="checklists")
    control_item = relationship("ControlItem", backref="audit_checklists")
    results = relationship("AuditChecklistResult", back_populates="checklist", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<AuditChecklist(id={self.id}, audit_plan_id={self.audit_plan_id})>"


class AuditChecklistResult(Base):
    """
    감사 체크리스트 결과 모델
    """

    __tablename__ = "audit_checklist_results"

    checklist_id = Column(
        Integer, ForeignKey("audit_checklists.id"), nullable=False, comment="체크리스트 ID"
    )
    result = Column(
        String(20),
        nullable=False,
        comment="점검 결과 (conformity/non_conformity/observation/not_applicable)",
    )
    finding = Column(Text, nullable=True, comment="발견사항")
    evidence_reference = Column(
        Text, nullable=True, comment="근거 증적 참조 (증적 ID 목록)"
    )
    auditor_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="점검자 ID"
    )
    checked_at = Column(
        DateTime, default=datetime.utcnow, nullable=False, comment="점검 일시"
    )

    # 관계
    checklist = relationship("AuditChecklist", back_populates="results")
    auditor = relationship("User", backref="checklist_results")

    def __repr__(self) -> str:
        return f"<AuditChecklistResult(id={self.id}, result={self.result})>"


class NonConformity(Base):
    """
    부적합 사항 모델
    """

    __tablename__ = "non_conformities"

    audit_plan_id = Column(
        Integer, ForeignKey("audit_plans.id"), nullable=False, comment="감사 계획 ID"
    )
    control_item_id = Column(
        Integer, ForeignKey("control_items.id"), nullable=False, comment="통제항목 ID"
    )

    # 부적합 분류
    nc_type = Column(
        String(20),
        nullable=False,
        comment="부적합 유형 (major/minor/observation)",
    )
    severity = Column(
        String(20),
        nullable=False,
        comment="심각도 (critical/high/medium/low)",
    )

    # 부적합 내용
    title = Column(String(255), nullable=False, comment="부적합 제목")
    description = Column(Text, nullable=False, comment="부적합 내용")
    requirement = Column(Text, nullable=False, comment="요구사항")
    evidence = Column(Text, nullable=True, comment="근거")

    # 담당자
    responsible_person_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="조치 담당자 ID"
    )
    department_id = Column(
        Integer, ForeignKey("departments.id"), nullable=True, comment="담당 부서 ID"
    )

    # 상태
    status = Column(
        String(20),
        default="open",
        nullable=False,
        comment="상태 (open/in_progress/resolved/closed/reopened)",
    )

    # 일자
    detected_at = Column(Date, nullable=False, comment="적발일")
    due_date = Column(Date, nullable=False, comment="시정 기한")
    closed_at = Column(Date, nullable=True, comment="종료일")

    # 관계
    audit_plan = relationship("AuditPlan", back_populates="non_conformities")
    control_item = relationship("ControlItem", backref="non_conformities")
    responsible_person = relationship("User", foreign_keys=[responsible_person_id], backref="assigned_non_conformities")
    department = relationship("Department", backref="non_conformities")
    corrective_actions = relationship("CorrectiveAction", back_populates="non_conformity", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<NonConformity(id={self.id}, title={self.title}, status={self.status})>"


class CorrectiveAction(Base):
    """
    시정조치 모델
    """

    __tablename__ = "corrective_actions"

    non_conformity_id = Column(
        Integer, ForeignKey("non_conformities.id"), nullable=False, comment="부적합 ID"
    )

    # 시정조치 계획
    action_plan = Column(Text, nullable=False, comment="시정조치 계획")
    root_cause = Column(Text, nullable=True, comment="근본 원인 분석")
    preventive_measures = Column(Text, nullable=True, comment="재발 방지 대책")

    # 담당자 및 일정
    responsible_person_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="담당자 ID"
    )
    planned_completion_date = Column(Date, nullable=False, comment="완료 예정일")
    actual_completion_date = Column(Date, nullable=True, comment="실제 완료일")

    # 실행 결과
    result_description = Column(Text, nullable=True, comment="실행 결과 설명")
    result_evidence_id = Column(
        Integer, ForeignKey("evidences.id"), nullable=True, comment="결과 증적 ID"
    )

    # 검증
    verified_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="검증자 ID"
    )
    verified_at = Column(DateTime, nullable=True, comment="검증 일시")
    verification_result = Column(
        String(20), nullable=True, comment="검증 결과 (approved/rejected)"
    )
    verification_comment = Column(Text, nullable=True, comment="검증 의견")

    # 상태
    status = Column(
        String(20),
        default="planned",
        nullable=False,
        comment="상태 (planned/in_progress/completed/verified)",
    )

    # 관계
    non_conformity = relationship("NonConformity", back_populates="corrective_actions")
    responsible_person = relationship("User", foreign_keys=[responsible_person_id], backref="responsible_actions")
    verifier = relationship("User", foreign_keys=[verified_by], backref="verified_actions")
    result_evidence = relationship("Evidence", backref="corrective_actions")

    def __repr__(self) -> str:
        return f"<CorrectiveAction(id={self.id}, status={self.status})>"
