"""
통제항목-증적출처 연결 모델

시스템 내 각 모듈(자산, 위험, 감사 등)의 데이터를 통제항목의 증적 출처로 연결.
예: 자산 목록 → 1.2.1 정보자산 식별
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class ControlEvidenceLink(Base):
    """
    통제항목-증적출처 연결 모델

    시스템 메뉴/모듈의 데이터를 통제항목 증적 출처로 매핑.
    source_type: 모듈 식별자 (assets, risks, audits, evidence, vuln_check 등)
    source_id: 특정 레코드 ID (NULL이면 모듈 전체/목록)
    """

    __tablename__ = "control_evidence_links"

    control_item_id = Column(
        Integer,
        ForeignKey("control_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="통제항목 ID",
    )
    source_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="출처 모듈 (assets, risks, audits, evidence, vuln_check 등)",
    )
    source_id = Column(
        Integer,
        nullable=True,
        comment="출처 레코드 ID (NULL이면 모듈 전체)",
    )
    source_label = Column(
        String(200),
        nullable=False,
        comment="출처 표시명 (예: 자산 목록, 위험 시나리오 목록)",
    )
    source_url = Column(
        String(500),
        nullable=False,
        comment="프론트엔드 라우트 경로 (예: /assets)",
    )
    description = Column(
        Text,
        nullable=True,
        comment="증적 출처 설명",
    )
    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        comment="생성자 ID",
    )

    # 관계
    control_item = relationship("ControlItem", backref="evidence_links")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return (
            f"<ControlEvidenceLink(id={self.id}, "
            f"control={self.control_item_id}, "
            f"source={self.source_type}/{self.source_id})>"
        )
