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
        Integer, ForeignKey("users.id"), nullable=True, comment="부서장 ID"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    description = Column(String(500), nullable=True, comment="부서 설명")

    # 관계
    parent = relationship(
        "Department", remote_side="Department.id", backref="children"
    )
    manager = relationship("User", foreign_keys=[manager_id], backref="managed_dept")
    users = relationship("User", foreign_keys="User.department_id", back_populates="department")

    def __repr__(self) -> str:
        return f"<Department(id={self.id}, name={self.name}, code={self.code})>"
