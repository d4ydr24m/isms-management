"""
시스템 설정 모델
"""
from sqlalchemy import Column, String, Text

from app.db.base import Base


class SystemSetting(Base):
    """시스템 전역 설정 (키-값 저장)"""
    __tablename__ = "system_settings"

    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False, default="")
    description = Column(String(255), nullable=True)
