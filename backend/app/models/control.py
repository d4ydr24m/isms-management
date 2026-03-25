from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class ControlDomain(Base):
    """
    통제영역 모델 (대분류)
    예: 관리체계 수립 및 운영, 보호대책 요구사항
    """

    __tablename__ = "control_domains"

    code = Column(String(10), unique=True, nullable=False, index=True, comment="영역 코드")
    name = Column(String(100), nullable=False, comment="영역명")
    description = Column(Text, nullable=True, comment="설명")
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")

    # 관계
    categories = relationship("ControlCategory", back_populates="domain", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ControlDomain(id={self.id}, code={self.code}, name={self.name})>"


class ControlCategory(Base):
    """
    통제항목 카테고리 모델 (중분류)
    예: 정보보호 정책, 위험 관리, 접근 통제
    """

    __tablename__ = "control_categories"

    domain_id = Column(
        Integer, ForeignKey("control_domains.id"), nullable=False, comment="영역 ID"
    )
    code = Column(String(10), unique=True, nullable=False, index=True, comment="카테고리 코드")
    name = Column(String(100), nullable=False, comment="카테고리명")
    description = Column(Text, nullable=True, comment="설명")
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")

    # 관계
    domain = relationship("ControlDomain", back_populates="categories")
    control_items = relationship("ControlItem", back_populates="category", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ControlCategory(id={self.id}, code={self.code}, name={self.name})>"


class ControlItem(Base):
    """
    통제항목 모델 (80개 ISMS-P 통제항목)
    예: 1.1.1 정보보호 정책 수립
    """

    __tablename__ = "control_items"

    category_id = Column(
        Integer, ForeignKey("control_categories.id"), nullable=False, comment="카테고리 ID"
    )
    code = Column(
        String(20), unique=True, nullable=False, index=True, comment="통제항목 번호"
    )
    title = Column(String(200), nullable=False, comment="통제항목 제목")
    description = Column(Text, nullable=False, comment="통제항목 설명")
    objective = Column(Text, nullable=True, comment="통제 목적")
    requirements = Column(Text, nullable=True, comment="요구사항")

    # 인증 관련
    is_required = Column(
        Boolean, default=True, nullable=False, comment="필수 통제항목 여부"
    )
    is_personal_info = Column(
        Boolean, default=False, nullable=False, comment="개인정보보호 통제항목 여부"
    )

    # 상세 정보 (ISMS-P 인증기준 안내서)
    key_checks = Column(Text, nullable=True, comment="주요 확인사항")
    related_laws = Column(Text, nullable=True, comment="관련 법규")
    evidence_examples = Column(Text, nullable=True, comment="증거자료 예시")

    # 메타데이터
    sort_order = Column(Integer, default=0, nullable=False, comment="정렬 순서")
    tags = Column(String(255), nullable=True, comment="태그 (쉼표로 구분)")

    # 관계
    category = relationship("ControlCategory", back_populates="control_items")
    evidences = relationship(
        "Evidence",
        secondary="control_item_evidences",
        back_populates="control_items",
    )

    def __repr__(self) -> str:
        return f"<ControlItem(id={self.id}, code={self.code}, title={self.title})>"
