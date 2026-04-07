"""
ISMS 인증 범위 변경 이력 모델

인증 범위 포함/제외 변경 이력 추적

ISMS-P 관련 통제항목:
- 1.1.1 관리체계 범위 설정: 정보보호 및 개인정보보호 관리체계 범위 설정
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class ScopeEntityType(str, enum.Enum):
    """범위 대상 유형"""
    ASSET = "asset"
    PERSONNEL = "personnel"
    DEPARTMENT = "department"


class IsmsScopeChange(Base):
    """
    ISMS 인증 범위 변경 이력 모델
    자산, 담당자, 부서의 인증 범위 변경 이력 추적
    """

    __tablename__ = "isms_scope_changes"

    entity_type = Column(
        String(20), nullable=False,
        comment="대상 유형 (asset/personnel/department)",
    )
    entity_id = Column(Integer, nullable=False, comment="대상 ID")
    old_scope = Column(Boolean, nullable=False, comment="이전 범위 상태")
    new_scope = Column(Boolean, nullable=False, comment="새 범위 상태")
    reason = Column(String(500), nullable=True, comment="변경 사유")
    changed_by = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="변경자 ID"
    )
    changed_at = Column(
        DateTime(timezone=True), default=utc_now, nullable=False,
        comment="변경 일시",
    )

    # 관계
    changer = relationship("User", foreign_keys=[changed_by])

    def __repr__(self) -> str:
        return (
            f"<IsmsScopeChange(id={self.id}, entity_type={self.entity_type}, "
            f"entity_id={self.entity_id}, {self.old_scope}->{self.new_scope})>"
        )
