from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base

# 증적-통제항목 다대다 연결 테이블
control_item_evidences = Table(
    "control_item_evidences",
    Base.metadata,
    Column("control_item_id", Integer, ForeignKey("control_items.id"), primary_key=True),
    Column("evidence_id", Integer, ForeignKey("evidences.id"), primary_key=True),
    Column("created_at", DateTime, default=datetime.utcnow, nullable=False),
    Column("created_by", Integer, ForeignKey("users.id"), nullable=True),
)


class Evidence(Base):
    """
    증적 모델
    """

    __tablename__ = "evidences"

    title = Column(String(255), nullable=False, comment="증적 제목")
    description = Column(Text, nullable=True, comment="증적 설명")

    # 파일 정보
    file_path = Column(String(500), nullable=False, comment="MinIO 파일 경로")
    file_name = Column(String(255), nullable=False, comment="원본 파일명")
    file_size = Column(Integer, nullable=False, comment="파일 크기 (bytes)")
    file_hash = Column(String(64), nullable=False, comment="SHA256 파일 해시")
    mime_type = Column(String(100), nullable=True, comment="MIME 타입")

    # 증적 메타데이터
    version = Column(String(20), default="1.0", nullable=False, comment="버전")
    status = Column(
        String(20),
        default="active",
        nullable=False,
        comment="상태 (active/expired/archived)",
    )

    # 증적 출처 분리
    # - library: 일반 ISMS 인증 증적 (증적 관리 메뉴)
    # - nc_finding: 부적합 발견 시 수집된 증적 (결함 증적 관리 메뉴)
    # 기존 엔드포인트는 default=library 로 동작을 유지하고, NC 업로드 경로에서만 nc_finding 으로 생성한다.
    source = Column(
        String(20),
        default="library",
        nullable=False,
        index=True,
        comment="증적 출처 (library: 일반 증적 / nc_finding: 결함 증적)",
    )

    # 유효기간
    valid_from = Column(Date, nullable=True, comment="유효 시작일")
    valid_until = Column(Date, nullable=True, comment="유효 만료일")

    # 증적 작성자 및 업로더
    uploader_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="업로드한 사용자 ID"
    )
    author = Column(String(100), nullable=True, comment="증적 작성자")

    # 검토 정보
    reviewed_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="검토자 ID"
    )
    reviewed_at = Column(DateTime, nullable=True, comment="검토 일시")
    review_comment = Column(Text, nullable=True, comment="검토 의견")

    # 관계
    uploader = relationship("User", foreign_keys=[uploader_id], backref="uploaded_evidences")
    reviewer = relationship("User", foreign_keys=[reviewed_by], backref="reviewed_evidences")
    control_items = relationship(
        "ControlItem",
        secondary=control_item_evidences,
        back_populates="evidences",
    )
    versions = relationship("EvidenceVersion", back_populates="evidence", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Evidence(id={self.id}, title={self.title}, version={self.version})>"


class EvidenceVersion(Base):
    """
    증적 버전 히스토리 모델
    """

    __tablename__ = "evidence_versions"

    evidence_id = Column(
        Integer, ForeignKey("evidences.id"), nullable=False, comment="증적 ID"
    )
    version = Column(String(20), nullable=False, comment="버전")
    file_path = Column(String(500), nullable=False, comment="파일 경로")
    file_name = Column(String(255), nullable=False, comment="파일명")
    file_size = Column(Integer, nullable=False, comment="파일 크기")
    file_hash = Column(String(64), nullable=False, comment="파일 해시")
    uploaded_by = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="업로드한 사용자 ID"
    )
    change_description = Column(Text, nullable=True, comment="변경 설명")

    # 관계
    evidence = relationship("Evidence", back_populates="versions")
    uploader = relationship("User", backref="evidence_versions")

    def __repr__(self) -> str:
        return f"<EvidenceVersion(id={self.id}, evidence_id={self.evidence_id}, version={self.version})>"


class EvidenceTemplate(Base):
    """
    증적 템플릿 모델
    """

    __tablename__ = "evidence_templates"

    name = Column(String(255), nullable=False, comment="템플릿명")
    description = Column(Text, nullable=True, comment="템플릿 설명")
    category = Column(
        String(50), nullable=False, comment="템플릿 카테고리 (점검표/서약서/회의록 등)"
    )
    file_path = Column(String(500), nullable=False, comment="템플릿 파일 경로")
    file_name = Column(String(255), nullable=False, comment="템플릿 파일명")
    mime_type = Column(String(100), nullable=True, comment="MIME 타입")
    is_system_template = Column(
        Boolean, default=False, nullable=False, comment="시스템 기본 템플릿 여부"
    )
    created_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="생성자 ID"
    )
    download_count = Column(Integer, default=0, nullable=False, comment="다운로드 횟수")

    # 관계
    creator = relationship("User", backref="created_templates")

    def __repr__(self) -> str:
        return f"<EvidenceTemplate(id={self.id}, name={self.name}, category={self.category})>"


class ControlItemEvidence(Base):
    """
    통제항목-증적 연결 모델 (추가 메타데이터가 필요한 경우)
    """

    __tablename__ = "control_item_evidence_mappings"

    control_item_id = Column(
        Integer, ForeignKey("control_items.id"), nullable=False, comment="통제항목 ID"
    )
    evidence_id = Column(
        Integer, ForeignKey("evidences.id"), nullable=False, comment="증적 ID"
    )
    mapped_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="매핑한 사용자 ID"
    )
    mapping_note = Column(Text, nullable=True, comment="매핑 메모")

    # 관계
    mapper = relationship("User", backref="evidence_mappings")

    def __repr__(self) -> str:
        return f"<ControlItemEvidence(control_item_id={self.control_item_id}, evidence_id={self.evidence_id})>"
