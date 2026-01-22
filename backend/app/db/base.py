from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.orm import declarative_base, declared_attr


class CustomBase:
    """
    모든 모델의 기본 클래스
    공통 필드 및 메서드 정의
    """

    # 모든 테이블에 id 컬럼 추가
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 생성 및 수정 시간 자동 관리
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    @declared_attr
    def __tablename__(cls) -> str:
        """
        클래스 이름을 기반으로 테이블 이름 자동 생성
        예: User -> users, EvidenceVersion -> evidence_versions
        """
        import re

        # 카멜케이스를 스네이크케이스로 변환
        name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", cls.__name__)
        name = re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()
        # 복수형으로 변환 (간단한 규칙)
        if name.endswith("y"):
            return name[:-1] + "ies"
        elif name.endswith(("s", "x", "z", "ch", "sh")):
            return name + "es"
        else:
            return name + "s"

    def to_dict(self) -> dict[str, Any]:
        """
        모델 인스턴스를 딕셔너리로 변환
        """
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }


# SQLAlchemy Base 클래스 생성
Base = declarative_base(cls=CustomBase)
