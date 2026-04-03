"""
취약점 점검 스크립트 관리 모델
FR-602 확장: 취약점 점검 스크립트 업로드, 스케줄링, 실행 결과 관리

사용자가 취약점 점검 스크립트를 업로드하고,
자산에 대해 주기적으로 실행하며, 실행 결과를 추적합니다.
"""
from datetime import datetime, timezone

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
)
from sqlalchemy.orm import relationship

from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class VulnCheckScript(Base):
    """
    취약점 점검 스크립트 모델

    사용자가 업로드한 취약점 점검 스크립트 정보를 관리합니다.
    스크립트 파일은 MinIO에 저장되고, 메타데이터만 DB에 기록됩니다.
    """

    __tablename__ = "vuln_check_scripts"

    name = Column(String(200), nullable=False, comment="스크립트명")
    description = Column(Text, nullable=True, comment="스크립트 설명")
    script_type = Column(
        String(50),
        nullable=False,
        comment="스크립트 유형 (python/shell/powershell/custom)",
    )
    file_path = Column(
        String(500), nullable=False, comment="스크립트 파일 저장 경로 (MinIO)"
    )
    file_name = Column(String(255), nullable=False, comment="원본 파일명")
    file_size = Column(Integer, nullable=True, comment="파일 크기 (bytes)")
    version = Column(String(50), nullable=False, default="1.0", comment="스크립트 버전")
    category_id = Column(
        Integer,
        ForeignKey("vulnerability_categories.id"),
        nullable=True,
        comment="취약점 분류 ID",
    )
    target_asset_type_id = Column(
        Integer,
        ForeignKey("asset_types.id"),
        nullable=True,
        comment="대상 자산 유형 ID (NULL이면 전체 자산 대상)",
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    uploaded_by = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="업로더 ID"
    )

    # 관계
    category = relationship("VulnerabilityCategory", backref="check_scripts")
    target_asset_type = relationship("AssetType", backref="vuln_check_scripts")
    uploader = relationship("User", foreign_keys=[uploaded_by], backref="uploaded_vuln_scripts")
    schedules = relationship(
        "VulnCheckSchedule", back_populates="script", cascade="all, delete-orphan"
    )
    executions = relationship(
        "VulnCheckExecution", back_populates="script", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<VulnCheckScript(id={self.id}, name={self.name}, type={self.script_type})>"


class VulnCheckSchedule(Base):
    """
    취약점 점검 스케줄 모델

    스크립트를 특정 자산(들)에 대해 주기적으로 실행하기 위한 스케줄 설정.
    """

    __tablename__ = "vuln_check_schedules"

    script_id = Column(
        Integer,
        ForeignKey("vuln_check_scripts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="스크립트 ID",
    )
    name = Column(String(200), nullable=False, comment="스케줄명")
    description = Column(Text, nullable=True, comment="스케줄 설명")
    cron_expression = Column(
        String(100),
        nullable=False,
        comment="Cron 표현식 (예: 0 2 * * 1 = 매주 월요일 02시)",
    )
    target_asset_ids = Column(
        Text,
        nullable=True,
        comment="대상 자산 ID 목록 (JSON 배열, NULL이면 해당 유형 전체)",
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    last_run_at = Column(DateTime(timezone=True), nullable=True, comment="마지막 실행 일시")
    next_run_at = Column(DateTime(timezone=True), nullable=True, comment="다음 실행 예정 일시")
    created_by = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="생성자 ID"
    )

    # 관계
    script = relationship("VulnCheckScript", back_populates="schedules")
    creator = relationship("User", foreign_keys=[created_by])
    executions = relationship(
        "VulnCheckExecution", back_populates="schedule", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<VulnCheckSchedule(id={self.id}, name={self.name}, cron={self.cron_expression})>"


class VulnCheckExecution(Base):
    """
    취약점 점검 실행 결과 모델

    스크립트 실행의 이력과 결과를 기록합니다.
    """

    __tablename__ = "vuln_check_executions"

    script_id = Column(
        Integer,
        ForeignKey("vuln_check_scripts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="스크립트 ID",
    )
    schedule_id = Column(
        Integer,
        ForeignKey("vuln_check_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="스케줄 ID (수동 실행 시 NULL)",
    )
    asset_id = Column(
        Integer,
        ForeignKey("assets.id"),
        nullable=False,
        index=True,
        comment="대상 자산 ID",
    )
    status = Column(
        String(20),
        nullable=False,
        default="pending",
        comment="실행 상태 (pending/running/completed/failed/cancelled)",
    )
    started_at = Column(DateTime(timezone=True), nullable=True, comment="실행 시작 일시")
    completed_at = Column(DateTime(timezone=True), nullable=True, comment="실행 완료 일시")
    result_summary = Column(Text, nullable=True, comment="결과 요약")
    result_detail = Column(Text, nullable=True, comment="상세 결과 (JSON)")
    vulnerabilities_found = Column(
        Integer, nullable=True, default=0, comment="발견된 취약점 수"
    )
    severity_high = Column(Integer, nullable=True, default=0, comment="고위험 취약점 수")
    severity_medium = Column(Integer, nullable=True, default=0, comment="중위험 취약점 수")
    severity_low = Column(Integer, nullable=True, default=0, comment="저위험 취약점 수")
    executed_by = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="실행자 ID (수동 실행 시)"
    )
    error_message = Column(Text, nullable=True, comment="에러 메시지 (실패 시)")

    # 관계
    script = relationship("VulnCheckScript", back_populates="executions")
    schedule = relationship("VulnCheckSchedule", back_populates="executions")
    asset = relationship("Asset", backref="vuln_check_executions")
    executor = relationship("User", foreign_keys=[executed_by])

    def __repr__(self) -> str:
        return (
            f"<VulnCheckExecution(id={self.id}, script_id={self.script_id}, "
            f"asset_id={self.asset_id}, status={self.status})>"
        )
