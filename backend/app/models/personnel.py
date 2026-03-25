"""
담당자(Personnel) 관리 모델

조직 내 인력 정보 관리 (시스템 계정 유무와 무관)
자산 담당자 지정 등에 활용

ISMS-P 관련 통제항목:
- 2.1.2 정보자산 식별: 자산 담당자 관리
- 2.1.3 정보자산 관리: 담당자 변경 관리
"""
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Personnel(Base):
    """
    담당자 모델
    조직 내 인력 정보 (시스템 계정과 별도 관리)
    """

    __tablename__ = "personnel"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="이름")
    email = Column(String(255), nullable=True, unique=True, comment="이메일")
    phone = Column(String(20), nullable=True, comment="전화번호")
    position = Column(String(100), nullable=True, comment="직위/직책")
    department_id = Column(
        Integer, ForeignKey("departments.id"), nullable=True, comment="부서 ID"
    )
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, unique=True, comment="연결된 시스템 사용자 ID"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    note = Column(Text, nullable=True, comment="비고")

    # 관계
    department = relationship("Department", backref="personnel")
    user = relationship("User", backref="personnel_record")

    def __repr__(self) -> str:
        return f"<Personnel(id={self.id}, name={self.name}, position={self.position})>"
