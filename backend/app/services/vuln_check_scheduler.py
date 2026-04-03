"""
취약점 점검 스케줄러 (Celery Tasks)

정기적으로 실행되는 취약점 점검 스케줄을 처리합니다.
매 10분마다 실행되어 스케줄을 확인하고 실행이 필요한 점검을 생성합니다.
"""
import json
import logging
from datetime import datetime, timezone

from croniter import croniter

from app.core.celery_app import celery_app
from app.core.deps import SessionLocal
from app.models.vuln_check import VulnCheckSchedule, VulnCheckExecution
from app.models.asset import Asset

logger = logging.getLogger(__name__)


def _get_db():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


@celery_app.task(name="app.services.vuln_check_scheduler.run_scheduled_vuln_checks")
def run_scheduled_vuln_checks():
    """
    취약점 점검 스케줄 실행

    활성화된 스케줄 중 실행 시점이 된 것들을 찾아
    대상 자산에 대한 점검 실행 레코드를 생성합니다.
    """
    db = _get_db()
    try:
        now = datetime.now(timezone.utc)

        # 활성 스케줄 중 실행 시점이 지난 것들 조회
        schedules = (
            db.query(VulnCheckSchedule)
            .filter(
                VulnCheckSchedule.is_active.is_(True),
            )
            .all()
        )

        created_count = 0
        for schedule in schedules:
            # next_run_at이 없거나 현재 시간 이전이면 실행
            should_run = False
            if schedule.next_run_at is None:
                should_run = True
            elif schedule.next_run_at <= now:
                should_run = True

            if not should_run:
                continue

            # 스크립트가 활성 상태인지 확인
            if not schedule.script or not schedule.script.is_active:
                continue

            # 대상 자산 ID 파싱
            asset_ids = []
            if schedule.target_asset_ids:
                try:
                    asset_ids = json.loads(schedule.target_asset_ids)
                except (json.JSONDecodeError, TypeError):
                    logger.warning(
                        f"스케줄 {schedule.id}의 target_asset_ids 파싱 실패: "
                        f"{schedule.target_asset_ids}"
                    )
                    continue
            else:
                # 대상 자산이 지정되지 않은 경우, 스크립트의 target_asset_type_id로 조회
                query = db.query(Asset.id).filter(Asset.is_active.is_(True))
                if schedule.script.target_asset_type_id:
                    query = query.filter(
                        Asset.asset_type_id == schedule.script.target_asset_type_id
                    )
                asset_ids = [row[0] for row in query.all()]

            if not asset_ids:
                logger.info(f"스케줄 {schedule.id}: 대상 자산 없음")
                # 다음 실행 시간 계산 후 넘어감
                _update_next_run(schedule, now)
                continue

            # 각 자산에 대해 실행 레코드 생성
            for asset_id in asset_ids:
                execution = VulnCheckExecution(
                    script_id=schedule.script_id,
                    schedule_id=schedule.id,
                    asset_id=asset_id,
                    status="pending",
                )
                db.add(execution)
                created_count += 1

            # 스케줄 실행 시간 업데이트
            schedule.last_run_at = now
            _update_next_run(schedule, now)

        db.commit()
        logger.info(f"취약점 점검 스케줄 실행 완료: {created_count}건 생성")
        return {"created_count": created_count}

    except Exception as e:
        db.rollback()
        logger.error(f"취약점 점검 스케줄 실행 실패: {e}")
        raise
    finally:
        db.close()


def _update_next_run(schedule: VulnCheckSchedule, now: datetime) -> None:
    """cron 표현식으로 다음 실행 시간 계산"""
    try:
        cron = croniter(schedule.cron_expression, now)
        schedule.next_run_at = cron.get_next(datetime)
    except (ValueError, KeyError) as e:
        logger.warning(
            f"스케줄 {schedule.id}의 cron 표현식 오류: "
            f"{schedule.cron_expression} - {e}"
        )
