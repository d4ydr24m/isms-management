from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class ScheduledTask(Base):
    """
    정기 활동 모델
    예: 월별 취약점 점검, 분기별 백업 테스트 등
    """

    __tablename__ = "scheduled_tasks"

    title = Column(String(255), nullable=False, comment="활동 제목")
    description = Column(Text, nullable=True, comment="활동 설명")
    task_type = Column(
        String(50),
        nullable=False,
        comment="활동 유형 (vulnerability_scan/backup_test/review 등)",
    )

    # 스케줄 설정
    frequency = Column(
        String(50),
        nullable=False,
        comment="주기 (daily/weekly/monthly/quarterly/yearly)",
    )
    cron_expression = Column(String(100), nullable=True, comment="Cron 표현식 (선택적)")

    # 담당자
    assignee_id = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="담당자 ID"
    )
    escalation_to_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, comment="에스컬레이션 대상 ID"
    )

    # 통제항목 연결
    control_item_id = Column(
        Integer, ForeignKey("control_items.id"), nullable=True, comment="관련 통제항목 ID"
    )

    # 실행 정보
    last_executed_at = Column(DateTime, nullable=True, comment="마지막 실행 일시")
    next_execution_at = Column(DateTime, nullable=False, comment="다음 실행 예정 일시")

    # 상태
    status = Column(
        String(20),
        default="active",
        nullable=False,
        comment="상태 (active/paused/completed)",
    )

    # 에스컬레이션 설정
    escalation_days = Column(
        Integer, default=3, nullable=False, comment="에스컬레이션까지 일수"
    )

    # 관계
    assignee = relationship("User", foreign_keys=[assignee_id], backref="assigned_tasks")
    escalation_to = relationship("User", foreign_keys=[escalation_to_id], backref="escalated_tasks")
    control_item = relationship("ControlItem", backref="scheduled_tasks")
    executions = relationship("TaskExecution", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ScheduledTask(id={self.id}, title={self.title}, frequency={self.frequency})>"


class TaskExecution(Base):
    """
    정기 활동 실행 기록 모델
    """

    __tablename__ = "task_executions"

    task_id = Column(
        Integer, ForeignKey("scheduled_tasks.id"), nullable=False, comment="정기 활동 ID"
    )
    executed_by = Column(
        Integer, ForeignKey("users.id"), nullable=False, comment="실행한 사용자 ID"
    )
    executed_at = Column(
        DateTime, default=datetime.utcnow, nullable=False, comment="실행 일시"
    )
    status = Column(
        String(20),
        nullable=False,
        comment="실행 상태 (completed/failed/skipped)",
    )
    result_summary = Column(Text, nullable=True, comment="실행 결과 요약")
    evidence_id = Column(
        Integer, ForeignKey("evidences.id"), nullable=True, comment="증적 ID (실행 결과)"
    )

    # 관계
    task = relationship("ScheduledTask", back_populates="executions")
    executor = relationship("User", backref="task_executions")
    evidence = relationship("Evidence", backref="task_executions")

    def __repr__(self) -> str:
        return f"<TaskExecution(id={self.id}, task_id={self.task_id}, status={self.status})>"
