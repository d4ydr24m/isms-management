"""
LLM 보완조치내역서 초안 저장 모델
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class LLMSuggestion(Base):
    """
    로컬 LLM(Qwen2.5-VL 등)이 생성한 '보완조치내역서 초안' 기록

    목적:
    - 동일 부적합에 대한 재생성 이력 조회
    - 심사 감사성 확보 (누가/언제/어떤 모델로 생성했는지)
    - 결함 상세 페이지의 초안 편집 복구용
    """

    __tablename__ = "llm_suggestions"

    non_conformity_id = Column(
        Integer,
        ForeignKey("non_conformities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="부적합 ID",
    )

    # Celery task UUID (큐에 적재한 순간 발급). 폴링 키로 사용.
    task_id = Column(
        String(64), unique=True, nullable=False, index=True, comment="Celery task ID"
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending",
        comment="상태 (pending/running/succeeded/failed)",
    )

    model_name = Column(String(100), nullable=False, comment="사용한 LLM 모델명")

    # 첨부 스크린샷 evidence.id 목록 (JSON 배열 문자열). 소수 이미지라 JSON 컬럼 대신 Text 사용.
    evidence_ids = Column(Text, nullable=True, comment="첨부 증적 ID 목록 (JSON)")

    result_text = Column(Text, nullable=True, comment="생성된 초안 본문")
    error_message = Column(Text, nullable=True, comment="실패 시 사용자용 메시지")

    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="생성 요청자",
    )
    completed_at = Column(DateTime, nullable=True, comment="완료 또는 실패 시각")

    # 관계
    non_conformity = relationship("NonConformity", backref="llm_suggestions")
    creator = relationship("User", backref="llm_suggestions")

    def __repr__(self) -> str:
        return (
            f"<LLMSuggestion(id={self.id}, nc={self.non_conformity_id}, "
            f"status={self.status})>"
        )
