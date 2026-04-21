"""
부적합(NonConformity) - 증적(Evidence) 연결 모델.

ControlItemEvidence 와 같은 '명시적 매핑 모델' 패턴을 따른다.
(mapping_note, mapped_by 등 메타데이터가 필요하기 때문)

무엇이 아닌가:
- NonConformity.evidence (Text) 는 근거 내러티브(자유서술)이며, 본 매핑과는 별개이다.
- CorrectiveAction.result_evidence_id 는 조치 완료 증빙(단일 FK)이며 본 매핑과 별개이다.
- 본 모델은 '부적합 조사 단계에서 수집된 증적'의 구조화된 연결을 담당한다.
"""
from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


class NonConformityEvidence(Base):
    """
    부적합-증적 연결 모델 (명시적 매핑 + 메타데이터).

    같은 (non_conformity_id, evidence_id) 조합은 한 번만 존재할 수 있다
    (UniqueConstraint 보장).
    """

    __tablename__ = "nc_evidence_mappings"

    non_conformity_id = Column(
        Integer,
        ForeignKey("non_conformities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="부적합 ID",
    )
    evidence_id = Column(
        Integer,
        ForeignKey("evidences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="증적 ID",
    )
    mapped_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="매핑한 사용자 ID",
    )
    mapping_note = Column(
        Text,
        nullable=True,
        comment="이 증적을 이 부적합에 연결하는 이유/맥락 메모",
    )
    # 증적 역할 — LLM 에 'before/after' 를 명확히 전달하기 위한 분류.
    # before    : 조치 전 (현재 문제 상태)
    # after     : 조치 후 (개선된 상태)
    # support   : 신청서·결재·정책 등 조치 근거 문서
    # reference : 역할 미지정 (기본값; 기존 레코드 호환)
    role = Column(
        String(20),
        nullable=False,
        server_default="reference",
        index=True,
        comment="증적 역할 (before/after/support/reference)",
    )

    __table_args__ = (
        UniqueConstraint(
            "non_conformity_id",
            "evidence_id",
            name="uq_nc_evidence_mappings_nc_evidence",
        ),
    )

    non_conformity = relationship(
        "NonConformity",
        back_populates="evidence_links",
    )
    evidence = relationship("Evidence", backref="nc_links")
    mapper = relationship("User", backref="nc_evidence_mappings")

    def __repr__(self) -> str:
        return (
            f"<NonConformityEvidence(nc_id={self.non_conformity_id}, "
            f"evidence_id={self.evidence_id})>"
        )
