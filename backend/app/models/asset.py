"""
정보자산 관리 모델
Phase 2: FR-501 ~ FR-505

자산 분류 체계, 자산 기본 정보, 가치 평가, 이력 관리, 담당자 관리

ISMS-P 관련 통제항목:
- 2.1.2 정보자산 식별: 정보자산을 식별하고 분류 기준 수립
- 2.1.3 정보자산 관리: 식별된 정보자산의 변동 현황을 최신으로 관리
"""
import enum
from datetime import datetime, date, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    event,
)
from sqlalchemy.orm import relationship, validates

from app.db.base import Base


def utc_now():
    """UTC 현재 시간 반환 (timezone-aware)"""
    return datetime.now(timezone.utc)


# 자산-분류 다대다 연결 테이블
asset_category_mappings = Table(
    "asset_category_mappings",
    Base.metadata,
    Column("asset_id", Integer, ForeignKey("assets.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("asset_categories.id"), primary_key=True),
    Column("created_at", DateTime, default=datetime.now, nullable=False),
)


class AssetStatus(str, enum.Enum):
    """자산 상태"""
    INTRODUCED = "도입"
    OPERATING = "운영"
    CHANGED = "변경"
    DISPOSED = "폐기"


class AssetAssignmentRole(str, enum.Enum):
    """자산 담당자 역할"""
    OWNER = "owner"
    MANAGER = "manager"
    USER = "user"


class AssetChangeType(str, enum.Enum):
    """자산 변경 유형"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    VALUATION = "valuation"
    ASSIGNMENT = "assignment"


class AssetType(Base):
    """
    자산 유형 모델 (FR-501)
    서버, 네트워크장비, 보안장비, DB, 애플리케이션, PC/노트북, 문서, 인력 등
    """

    __tablename__ = "asset_types"

    code = Column(
        String(20), unique=True, nullable=False, index=True, comment="자산 유형 코드"
    )
    name = Column(String(100), nullable=False, comment="자산 유형명")
    description = Column(String(500), nullable=True, comment="설명")
    icon = Column(String(50), nullable=True, comment="아이콘 이름")
    is_custom = Column(
        Boolean, default=False, nullable=False, comment="커스텀 유형 여부"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")

    # 관계
    assets = relationship("Asset", back_populates="asset_type")

    def __repr__(self) -> str:
        return f"<AssetType(id={self.id}, code={self.code}, name={self.name})>"


class AssetCategory(Base):
    """
    자산 분류 모델 (FR-501)
    계층 구조: 대분류 → 중분류 → 소분류 (self-referential FK)
    """

    __tablename__ = "asset_categories"

    MAX_LEVEL = 3  # 대분류/중분류/소분류

    code = Column(
        String(50), unique=True, nullable=False, index=True, comment="분류 코드"
    )
    name = Column(String(100), nullable=False, comment="분류명")
    description = Column(String(500), nullable=True, comment="설명")
    level = Column(
        Integer, nullable=False, default=1, comment="분류 레벨 (1: 대분류, 2: 중분류, 3: 소분류)"
    )
    parent_id = Column(
        Integer, ForeignKey("asset_categories.id"), nullable=True, comment="상위 분류 ID"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")

    # 관계 (자기참조)
    parent = relationship(
        "AssetCategory", remote_side="AssetCategory.id", backref="children"
    )
    assets = relationship("Asset", secondary=asset_category_mappings, back_populates="categories")

    @validates('level')
    def validate_level(self, key, value):
        if value > self.MAX_LEVEL:
            raise ValueError(f"자산 분류 레벨은 {self.MAX_LEVEL}을 초과할 수 없습니다.")
        return value

    def __repr__(self) -> str:
        return f"<AssetCategory(id={self.id}, code={self.code}, name={self.name}, level={self.level})>"


class Asset(Base):
    """
    자산 기본 모델 (FR-502)
    정보자산의 기본 정보 및 상태 관리
    """

    __tablename__ = "assets"

    # 기본 식별 정보
    asset_code = Column(
        String(50), unique=True, nullable=False, index=True, comment="자산코드 (자동 채번)"
    )
    name = Column(String(200), nullable=False, comment="자산명")
    description = Column(Text, nullable=True, comment="자산 설명")

    # 분류 정보
    asset_type_id = Column(
        Integer, ForeignKey("asset_types.id"), nullable=False, comment="자산 유형 ID"
    )

    # 위치 및 소속
    location = Column(String(200), nullable=True, comment="물리적 위치")
    department_id = Column(
        Integer, ForeignKey("departments.id"), nullable=True, comment="담당 부서 ID"
    )
    owner_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="자산 소유자 ID"
    )
    personnel_owner_id = Column(
        Integer, ForeignKey("personnel.id"), nullable=True, comment="자산 소유자 ID (담당자)"
    )

    # 상세 정보
    ip_address = Column(String(200), nullable=True, comment="IP 주소 (단일, 범위, CIDR 지원)")
    mac_address = Column(String(50), nullable=True, comment="MAC 주소")
    hostname = Column(String(100), nullable=True, comment="호스트명")
    os_version = Column(String(100), nullable=True, comment="OS 버전")
    url = Column(String(500), nullable=True, comment="URL")
    service_version = Column(String(100), nullable=True, comment="버전 정보")
    serial_number = Column(String(100), nullable=True, comment="시리얼 번호")
    manufacturer = Column(String(100), nullable=True, comment="제조사")
    model = Column(String(100), nullable=True, comment="모델명")
    specifications = Column(Text, nullable=True, comment="사양 (JSON)")

    # 취득 및 폐기 정보
    acquisition_date = Column(Date, nullable=True, comment="취득일")
    acquisition_cost = Column(Integer, nullable=True, comment="취득 비용")
    warranty_end_date = Column(Date, nullable=True, comment="보증 만료일")
    eol_date = Column(Date, nullable=True, comment="EoL (End of Life) 만료일")
    disposal_date = Column(Date, nullable=True, comment="폐기일")

    # 상태 정보 - Enum 사용으로 데이터 무결성 보장
    status = Column(
        String(20),
        nullable=False,
        default=AssetStatus.INTRODUCED.value,
        comment="상태 (도입/운영/변경/폐기)",
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # ISMS 인증 범위
    in_isms_scope = Column(
        Boolean, default=True, nullable=False, comment="ISMS 인증 범위 포함 여부"
    )
    scope_reason = Column(String(500), nullable=True, comment="범위 포함/제외 사유")

    # 관계
    asset_type = relationship("AssetType", back_populates="assets")
    categories = relationship("AssetCategory", secondary=asset_category_mappings, back_populates="assets")
    department = relationship("Department", backref="assets")
    owner = relationship("User", foreign_keys=[owner_id], backref="owned_assets")
    personnel_owner = relationship("Personnel", foreign_keys=[personnel_owner_id])
    valuations = relationship(
        "AssetValuation", back_populates="asset", cascade="all, delete-orphan"
    )
    histories = relationship(
        "AssetHistory", back_populates="asset", cascade="all, delete-orphan"
    )
    assignments = relationship(
        "AssetAssignment", back_populates="asset", cascade="all, delete-orphan"
    )
    disposals = relationship(
        "AssetDisposal", back_populates="asset", cascade="all, delete-orphan"
    )
    handovers = relationship(
        "AssetHandover", back_populates="asset", cascade="all, delete-orphan"
    )

    @validates('status')
    def validate_status(self, key, value):
        """자산 상태 검증"""
        valid_statuses = [s.value for s in AssetStatus]
        if value not in valid_statuses:
            raise ValueError(f"유효하지 않은 자산 상태입니다. 허용값: {valid_statuses}")
        return value

    def __repr__(self) -> str:
        return f"<Asset(id={self.id}, code={self.asset_code}, name={self.name}, status={self.status})>"


class AssetValuation(Base):
    """
    자산 가치 평가 모델 (FR-503)
    CIA (기밀성, 무결성, 가용성) 평가 및 자산 중요도 산정
    """

    __tablename__ = "asset_valuations"
    __table_args__ = (
        CheckConstraint('confidentiality >= 1 AND confidentiality <= 3', name='ck_confidentiality_range'),
        CheckConstraint('integrity >= 1 AND integrity <= 3', name='ck_integrity_range'),
        CheckConstraint('availability >= 1 AND availability <= 3', name='ck_availability_range'),
    )

    asset_id = Column(
        Integer, ForeignKey("assets.id"), nullable=False, index=True, comment="자산 ID"
    )

    # CIA 평가 (1: 하, 2: 중, 3: 상)
    confidentiality = Column(
        Integer, nullable=False, default=1, comment="기밀성 (1: 하, 2: 중, 3: 상)"
    )
    integrity = Column(
        Integer, nullable=False, default=1, comment="무결성 (1: 하, 2: 중, 3: 상)"
    )
    availability = Column(
        Integer, nullable=False, default=1, comment="가용성 (1: 하, 2: 중, 3: 상)"
    )

    # 중요도 (자동 계산: MAX 또는 가중평균)
    importance_level = Column(
        Integer, nullable=True, comment="자산 중요도 (자동 계산)"
    )

    # 평가 정보
    evaluation_reason = Column(Text, nullable=True, comment="평가 사유")
    evaluated_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="평가자 ID"
    )
    evaluated_at = Column(DateTime, nullable=True, comment="평가 일시")

    # 관계
    asset = relationship("Asset", back_populates="valuations")
    evaluator = relationship("User", foreign_keys=[evaluated_by])

    @validates('confidentiality', 'integrity', 'availability')
    def validate_cia_range(self, key, value):
        """CIA 값 범위 검증 (1-3)"""
        if value is not None and not (1 <= value <= 3):
            raise ValueError(f"{key}는 1-3 사이의 값이어야 합니다. 입력값: {value}")
        return value

    def __repr__(self) -> str:
        return f"<AssetValuation(id={self.id}, asset_id={self.asset_id}, C={self.confidentiality}, I={self.integrity}, A={self.availability})>"


# 중요도 자동 계산 이벤트
@event.listens_for(AssetValuation, "before_insert")
@event.listens_for(AssetValuation, "before_update")
def calculate_importance_level(mapper, connection, target):
    """CIA 값 기준 중요도 자동 계산 (MAX 방식)"""
    if target.confidentiality and target.integrity and target.availability:
        target.importance_level = max(
            target.confidentiality, target.integrity, target.availability
        )


class AssetHistory(Base):
    """
    자산 변경 이력 모델 (FR-504)
    자산 정보 변경 이력 추적
    """

    __tablename__ = "asset_histories"

    asset_id = Column(
        Integer, ForeignKey("assets.id"), nullable=False, index=True, comment="자산 ID"
    )

    # 변경 정보 - Enum 사용
    change_type = Column(
        String(20),
        nullable=False,
        comment="변경 유형 (create/update/delete/valuation/assignment)",
    )
    field_name = Column(String(100), nullable=True, comment="변경 필드명")
    old_value = Column(Text, nullable=True, comment="이전 값")
    new_value = Column(Text, nullable=True, comment="새 값")

    # 변경자 정보
    changed_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="변경자 ID"
    )
    changed_at = Column(
        DateTime, default=utc_now, nullable=False, comment="변경 일시"
    )
    remarks = Column(Text, nullable=True, comment="비고")

    # 관계
    asset = relationship("Asset", back_populates="histories")
    changer = relationship("User", foreign_keys=[changed_by])

    @validates('change_type')
    def validate_change_type(self, key, value):
        """변경 유형 검증"""
        valid_types = [t.value for t in AssetChangeType]
        if value not in valid_types:
            raise ValueError(f"유효하지 않은 변경 유형입니다. 허용값: {valid_types}")
        return value

    def __repr__(self) -> str:
        return f"<AssetHistory(id={self.id}, asset_id={self.asset_id}, change_type={self.change_type})>"


class AssetDisposal(Base):
    """
    자산 폐기 모델 (FR-504)
    자산 폐기 시 상세 정보 및 데이터 삭제 증적 관리
    """

    __tablename__ = "asset_disposals"

    asset_id = Column(
        Integer, ForeignKey("assets.id"), nullable=False, index=True, comment="자산 ID"
    )

    # 폐기 정보
    disposal_date = Column(Date, nullable=False, comment="폐기일")
    disposal_reason = Column(Text, nullable=True, comment="폐기 사유")
    disposal_method = Column(String(100), nullable=True, comment="폐기 방법")

    # 데이터 삭제 증적
    data_deletion_confirmed = Column(
        Boolean, default=False, nullable=False, comment="데이터 삭제 확인"
    )
    data_deletion_method = Column(String(200), nullable=True, comment="데이터 삭제 방법")
    data_deletion_evidence_id = Column(
        Integer, ForeignKey("evidences.id"), nullable=True, comment="데이터 삭제 증적 ID"
    )

    # 승인 정보
    approved_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="승인자 ID"
    )
    approved_at = Column(DateTime, nullable=True, comment="승인 일시")
    remarks = Column(Text, nullable=True, comment="비고")

    # 관계
    asset = relationship("Asset", back_populates="disposals")
    approver = relationship("User", foreign_keys=[approved_by])

    def __repr__(self) -> str:
        return f"<AssetDisposal(id={self.id}, asset_id={self.asset_id}, disposal_date={self.disposal_date})>"


class AssetAssignment(Base):
    """
    자산-담당자 할당 모델 (FR-505)
    자산별 담당자 (소유자/관리자/사용자) 관리
    """

    __tablename__ = "asset_assignments"

    asset_id = Column(
        Integer, ForeignKey("assets.id"), nullable=False, index=True, comment="자산 ID"
    )
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, index=True, comment="시스템 사용자 ID"
    )
    personnel_id = Column(
        Integer, ForeignKey("personnel.id"), nullable=True, index=True, comment="담당자 ID"
    )

    # 역할 정보 - Enum 사용
    role = Column(
        String(20),
        nullable=False,
        default=AssetAssignmentRole.USER.value,
        comment="역할 (owner/manager/user)",
    )

    # 할당 정보
    assigned_at = Column(
        DateTime, default=utc_now, nullable=False, comment="할당 일시"
    )
    assigned_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="할당자 ID"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    remarks = Column(Text, nullable=True, comment="비고")

    # 관계
    asset = relationship("Asset", back_populates="assignments")
    user = relationship("User", foreign_keys=[user_id], backref="asset_assignments")
    personnel = relationship("Personnel", foreign_keys=[personnel_id])
    assigner = relationship("User", foreign_keys=[assigned_by])

    @validates('role')
    def validate_role(self, key, value):
        """담당자 역할 검증"""
        valid_roles = [r.value for r in AssetAssignmentRole]
        if value not in valid_roles:
            raise ValueError(f"유효하지 않은 역할입니다. 허용값: {valid_roles}")
        return value

    def __repr__(self) -> str:
        return f"<AssetAssignment(id={self.id}, asset_id={self.asset_id}, user_id={self.user_id}, role={self.role})>"


class AssetHandover(Base):
    """
    자산 인수인계 모델 (FR-505)
    담당자 변경 시 인수인계 체크리스트 관리
    """

    __tablename__ = "asset_handovers"

    asset_id = Column(
        Integer, ForeignKey("assets.id"), nullable=False, index=True, comment="자산 ID"
    )

    # 인수인계 당사자
    from_user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="인계자 ID"
    )
    to_user_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="인수자 ID"
    )

    # 인수인계 정보
    handover_date = Column(Date, nullable=False, comment="인수인계일")
    checklist_items = Column(Text, nullable=True, comment="체크리스트 항목 (JSON)")
    checklist_completed = Column(
        Boolean, default=False, nullable=False, comment="체크리스트 완료 여부"
    )
    remarks = Column(Text, nullable=True, comment="비고")

    # 승인 정보
    approved_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="승인자 ID"
    )
    approved_at = Column(DateTime, nullable=True, comment="승인 일시")

    # 관계
    asset = relationship("Asset", back_populates="handovers")
    from_user = relationship("User", foreign_keys=[from_user_id], backref="handovers_from")
    to_user = relationship("User", foreign_keys=[to_user_id], backref="handovers_to")
    approver = relationship("User", foreign_keys=[approved_by])

    def __repr__(self) -> str:
        return f"<AssetHandover(id={self.id}, asset_id={self.asset_id}, from={self.from_user_id}, to={self.to_user_id})>"
