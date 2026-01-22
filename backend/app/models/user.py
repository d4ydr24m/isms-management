from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base

# 사용자-역할 다대다 연결 테이블
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("created_at", DateTime, default=datetime.utcnow, nullable=False),
)


class User(Base):
    """
    사용자 모델
    """

    __tablename__ = "users"

    email = Column(
        String(255), unique=True, nullable=False, index=True, comment="이메일"
    )
    hashed_password = Column(String(255), nullable=False, comment="암호화된 비밀번호")
    name = Column(String(100), nullable=False, comment="이름")
    phone = Column(String(20), nullable=True, comment="전화번호")
    department_id = Column(
        Integer, ForeignKey("departments.id"), nullable=True, comment="부서 ID"
    )

    # 상태 관리
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")
    is_superuser = Column(Boolean, default=False, nullable=False, comment="슈퍼유저 여부")

    # 2FA 관련
    is_mfa_enabled = Column(Boolean, default=False, nullable=False, comment="2FA 활성화")
    mfa_secret = Column(String(255), nullable=True, comment="TOTP 시크릿")

    # 계정 보안
    failed_login_attempts = Column(
        Integer, default=0, nullable=False, comment="로그인 실패 횟수"
    )
    locked_until = Column(DateTime, nullable=True, comment="계정 잠금 해제 시간")
    password_changed_at = Column(
        DateTime, default=datetime.utcnow, nullable=False, comment="비밀번호 변경 시간"
    )

    # 마지막 로그인
    last_login_at = Column(DateTime, nullable=True, comment="마지막 로그인 시간")
    last_login_ip = Column(String(45), nullable=True, comment="마지막 로그인 IP")

    # 관계
    department = relationship("Department", foreign_keys=[department_id], back_populates="users")
    roles = relationship("Role", secondary=user_roles, back_populates="users")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, name={self.name})>"


class Role(Base):
    """
    역할 모델
    """

    __tablename__ = "roles"

    name = Column(String(50), unique=True, nullable=False, index=True, comment="역할명")
    description = Column(String(255), nullable=True, comment="역할 설명")
    permissions = Column(Text, nullable=False, comment="권한 JSON (쉼표로 구분)")
    is_system_role = Column(
        Boolean, default=False, nullable=False, comment="시스템 기본 역할 여부"
    )

    # 관계
    users = relationship("User", secondary=user_roles, back_populates="roles")

    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name={self.name})>"


class UserRole(Base):
    """
    사용자-역할 연결 모델 (추가 메타데이터가 필요한 경우 사용)
    현재는 단순 다대다 관계이므로 Table로 충분하지만, 향후 확장 가능성을 위해 정의
    """

    __tablename__ = "user_role_assignments"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="할당자")
    assigned_at = Column(
        DateTime, default=datetime.utcnow, nullable=False, comment="할당 시간"
    )

    def __repr__(self) -> str:
        return f"<UserRole(user_id={self.user_id}, role_id={self.role_id})>"


class AuditorAccount(Base):
    """
    심사원 임시 계정 모델
    """

    __tablename__ = "auditor_accounts"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="사용자 ID")
    audit_plan_id = Column(
        Integer, ForeignKey("audit_plans.id"), nullable=False, comment="감사 계획 ID"
    )
    valid_from = Column(DateTime, nullable=False, comment="유효 시작일")
    valid_until = Column(DateTime, nullable=False, comment="유효 만료일")
    access_scope = Column(Text, nullable=True, comment="접근 범위 JSON")
    allow_download = Column(
        Boolean, default=False, nullable=False, comment="다운로드 허용 여부"
    )
    is_active = Column(Boolean, default=True, nullable=False, comment="활성 상태")

    # 관계
    user = relationship("User", backref="auditor_accounts")
    audit_plan = relationship("AuditPlan", backref="auditor_accounts")

    def __repr__(self) -> str:
        return f"<AuditorAccount(id={self.id}, user_id={self.user_id})>"
