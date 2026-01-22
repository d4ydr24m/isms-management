from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class AuditLog(Base):
    """
    감사 추적 로그 모델
    위변조 방지를 위한 해시 체인 구현
    """

    __tablename__ = "audit_logs"

    # 사용자 정보
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, index=True, comment="사용자 ID"
    )
    user_email = Column(String(255), nullable=True, comment="사용자 이메일 (스냅샷)")
    user_name = Column(String(100), nullable=True, comment="사용자 이름 (스냅샷)")

    # 액션 정보
    action = Column(
        String(50),
        nullable=False,
        index=True,
        comment="액션 (create/read/update/delete/login/logout 등)",
    )
    resource_type = Column(
        String(50), nullable=False, index=True, comment="리소스 타입 (user/evidence/audit 등)"
    )
    resource_id = Column(Integer, nullable=True, comment="리소스 ID")

    # 변경 내용 (JSON)
    old_value = Column(Text, nullable=True, comment="변경 전 값 JSON")
    new_value = Column(Text, nullable=True, comment="변경 후 값 JSON")

    # 요청 정보
    ip_address = Column(String(45), nullable=True, comment="IP 주소")
    user_agent = Column(String(500), nullable=True, comment="User Agent")
    request_method = Column(String(10), nullable=True, comment="HTTP 메서드")
    request_path = Column(String(500), nullable=True, comment="요청 경로")

    # 결과
    status_code = Column(Integer, nullable=True, comment="HTTP 상태 코드")
    error_message = Column(Text, nullable=True, comment="오류 메시지")

    # 해시 체인 (위변조 방지)
    previous_hash = Column(String(64), nullable=True, comment="이전 로그 해시")
    current_hash = Column(String(64), nullable=False, index=True, comment="현재 로그 해시")

    # 관계
    user = relationship("User", backref="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action={self.action}, resource_type={self.resource_type})>"
