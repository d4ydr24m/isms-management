from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Department(Base):
    """
    부서 모델
    계층 구조 지원 (parent_id 자기참조)
    """

    __tablename__ = "departments"

    name = Column(String(100), nullable=False, comment="부서명")
    code = Column(String(50), unique=True, nullable=False, index=True, comment="부서 코드")
    parent_id = Column(
        Integer, ForeignKey("departments.id"), nullable=True, comment="상위 부서 ID"
    )
    manager_id = Column(
        Integer, nullable=True, comment="부서장 ID (순환 참조 방지를 위해 FK 제거)"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    description = Column(String(500), nullable=True, comment="부서 설명")

    # ISMS 인증 범위
    in_isms_scope = Column(
        Boolean, default=True, nullable=False, comment="ISMS 인증 범위 포함 여부"
    )
    scope_reason = Column(String(500), nullable=True, comment="범위 포함/제외 사유")

    # 관계
    parent = relationship(
        "Department", remote_side="Department.id", backref="children"
    )
    # manager 관계는 순환 참조 방지를 위해 제거 (필요시 쿼리로 조회)
    users = relationship("User", foreign_keys="User.department_id", back_populates="department")

    def __repr__(self) -> str:
        return f"<Department(id={self.id}, name={self.name}, code={self.code})>"
