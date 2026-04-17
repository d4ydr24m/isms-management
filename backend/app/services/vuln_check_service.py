"""
취약점 점검 스크립트 서비스
스크립트 CRUD, 스케줄 관리, 실행 결과 조회
"""
import json
import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.vuln_check import VulnCheckScript, VulnCheckSchedule, VulnCheckExecution
from app.models.asset import Asset

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


def sanitize_search_term(search: str) -> str:
    if not search:
        return search
    search = search.replace("\\", "\\\\")
    search = search.replace("%", "\\%")
    search = search.replace("_", "\\_")
    return search


class VulnCheckService:
    """취약점 점검 스크립트 서비스"""

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # 스크립트 CRUD
    # =========================================================================

    def create_script(
        self,
        name: str,
        script_type: str,
        file_path: str,
        file_name: str,
        uploaded_by: int,
        description: Optional[str] = None,
        file_size: Optional[int] = None,
        version: str = "1.0",
        category_id: Optional[int] = None,
        target_asset_type_id: Optional[int] = None,
    ) -> VulnCheckScript:
        script = VulnCheckScript(
            name=name,
            description=description,
            script_type=script_type,
            file_path=file_path,
            file_name=file_name,
            file_size=file_size,
            version=version,
            category_id=category_id,
            target_asset_type_id=target_asset_type_id,
            uploaded_by=uploaded_by,
        )
        self.db.add(script)
        self.db.commit()
        self.db.refresh(script)
        return script

    def get_scripts(
        self,
        script_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        category_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[VulnCheckScript], int]:
        query = self.db.query(VulnCheckScript)

        if script_type:
            query = query.filter(VulnCheckScript.script_type == script_type)
        if is_active is not None:
            query = query.filter(VulnCheckScript.is_active == is_active)
        if category_id:
            query = query.filter(VulnCheckScript.category_id == category_id)
        if search:
            safe = sanitize_search_term(search)
            query = query.filter(
                VulnCheckScript.name.ilike(f"%{safe}%")
            )

        total = query.count()
        items = query.order_by(VulnCheckScript.created_at.desc()).all()
        return items, total

    def get_script_by_id(self, script_id: int) -> Optional[VulnCheckScript]:
        return self.db.query(VulnCheckScript).filter(
            VulnCheckScript.id == script_id
        ).first()

    def update_script(self, script_id: int, **kwargs) -> VulnCheckScript:
        script = self.get_script_by_id(script_id)
        if not script:
            raise ValueError("스크립트를 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if hasattr(script, key) and value is not None:
                setattr(script, key, value)

        self.db.commit()
        self.db.refresh(script)
        return script

    def replace_script_file(
        self,
        script_id: int,
        file_path: str,
        file_name: str,
        file_size: int,
    ) -> tuple[VulnCheckScript, str]:
        """스크립트 파일 교체. (업데이트된 스크립트, 이전 파일 경로) 반환"""
        script = self.get_script_by_id(script_id)
        if not script:
            raise ValueError("스크립트를 찾을 수 없습니다.")

        old_file_path = script.file_path
        script.file_path = file_path
        script.file_name = file_name
        script.file_size = file_size
        self.db.commit()
        self.db.refresh(script)
        return script, old_file_path

    def delete_script(self, script_id: int) -> str:
        """스크립트 삭제 (비활성화) - 파일 경로 반환"""
        script = self.get_script_by_id(script_id)
        if not script:
            raise ValueError("스크립트를 찾을 수 없습니다.")

        file_path = script.file_path
        script.is_active = False
        self.db.commit()
        return file_path

    # =========================================================================
    # 스케줄 관리
    # =========================================================================

    def create_schedule(
        self,
        script_id: int,
        name: str,
        cron_expression: str,
        created_by: int,
        description: Optional[str] = None,
        target_asset_ids: Optional[List[int]] = None,
    ) -> VulnCheckSchedule:
        script = self.get_script_by_id(script_id)
        if not script:
            raise ValueError("스크립트를 찾을 수 없습니다.")

        schedule = VulnCheckSchedule(
            script_id=script_id,
            name=name,
            description=description,
            cron_expression=cron_expression,
            target_asset_ids=json.dumps(target_asset_ids) if target_asset_ids else None,
            created_by=created_by,
        )
        self.db.add(schedule)
        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def get_schedules(
        self,
        script_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[VulnCheckSchedule], int]:
        query = self.db.query(VulnCheckSchedule)

        if script_id:
            query = query.filter(VulnCheckSchedule.script_id == script_id)
        if is_active is not None:
            query = query.filter(VulnCheckSchedule.is_active == is_active)

        total = query.count()
        items = query.order_by(VulnCheckSchedule.created_at.desc()).all()
        return items, total

    def get_schedule_by_id(self, schedule_id: int) -> Optional[VulnCheckSchedule]:
        return self.db.query(VulnCheckSchedule).filter(
            VulnCheckSchedule.id == schedule_id
        ).first()

    def update_schedule(self, schedule_id: int, **kwargs) -> VulnCheckSchedule:
        schedule = self.get_schedule_by_id(schedule_id)
        if not schedule:
            raise ValueError("스케줄을 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if key == "target_asset_ids" and value is not None:
                schedule.target_asset_ids = json.dumps(value)
            elif hasattr(schedule, key) and value is not None:
                setattr(schedule, key, value)

        self.db.commit()
        self.db.refresh(schedule)
        return schedule

    def delete_schedule(self, schedule_id: int) -> None:
        schedule = self.get_schedule_by_id(schedule_id)
        if not schedule:
            raise ValueError("스케줄을 찾을 수 없습니다.")

        schedule.is_active = False
        self.db.commit()

    # =========================================================================
    # 실행 관리
    # =========================================================================

    def create_execution(
        self,
        script_id: int,
        asset_id: int,
        schedule_id: Optional[int] = None,
        executed_by: Optional[int] = None,
    ) -> VulnCheckExecution:
        execution = VulnCheckExecution(
            script_id=script_id,
            schedule_id=schedule_id,
            asset_id=asset_id,
            status="pending",
            executed_by=executed_by,
        )
        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)
        return execution

    def create_manual_executions(
        self,
        script_id: int,
        asset_ids: List[int],
        user_id: int,
    ) -> List[VulnCheckExecution]:
        """수동 실행 생성 (여러 자산에 대해)"""
        script = self.get_script_by_id(script_id)
        if not script:
            raise ValueError("스크립트를 찾을 수 없습니다.")
        if not script.is_active:
            raise ValueError("비활성 스크립트는 실행할 수 없습니다.")

        # 자산 존재 여부 확인
        existing_ids = {
            row[0] for row in
            self.db.query(Asset.id).filter(Asset.id.in_(asset_ids)).all()
        }
        missing = set(asset_ids) - existing_ids
        if missing:
            raise ValueError(f"존재하지 않는 자산 ID: {missing}")

        executions = []
        for asset_id in asset_ids:
            execution = VulnCheckExecution(
                script_id=script_id,
                asset_id=asset_id,
                status="pending",
                executed_by=user_id,
            )
            self.db.add(execution)
            executions.append(execution)

        self.db.commit()
        for ex in executions:
            self.db.refresh(ex)
        return executions

    def get_executions(
        self,
        script_id: Optional[int] = None,
        schedule_id: Optional[int] = None,
        asset_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict[str, Any]:
        query = self.db.query(VulnCheckExecution)

        if script_id:
            query = query.filter(VulnCheckExecution.script_id == script_id)
        if schedule_id:
            query = query.filter(VulnCheckExecution.schedule_id == schedule_id)
        if asset_id:
            query = query.filter(VulnCheckExecution.asset_id == asset_id)
        if status:
            query = query.filter(VulnCheckExecution.status == status)

        total = query.count()
        pages = math.ceil(total / size) if total > 0 else 1
        items = (
            query.order_by(VulnCheckExecution.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    def get_execution_by_id(self, execution_id: int) -> Optional[VulnCheckExecution]:
        return self.db.query(VulnCheckExecution).filter(
            VulnCheckExecution.id == execution_id
        ).first()

    def update_execution_result(
        self,
        execution_id: int,
        status: str,
        result_summary: Optional[str] = None,
        result_detail: Optional[str] = None,
        vulnerabilities_found: int = 0,
        severity_high: int = 0,
        severity_medium: int = 0,
        severity_low: int = 0,
        info_count: int = 0,
        error_message: Optional[str] = None,
    ) -> VulnCheckExecution:
        execution = self.get_execution_by_id(execution_id)
        if not execution:
            raise ValueError("실행 결과를 찾을 수 없습니다.")

        execution.status = status
        execution.result_summary = result_summary
        execution.result_detail = result_detail
        execution.vulnerabilities_found = vulnerabilities_found
        execution.severity_high = severity_high
        execution.severity_medium = severity_medium
        execution.severity_low = severity_low
        execution.info_count = info_count
        execution.error_message = error_message

        now = utc_now()
        if status == "running" and not execution.started_at:
            execution.started_at = now
        if status in ("completed", "failed", "cancelled"):
            execution.completed_at = now

        self.db.commit()
        self.db.refresh(execution)
        return execution

    # =========================================================================
    # 통계
    # =========================================================================

    def get_stats(self) -> Dict[str, Any]:
        total_scripts = self.db.query(func.count(VulnCheckScript.id)).scalar() or 0
        active_scripts = self.db.query(func.count(VulnCheckScript.id)).filter(
            VulnCheckScript.is_active.is_(True)
        ).scalar() or 0
        total_schedules = self.db.query(func.count(VulnCheckSchedule.id)).scalar() or 0
        active_schedules = self.db.query(func.count(VulnCheckSchedule.id)).filter(
            VulnCheckSchedule.is_active.is_(True)
        ).scalar() or 0
        total_executions = self.db.query(func.count(VulnCheckExecution.id)).scalar() or 0

        # 최근 30일 실행
        from datetime import timedelta
        thirty_days_ago = utc_now() - timedelta(days=30)
        recent_executions = self.db.query(func.count(VulnCheckExecution.id)).filter(
            VulnCheckExecution.created_at >= thirty_days_ago
        ).scalar() or 0

        # 총 발견 취약점
        total_vulns = self.db.query(
            func.coalesce(func.sum(VulnCheckExecution.vulnerabilities_found), 0)
        ).scalar() or 0
        total_high = self.db.query(
            func.coalesce(func.sum(VulnCheckExecution.severity_high), 0)
        ).scalar() or 0
        total_medium = self.db.query(
            func.coalesce(func.sum(VulnCheckExecution.severity_medium), 0)
        ).scalar() or 0
        total_low = self.db.query(
            func.coalesce(func.sum(VulnCheckExecution.severity_low), 0)
        ).scalar() or 0
        total_info = self.db.query(
            func.coalesce(func.sum(VulnCheckExecution.info_count), 0)
        ).scalar() or 0

        return {
            "total_scripts": total_scripts,
            "active_scripts": active_scripts,
            "total_schedules": total_schedules,
            "active_schedules": active_schedules,
            "total_executions": total_executions,
            "recent_executions": recent_executions,
            "total_vulnerabilities_found": total_vulns,
            "severity_distribution": {
                "high": total_high,
                "medium": total_medium,
                "low": total_low,
                "info": total_info,
            },
        }
