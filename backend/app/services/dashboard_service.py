"""
대시보드 서비스

6.1 대시보드 서비스 구현
- 인증 준비 진척률 계산 (증적 확보율)
- 예정 보안 활동 조회
- 만료 예정 증적 조회
- 미완료 업무 집계
- 부적합 현황 집계
"""
import json
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, distinct
from sqlalchemy.orm import Session, joinedload

from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.evidence import Evidence, control_item_evidences
from app.models.scheduled_task import ScheduledTask
from app.models.audit import NonConformity, CorrectiveAction
from app.models.asset import Asset


# Redis 클라이언트 (선택적 - 없으면 캐싱 비활성화)
try:
    import redis
    redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
except (ImportError, redis.ConnectionError):
    redis_client = None


def cache_result(key_prefix: str, ttl: int = 300):
    """
    캐싱 데코레이터

    Args:
        key_prefix: 캐시 키 접두사
        ttl: 캐시 유효 시간 (초, 기본 5분)
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            if redis_client is None:
                return func(*args, **kwargs)

            # 캐시 키 생성
            cache_key = f"dashboard:{key_prefix}"

            try:
                # 캐시 조회
                cached = redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)

                # 캐시 미스 시 함수 실행
                result = func(*args, **kwargs)

                # 결과 캐싱
                redis_client.setex(cache_key, ttl, json.dumps(result, default=str))

                return result
            except Exception:
                # Redis 오류 시 캐싱 없이 실행
                return func(*args, **kwargs)

        return wrapper
    return decorator


def invalidate_dashboard_cache():
    """대시보드 캐시 무효화"""
    if redis_client is None:
        return

    try:
        keys = redis_client.keys("dashboard:*")
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass


class DashboardService:
    """
    대시보드 비즈니스 로직 서비스
    """

    def __init__(self, db: Session):
        from app.api.v1.system_settings import get_certification_type
        self._cert_type = get_certification_type(db)
        self.db = db

    @property
    def _is_isms_only(self) -> bool:
        return self._cert_type == "ISMS"

    def _control_item_filter(self, query):
        """ISMS 모드일 경우 개인정보 항목 제외 필터 적용"""
        if self._is_isms_only:
            return query.filter(ControlItem.is_personal_info == False)
        return query

    # ========== 6.1.1 인증 준비 진척률 계산 ==========

    def calculate_progress_rate(self) -> Dict[str, Any]:
        """
        인증 준비 진척률 계산 (증적 확보율)

        전체 통제항목 대비 증적이 연결된 통제항목 비율 계산

        Returns:
            Dict: 진척률 데이터
        """
        # 전체 통제항목 수 (인증 유형에 따라 필터)
        q = self.db.query(func.count(ControlItem.id))
        q = self._control_item_filter(q)
        total_controls = q.scalar() or 0

        if total_controls == 0:
            return {
                "total_progress": 0.0,
                "total_controls": 0,
                "controls_with_evidence": 0,
                "domain_progress": [],
            }

        # 증적이 연결된 통제항목 수 (중복 제거, 인증 유형 필터)
        evidence_q = (
            self.db.query(func.count(distinct(control_item_evidences.c.control_item_id)))
            .join(Evidence, Evidence.id == control_item_evidences.c.evidence_id)
            .join(ControlItem, ControlItem.id == control_item_evidences.c.control_item_id)
            .filter(Evidence.status == "active")
        )
        if self._is_isms_only:
            evidence_q = evidence_q.filter(ControlItem.is_personal_info == False)
        controls_with_evidence = evidence_q.scalar() or 0

        # 전체 진척률 계산
        total_progress = round((controls_with_evidence / total_controls) * 100, 1)

        # 영역별 진척률 계산
        domain_progress = self._calculate_domain_progress()

        return {
            "total_progress": total_progress,
            "total_controls": total_controls,
            "controls_with_evidence": controls_with_evidence,
            "domain_progress": domain_progress,
        }

    def _calculate_domain_progress(self) -> List[Dict[str, Any]]:
        """
        영역별 진척률 계산

        Returns:
            List[Dict]: 영역별 진척률 목록
        """
        domains = (
            self.db.query(ControlDomain)
            .options(
                joinedload(ControlDomain.categories)
                .joinedload(ControlCategory.control_items)
            )
            .order_by(ControlDomain.sort_order)
            .all()
        )

        domain_progress = []

        for domain in domains:
            # 해당 영역의 전체 통제항목 수 (인증 유형 필터)
            total_controls = 0
            control_item_ids = []

            for category in domain.categories:
                for item in category.control_items:
                    if self._is_isms_only and item.is_personal_info:
                        continue
                    total_controls += 1
                    control_item_ids.append(item.id)

            if total_controls == 0:
                continue

            # 증적이 연결된 통제항목 수
            controls_with_evidence = 0
            if control_item_ids:
                controls_with_evidence = (
                    self.db.query(func.count(distinct(control_item_evidences.c.control_item_id)))
                    .join(Evidence, Evidence.id == control_item_evidences.c.evidence_id)
                    .filter(
                        and_(
                            control_item_evidences.c.control_item_id.in_(control_item_ids),
                            Evidence.status == "active"
                        )
                    )
                    .scalar() or 0
                )

            progress_rate = round((controls_with_evidence / total_controls) * 100, 1)

            domain_progress.append({
                "domain_id": domain.id,
                "domain_code": domain.code,
                "domain_name": domain.name,
                "total_controls": total_controls,
                "controls_with_evidence": controls_with_evidence,
                "progress_rate": progress_rate,
            })

        return domain_progress

    # ========== 6.1.2 예정 보안 활동 조회 ==========

    def get_scheduled_activities(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        예정 보안 활동 조회

        오늘/이번주 예정된 정기 활동 조회

        Returns:
            Dict: 오늘/이번주 활동 목록
        """
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        # 이번 주 종료일 계산 (일요일)
        days_until_sunday = 6 - now.weekday()
        week_end = today_start + timedelta(days=days_until_sunday + 1)

        # 오늘 예정 활동
        today_tasks = (
            self.db.query(ScheduledTask)
            .options(
                joinedload(ScheduledTask.assignee),
                joinedload(ScheduledTask.control_item)
            )
            .filter(
                and_(
                    ScheduledTask.next_execution_at >= today_start,
                    ScheduledTask.next_execution_at < today_end,
                    ScheduledTask.status == "active"
                )
            )
            .order_by(ScheduledTask.next_execution_at)
            .all()
        )

        # 이번 주 예정 활동
        week_tasks = (
            self.db.query(ScheduledTask)
            .options(
                joinedload(ScheduledTask.assignee),
                joinedload(ScheduledTask.control_item)
            )
            .filter(
                and_(
                    ScheduledTask.next_execution_at >= today_start,
                    ScheduledTask.next_execution_at < week_end,
                    ScheduledTask.status == "active"
                )
            )
            .order_by(ScheduledTask.next_execution_at)
            .all()
        )

        def format_task(task: ScheduledTask) -> Dict[str, Any]:
            return {
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "task_type": task.task_type,
                "frequency": task.frequency,
                "next_execution_at": task.next_execution_at.isoformat() if task.next_execution_at else None,
                "assignee_name": task.assignee.name if task.assignee else None,
                "control_item_code": task.control_item.code if task.control_item else None,
            }

        return {
            "today": [format_task(t) for t in today_tasks],
            "this_week": [format_task(t) for t in week_tasks],
        }

    # ========== 6.1.3 만료 예정 증적 조회 ==========

    def get_expiring_evidences(self, days: int = 30) -> Dict[str, Any]:
        """
        만료 예정 증적 조회

        Args:
            days: 조회 기간 (일, 기본 30일)

        Returns:
            Dict: 만료 예정 증적 목록
        """
        today = date.today()
        end_date = today + timedelta(days=days)

        evidences = (
            self.db.query(Evidence)
            .options(joinedload(Evidence.control_items))
            .filter(
                and_(
                    Evidence.valid_until.isnot(None),
                    Evidence.valid_until >= today,
                    Evidence.valid_until <= end_date,
                    Evidence.status == "active"
                )
            )
            .order_by(Evidence.valid_until)
            .all()
        )

        result = []
        for ev in evidences:
            days_remaining = (ev.valid_until - today).days

            result.append({
                "id": ev.id,
                "title": ev.title,
                "file_name": ev.file_name,
                "valid_until": ev.valid_until.isoformat(),
                "days_remaining": days_remaining,
                "status": ev.status,
                "control_item_codes": [ci.code for ci in ev.control_items],
            })

        return {
            "evidences": result,
            "count": len(result),
        }

    # ========== 6.1.3.1 만료된 증적 조회 ==========

    def get_expired_evidences(self) -> Dict[str, Any]:
        """
        만료된 증적 조회 (valid_until < 오늘)

        Returns:
            Dict: 만료된 증적 목록
        """
        today = date.today()

        evidences = (
            self.db.query(Evidence)
            .options(joinedload(Evidence.control_items))
            .filter(
                and_(
                    Evidence.valid_until.isnot(None),
                    Evidence.valid_until < today,
                    Evidence.status.in_(["expired", "active"]),
                )
            )
            .order_by(Evidence.valid_until.desc())
            .all()
        )

        result = []
        for ev in evidences:
            days_overdue = (today - ev.valid_until).days

            result.append({
                "id": ev.id,
                "title": ev.title,
                "file_name": ev.file_name,
                "valid_until": ev.valid_until.isoformat(),
                "days_overdue": days_overdue,
                "status": ev.status,
                "control_item_codes": [ci.code for ci in ev.control_items],
            })

        return {
            "evidences": result,
            "count": len(result),
        }

    # ========== 6.1.3.2 보증 만료 예정 자산 조회 ==========

    def get_expiring_assets(self, days: int = 90) -> Dict[str, Any]:
        """
        보증 만료 예정 자산 조회

        Args:
            days: 조회 기간 (일, 기본 90일)

        Returns:
            Dict: 만료 예정 자산 목록
        """
        today = date.today()
        end_date = today + timedelta(days=days)

        assets = (
            self.db.query(Asset)
            .filter(
                and_(
                    Asset.warranty_end_date.isnot(None),
                    Asset.warranty_end_date >= today,
                    Asset.warranty_end_date <= end_date,
                    Asset.is_active == True,
                    Asset.status != "폐기",
                )
            )
            .order_by(Asset.warranty_end_date)
            .all()
        )

        result = []
        for asset in assets:
            days_remaining = (asset.warranty_end_date - today).days

            result.append({
                "id": asset.id,
                "asset_code": asset.asset_code,
                "name": asset.name,
                "asset_type_name": asset.asset_type.name if asset.asset_type else None,
                "warranty_end_date": asset.warranty_end_date.isoformat(),
                "days_remaining": days_remaining,
                "status": asset.status,
                "location": asset.location,
            })

        return {
            "assets": result,
            "count": len(result),
        }

    # ========== 6.1.3.3 EoL 만료 자산 조회 ==========

    def get_eol_assets(self, days: int = 90) -> Dict[str, Any]:
        """
        EoL(End of Life) 만료 예정 및 이미 만료된 자산 조회

        Args:
            days: 향후 조회 기간 (일, 기본 90일)

        Returns:
            Dict: EoL 만료 예정/만료 자산 목록
        """
        today = date.today()
        end_date = today + timedelta(days=days)

        assets = (
            self.db.query(Asset)
            .filter(
                and_(
                    Asset.eol_date.isnot(None),
                    Asset.eol_date <= end_date,
                    Asset.is_active == True,
                    Asset.status != "폐기",
                )
            )
            .order_by(Asset.eol_date)
            .all()
        )

        result = []
        for asset in assets:
            days_remaining = (asset.eol_date - today).days

            result.append({
                "id": asset.id,
                "asset_code": asset.asset_code,
                "name": asset.name,
                "asset_type_name": asset.asset_type.name if asset.asset_type else None,
                "os_version": asset.os_version,
                "service_version": asset.service_version,
                "eol_date": asset.eol_date.isoformat(),
                "days_remaining": days_remaining,
                "status": asset.status,
                "location": asset.location,
            })

        return {
            "assets": result,
            "count": len(result),
        }

    # ========== 6.1.4 미완료 업무 집계 ==========

    def get_pending_tasks(self) -> Dict[str, int]:
        """
        미완료 업무 집계

        - 부적합 시정조치 미완료 건수
        - 미확보 증적 건수

        Returns:
            Dict: 미완료 업무 집계
        """
        # 미완료 시정조치 건수 (planned, in_progress 상태)
        uncompleted_ca = (
            self.db.query(func.count(CorrectiveAction.id))
            .filter(CorrectiveAction.status.in_(["planned", "in_progress"]))
            .scalar() or 0
        )

        # 전체 통제항목 수 (인증 유형 필터)
        total_q = self.db.query(func.count(ControlItem.id))
        total_q = self._control_item_filter(total_q)
        total_controls = total_q.scalar() or 0

        # 증적이 연결된 통제항목 수 (인증 유형 필터)
        evidence_q = (
            self.db.query(func.count(distinct(control_item_evidences.c.control_item_id)))
            .join(Evidence, Evidence.id == control_item_evidences.c.evidence_id)
            .join(ControlItem, ControlItem.id == control_item_evidences.c.control_item_id)
            .filter(Evidence.status == "active")
        )
        if self._is_isms_only:
            evidence_q = evidence_q.filter(ControlItem.is_personal_info == False)
        controls_with_evidence = evidence_q.scalar() or 0

        # 미확보 증적 통제항목 수
        controls_without_evidence = total_controls - controls_with_evidence

        # 기한 초과 업무 (부적합)
        today = date.today()
        overdue_nc = (
            self.db.query(func.count(NonConformity.id))
            .filter(
                and_(
                    NonConformity.due_date < today,
                    NonConformity.status.in_(["open", "in_progress"])
                )
            )
            .scalar() or 0
        )

        # 7일 내 마감 예정 업무
        upcoming_deadline = today + timedelta(days=7)
        upcoming_nc = (
            self.db.query(func.count(NonConformity.id))
            .filter(
                and_(
                    NonConformity.due_date >= today,
                    NonConformity.due_date <= upcoming_deadline,
                    NonConformity.status.in_(["open", "in_progress"])
                )
            )
            .scalar() or 0
        )

        return {
            "uncompleted_corrective_actions": uncompleted_ca,
            "controls_without_evidence": controls_without_evidence,
            "overdue_tasks": overdue_nc,
            "upcoming_deadlines": upcoming_nc,
        }

    # ========== 6.1.5 부적합 현황 집계 ==========

    def get_nonconformity_summary(self) -> Dict[str, Any]:
        """
        부적합 현황 집계

        - 상태별 부적합 건수
        - 등급별 부적합 건수
        - total은 종료(closed) 상태를 제외한 미해결 건수

        Returns:
            Dict: 부적합 현황 요약
        """
        active_filter = NonConformity.status != "closed"

        # 미해결 부적합 수 (closed 제외)
        total = (
            self.db.query(func.count(NonConformity.id))
            .filter(active_filter)
            .scalar() or 0
        )

        # 상태별 집계 (전체 — closed 포함하여 현황 파악 가능)
        status_counts = (
            self.db.query(NonConformity.status, func.count(NonConformity.id))
            .group_by(NonConformity.status)
            .all()
        )
        by_status = {status: count for status, count in status_counts}

        # 심각도별 집계 (closed 제외)
        severity_counts = (
            self.db.query(NonConformity.severity, func.count(NonConformity.id))
            .filter(active_filter)
            .group_by(NonConformity.severity)
            .all()
        )
        by_severity = {severity: count for severity, count in severity_counts}

        # 유형별 집계 (closed 제외)
        type_counts = (
            self.db.query(NonConformity.nc_type, func.count(NonConformity.id))
            .filter(active_filter)
            .group_by(NonConformity.nc_type)
            .all()
        )
        by_type = {nc_type: count for nc_type, count in type_counts}

        return {
            "total": total,
            "by_status": by_status,
            "by_severity": by_severity,
            "by_type": by_type,
        }

    # ========== 전체 요약 ==========

    def get_dashboard_summary(self) -> Dict[str, Any]:
        """
        대시보드 전체 요약 조회

        Returns:
            Dict: 대시보드 전체 데이터
        """
        return {
            "progress": self.calculate_progress_rate(),
            "activities": self.get_scheduled_activities(),
            "expiring_evidences": self.get_expiring_evidences(),
            "expired_evidences": self.get_expired_evidences(),
            "expiring_assets": self.get_expiring_assets(),
            "eol_assets": self.get_eol_assets(),
            "pending_tasks": self.get_pending_tasks(),
            "non_conformities": self.get_nonconformity_summary(),
            "generated_at": datetime.utcnow().isoformat(),
        }
