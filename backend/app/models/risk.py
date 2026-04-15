"""
위험 관리 모델
Phase 2: FR-601 ~ FR-606

위협 DB, 취약점 DB, 위험 평가, DoA 관리, 위험 처리 계획, SOA 관리
"""
from datetime import datetime, date, timezone
from typing import Optional


def utc_now():
    """UTC 현재 시간 반환 (datetime.utcnow() deprecated 대체)"""
    return datetime.now(timezone.utc)

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


# ========== 위협 DB 모델 (FR-601) ==========


class ThreatCategory(Base):
    """
    위협 분류 모델 (FR-601)
    위협을 분류하기 위한 카테고리 (계층 구조 지원)
    """

    __tablename__ = "threat_categories"

    code = Column(
        String(50), unique=True, nullable=False, index=True, comment="위협 분류 코드"
    )
    name = Column(String(100), nullable=False, comment="위협 분류명")
    description = Column(String(500), nullable=True, comment="설명")
    parent_id = Column(
        Integer, ForeignKey("threat_categories.id"), nullable=True, comment="상위 분류 ID"
    )
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # 관계 (자기참조)
    parent = relationship(
        "ThreatCategory", remote_side="ThreatCategory.id", backref="children"
    )
    threats = relationship("Threat", back_populates="category")

    def __repr__(self) -> str:
        return f"<ThreatCategory(id={self.id}, code={self.code}, name={self.name})>"


class Threat(Base):
    """
    위협 모델 (FR-601)
    정보자산에 대한 위협 정의
    """

    __tablename__ = "threats"

    code = Column(
        String(50), unique=True, nullable=False, index=True, comment="위협 코드"
    )
    name = Column(String(200), nullable=False, comment="위협명")
    description = Column(Text, nullable=True, comment="위협 설명")
    category_id = Column(
        Integer, ForeignKey("threat_categories.id"), nullable=True, comment="위협 분류 ID"
    )
    threat_level = Column(
        Integer, nullable=False, default=2, comment="위협 등급 (1: 하, 2: 중, 3: 상)"
    )
    is_custom = Column(
        Boolean, default=False, nullable=False, comment="커스텀 위협 여부"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # 관계
    category = relationship("ThreatCategory", back_populates="threats")
    asset_type_threats = relationship("AssetTypeThreat", back_populates="threat")
    risk_assessments = relationship("RiskAssessment", back_populates="threat")

    def __repr__(self) -> str:
        return f"<Threat(id={self.id}, code={self.code}, name={self.name}, level={self.threat_level})>"


class AssetTypeThreat(Base):
    """
    자산 유형-위협 연결 테이블 (FR-601)
    특정 자산 유형에 해당하는 위협 매핑
    """

    __tablename__ = "asset_type_threats"

    asset_type_id = Column(
        Integer, ForeignKey("asset_types.id"), nullable=False, index=True, comment="자산 유형 ID"
    )
    threat_id = Column(
        Integer, ForeignKey("threats.id"), nullable=False, index=True, comment="위협 ID"
    )
    relevance_score = Column(
        Float, default=1.0, nullable=False, comment="관련성 점수 (0.0 ~ 1.0)"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # 관계
    asset_type = relationship("AssetType", backref="threat_mappings")
    threat = relationship("Threat", back_populates="asset_type_threats")

    def __repr__(self) -> str:
        return f"<AssetTypeThreat(asset_type_id={self.asset_type_id}, threat_id={self.threat_id})>"


# ========== 취약점 DB 모델 (FR-602) ==========


class VulnerabilityCategory(Base):
    """
    취약점 분류 모델 (FR-602)
    취약점을 분류하기 위한 카테고리 (계층 구조 지원)
    """

    __tablename__ = "vulnerability_categories"

    code = Column(
        String(50), unique=True, nullable=False, index=True, comment="취약점 분류 코드"
    )
    name = Column(String(100), nullable=False, comment="취약점 분류명")
    description = Column(String(500), nullable=True, comment="설명")
    parent_id = Column(
        Integer,
        ForeignKey("vulnerability_categories.id"),
        nullable=True,
        comment="상위 분류 ID",
    )
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # 관계 (자기참조)
    parent = relationship(
        "VulnerabilityCategory",
        remote_side="VulnerabilityCategory.id",
        backref="children",
    )
    vulnerabilities = relationship("Vulnerability", back_populates="category")

    def __repr__(self) -> str:
        return f"<VulnerabilityCategory(id={self.id}, code={self.code}, name={self.name})>"


class Vulnerability(Base):
    """
    취약점 모델 (FR-602)
    정보자산의 취약점 정의
    """

    __tablename__ = "vulnerabilities"

    code = Column(
        String(50), unique=True, nullable=False, index=True, comment="취약점 코드"
    )
    name = Column(String(200), nullable=False, comment="취약점명")
    description = Column(Text, nullable=True, comment="취약점 설명")
    category_id = Column(
        Integer,
        ForeignKey("vulnerability_categories.id"),
        nullable=True,
        comment="취약점 분류 ID",
    )
    vulnerability_level = Column(
        Integer, nullable=False, default=2, comment="취약점 등급 (1: 하, 2: 중, 3: 상)"
    )
    is_custom = Column(
        Boolean, default=False, nullable=False, comment="커스텀 취약점 여부"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # 관계
    category = relationship("VulnerabilityCategory", back_populates="vulnerabilities")
    assessments = relationship("VulnerabilityAssessment", back_populates="vulnerability")
    risk_assessments = relationship("RiskAssessment", back_populates="vulnerability")

    def __repr__(self) -> str:
        return f"<Vulnerability(id={self.id}, code={self.code}, name={self.name}, level={self.vulnerability_level})>"


class VulnerabilityAssessment(Base):
    """
    취약점 점검 결과 모델 (FR-602)
    자산별 취약점 점검 결과 기록
    """

    __tablename__ = "vulnerability_assessments"

    asset_id = Column(
        Integer, ForeignKey("assets.id"), nullable=False, index=True, comment="자산 ID"
    )
    vulnerability_id = Column(
        Integer,
        ForeignKey("vulnerabilities.id"),
        nullable=False,
        index=True,
        comment="취약점 ID",
    )
    is_vulnerable = Column(
        Boolean, default=False, nullable=False, comment="취약 여부"
    )
    assessment_date = Column(Date, nullable=False, comment="점검일")
    assessed_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="점검자 ID"
    )
    findings = Column(Text, nullable=True, comment="점검 결과/발견 사항")
    remediation_status = Column(
        String(20),
        nullable=False,
        default="open",
        comment="조치 상태 (open/in_progress/closed/accepted)",
    )
    remediation_date = Column(Date, nullable=True, comment="조치 완료일")
    remarks = Column(Text, nullable=True, comment="비고")

    # 관계
    asset = relationship("Asset", backref="vulnerability_assessments")
    vulnerability = relationship("Vulnerability", back_populates="assessments")
    assessor = relationship("User", foreign_keys=[assessed_by])

    def __repr__(self) -> str:
        return f"<VulnerabilityAssessment(id={self.id}, asset_id={self.asset_id}, vulnerability_id={self.vulnerability_id})>"


# ========== 위험 평가 모델 (FR-603) ==========


class RiskScenario(Base):
    """
    위험 평가 시나리오 모델 (FR-603)
    위험 평가 수행 단위 (연간/반기별/특별 평가 등)
    """

    __tablename__ = "risk_scenarios"

    name = Column(String(200), nullable=False, comment="시나리오명")
    description = Column(Text, nullable=True, comment="시나리오 설명")
    start_date = Column(Date, nullable=False, comment="평가 시작일")
    end_date = Column(Date, nullable=True, comment="평가 종료일")
    status = Column(
        String(20),
        nullable=False,
        default="draft",
        comment="상태 (draft/in_progress/completed/cancelled)",
    )
    created_by = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="생성자 ID"
    )
    completed_at = Column(DateTime, nullable=True, comment="완료 일시")

    # 관계
    creator = relationship("User", foreign_keys=[created_by], backref="created_scenarios")
    assessments = relationship(
        "RiskAssessment", back_populates="scenario", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<RiskScenario(id={self.id}, name={self.name}, status={self.status})>"


class RiskAssessment(Base):
    """
    위험 평가 모델 (FR-603)
    자산-위협-취약점 조합에 대한 위험 평가
    위험도(DoR) = 자산가치 x 위협등급 x 취약점등급
    """

    __tablename__ = "risk_assessments"

    scenario_id = Column(
        Integer,
        ForeignKey("risk_scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="시나리오 ID",
    )
    asset_id = Column(
        Integer, ForeignKey("assets.id"), nullable=False, index=True, comment="자산 ID"
    )
    threat_id = Column(
        Integer, ForeignKey("threats.id"), nullable=False, index=True, comment="위협 ID"
    )
    vulnerability_id = Column(
        Integer,
        ForeignKey("vulnerabilities.id"),
        nullable=False,
        index=True,
        comment="취약점 ID",
    )

    # 평가 값 (1: 하, 2: 중, 3: 상)
    asset_value = Column(
        Integer, nullable=False, default=1, comment="자산 가치 (1: 하, 2: 중, 3: 상)"
    )
    threat_level = Column(
        Integer, nullable=False, default=1, comment="위협 등급 (1: 하, 2: 중, 3: 상)"
    )
    vulnerability_level = Column(
        Integer, nullable=False, default=1, comment="취약점 등급 (1: 하, 2: 중, 3: 상)"
    )

    # 자동 계산 필드
    risk_score = Column(
        Integer, nullable=True, comment="위험도 점수 (DoR = 자산가치 x 위협 x 취약점)"
    )
    risk_level = Column(
        String(10), nullable=True, comment="위험 등급 (high/medium/low)"
    )

    # 평가 정보
    evaluated_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="평가자 ID"
    )
    evaluated_at = Column(DateTime, nullable=True, comment="평가 일시")
    remarks = Column(Text, nullable=True, comment="평가 의견")

    # 관계
    scenario = relationship("RiskScenario", back_populates="assessments")
    asset = relationship("Asset", backref="risk_assessments")
    threat = relationship("Threat", back_populates="risk_assessments")
    vulnerability = relationship("Vulnerability", back_populates="risk_assessments")
    evaluator = relationship("User", foreign_keys=[evaluated_by])
    treatment_plans = relationship(
        "RiskTreatmentPlan", back_populates="risk_assessment", cascade="all, delete-orphan"
    )

    @property
    def exceeds_doa(self) -> bool:
        """현재 활성화된 DoA 초과 여부 (세션 필요)"""
        # 이 속성은 쿼리 시점에 계산됨
        # 실제로는 서비스 레이어에서 DoA 설정과 비교
        return self._exceeds_doa if hasattr(self, "_exceeds_doa") else False

    @exceeds_doa.setter
    def exceeds_doa(self, value: bool):
        self._exceeds_doa = value

    def __repr__(self) -> str:
        return f"<RiskAssessment(id={self.id}, score={self.risk_score}, level={self.risk_level})>"


# 위험도 자동 계산 이벤트
@event.listens_for(RiskAssessment, "before_insert")
@event.listens_for(RiskAssessment, "before_update")
def calculate_risk_score(mapper, connection, target):
    """
    DoR(위험도) 자동 계산
    공식: DoR = 자산가치 x 위협등급 x 취약점등급
    위험 등급 분류:
    - 고위험(high): DoR >= 18
    - 중위험(medium): 8 <= DoR < 18
    - 저위험(low): DoR < 8
    """
    if target.asset_value and target.threat_level and target.vulnerability_level:
        target.risk_score = (
            target.asset_value * target.threat_level * target.vulnerability_level
        )

        # 위험 등급 분류
        if target.risk_score >= 18:
            target.risk_level = "high"
        elif target.risk_score >= 8:
            target.risk_level = "medium"
        else:
            target.risk_level = "low"


# ========== DoA 관리 모델 (FR-604) ==========


class DoAConfig(Base):
    """
    DoA(Degree of Acceptance) 설정 모델 (FR-604)
    위험 수용 기준 설정
    """

    __tablename__ = "doa_configs"

    threshold_value = Column(
        Integer, nullable=False, comment="DoA 임계값 (이 값 이상이면 DoA 초과)"
    )
    effective_date = Column(Date, nullable=False, comment="적용 시작일")
    expiry_date = Column(Date, nullable=True, comment="적용 종료일")
    approved_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="승인자 ID"
    )
    approval_date = Column(Date, nullable=True, comment="승인일")
    remarks = Column(Text, nullable=True, comment="비고")
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # 관계
    approver = relationship("User", foreign_keys=[approved_by], backref="approved_doa_configs")
    histories = relationship(
        "DoAHistory", back_populates="doa_config", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<DoAConfig(id={self.id}, threshold={self.threshold_value}, active={self.is_active})>"


class DoAHistory(Base):
    """
    DoA 변경 이력 모델 (FR-604)
    DoA 설정 변경 이력 추적
    """

    __tablename__ = "doa_histories"

    doa_config_id = Column(
        Integer,
        ForeignKey("doa_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="DoA 설정 ID",
    )
    old_threshold = Column(Integer, nullable=True, comment="변경 전 임계값")
    new_threshold = Column(Integer, nullable=False, comment="변경 후 임계값")
    change_reason = Column(Text, nullable=True, comment="변경 사유")
    changed_by = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="변경자 ID"
    )
    changed_at = Column(
        DateTime(timezone=True), default=utc_now, nullable=False, comment="변경 일시"
    )

    # 관계
    doa_config = relationship("DoAConfig", back_populates="histories")
    changer = relationship("User", foreign_keys=[changed_by])

    def __repr__(self) -> str:
        return f"<DoAHistory(id={self.id}, old={self.old_threshold}, new={self.new_threshold})>"


# ========== 위험 처리 계획 모델 (FR-605) ==========


class RiskTreatmentPlan(Base):
    """
    위험 처리 계획 모델 (FR-605)
    DoA 초과 위험에 대한 처리 계획
    """

    __tablename__ = "risk_treatment_plans"

    risk_assessment_id = Column(
        Integer,
        ForeignKey("risk_assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="위험 평가 ID",
    )
    strategy = Column(
        String(20),
        nullable=False,
        comment="처리 전략 (reduce: 감소, avoid: 회피, transfer: 전가, accept: 수용)",
    )
    description = Column(Text, nullable=True, comment="처리 계획 설명")
    assignee_id = Column(
        Integer, ForeignKey("personnel.id"), nullable=True, comment="담당자 ID (personnel)"
    )
    due_date = Column(Date, nullable=True, comment="완료 예정일")
    budget = Column(Integer, nullable=True, comment="예산 (원)")
    status = Column(
        String(20),
        nullable=False,
        default="planned",
        comment="상태 (planned/in_progress/completed/cancelled)",
    )
    completed_at = Column(DateTime, nullable=True, comment="완료 일시")

    # 관계
    risk_assessment = relationship("RiskAssessment", back_populates="treatment_plans")
    assignee = relationship("Personnel", foreign_keys=[assignee_id], backref="assigned_treatments")
    actions = relationship(
        "RiskTreatmentAction", back_populates="plan", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<RiskTreatmentPlan(id={self.id}, strategy={self.strategy}, status={self.status})>"


class RiskTreatmentAction(Base):
    """
    위험 처리 조치 결과 모델 (FR-605)
    위험 처리 계획에 대한 실행 결과
    """

    __tablename__ = "risk_treatment_actions"

    plan_id = Column(
        Integer,
        ForeignKey("risk_treatment_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="처리 계획 ID",
    )
    action_description = Column(Text, nullable=False, comment="조치 내용")
    result = Column(Text, nullable=True, comment="조치 결과")
    residual_risk_score = Column(
        Integer, nullable=True, comment="잔여 위험 점수"
    )
    completed_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="완료자 ID"
    )
    completed_at = Column(DateTime, nullable=True, comment="완료 일시")
    evidence_file_path = Column(String(500), nullable=True, comment="증적 파일 경로")

    # 관계
    plan = relationship("RiskTreatmentPlan", back_populates="actions")
    completer = relationship("User", foreign_keys=[completed_by])

    def __repr__(self) -> str:
        return f"<RiskTreatmentAction(id={self.id}, plan_id={self.plan_id}, residual_score={self.residual_risk_score})>"


# ========== SOA 관련 모델 (FR-606) ==========


class SOARecord(Base):
    """
    SOA(Statement of Applicability) 레코드 모델 (FR-606)
    통제항목별 적용성 선언
    """

    __tablename__ = "soa_records"

    control_item_id = Column(
        Integer,
        ForeignKey("control_items.id"),
        nullable=False,
        unique=True,
        index=True,
        comment="통제항목 ID",
    )
    is_applicable = Column(
        Boolean, default=True, nullable=False, comment="적용 여부"
    )
    exclusion_reason = Column(Text, nullable=True, comment="제외 사유 (미적용 시)")
    implementation_status = Column(
        String(30),
        nullable=False,
        default="not_implemented",
        comment="구현 상태 (fully_implemented/partially_implemented/planned/not_implemented/not_applicable)",
    )
    implementation_evidence = Column(Text, nullable=True, comment="구현 증적 설명")
    related_assets = Column(Text, nullable=True, comment="관련 자산 목록")
    related_risks = Column(Text, nullable=True, comment="관련 위험 목록")
    remarks = Column(Text, nullable=True, comment="비고")

    # 관계
    control_item = relationship("ControlItem", backref="soa_record")

    def __repr__(self) -> str:
        return f"<SOARecord(id={self.id}, control_item_id={self.control_item_id}, applicable={self.is_applicable})>"


# ========== 위험-통제항목 연계 모델 (FR-607, 5.4) ==========


class RiskTreatmentControlLink(Base):
    """
    위험 처리 계획-통제항목 연결 모델 (5.4.1)

    위험 처리 계획과 통제항목 간의 N:M 관계를 관리합니다.

    Attributes:
        treatment_plan_id: 위험 처리 계획 ID
        control_item_id: 통제항목 ID
        link_type: 연결 유형 (primary: 주요, secondary: 부차적, related: 관련)
        effectiveness_rating: 효과성 등급 (0.0 ~ 1.0)
        created_by: 생성자 ID
        remarks: 비고
    """

    __tablename__ = "risk_treatment_control_links"

    treatment_plan_id = Column(
        Integer,
        ForeignKey("risk_treatment_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="위험 처리 계획 ID",
    )
    control_item_id = Column(
        Integer,
        ForeignKey("control_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="통제항목 ID",
    )
    link_type = Column(
        String(20),
        nullable=False,
        default="primary",
        comment="연결 유형 (primary: 주요, secondary: 부차적, related: 관련)",
    )
    effectiveness_rating = Column(
        Float,
        nullable=True,
        default=None,
        comment="효과성 등급 (0.0 ~ 1.0)",
    )
    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        comment="생성자 ID",
    )
    remarks = Column(Text, nullable=True, comment="비고")

    # 관계
    treatment_plan = relationship(
        "RiskTreatmentPlan",
        backref="control_links",
    )
    control_item = relationship(
        "ControlItem",
        backref="treatment_links",
    )
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return (
            f"<RiskTreatmentControlLink(id={self.id}, "
            f"treatment_plan_id={self.treatment_plan_id}, "
            f"control_item_id={self.control_item_id}, "
            f"link_type={self.link_type})>"
        )
