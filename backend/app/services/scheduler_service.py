"""
스케줄러 서비스 (Celery Tasks)

정기적으로 실행되는 백그라운드 작업:
- 증적 자동 만료 처리
- 증적 만료 예정 알림
- 정기 활동 자동 생성
- 시정조치 기한 알림
"""
import logging
from datetime import date, timedelta

from app.core.celery_app import celery_app
from app.core.deps import SessionLocal
from app.models.evidence import Evidence
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)


def _get_db():
    """DB 세션 생성 헬퍼"""
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


@celery_app.task(name="app.services.scheduler_service.expire_evidences")
def expire_evidences():
    """
    증적 자동 만료 처리

    valid_until이 오늘 이전인 active 증적을 expired로 변경합니다.
    매일 자정(KST)에 실행됩니다.
    """
    db = _get_db()
    try:
        today = date.today()

        # 만료된 증적 조회 (active 상태이면서 valid_until이 오늘 이전)
        expired_evidences = (
            db.query(Evidence)
            .filter(
                Evidence.status == "active",
                Evidence.valid_until != None,
                Evidence.valid_until < today,
            )
            .all()
        )

        count = 0
        for evidence in expired_evidences:
            evidence.status = "expired"
            count += 1

            # 업로더에게 만료 알림 생성
            if evidence.uploader_id:
                notification = Notification(
                    user_id=evidence.uploader_id,
                    notification_type="evidence_expiring",
                    title="증적 만료",
                    message=f"증적 '{evidence.title}'의 유효 기한({evidence.valid_until})이 만료되었습니다.",
                    link_url=f"/evidence/{evidence.id}",
                    reference_type="evidence",
                    reference_id=evidence.id,
                )
                db.add(notification)

        db.commit()
        logger.info(f"증적 자동 만료 처리 완료: {count}건")
        return {"expired_count": count}

    except Exception as e:
        db.rollback()
        logger.error(f"증적 자동 만료 처리 실패: {e}")
        raise
    finally:
        db.close()


@celery_app.task(name="app.services.scheduler_service.check_expiring_evidences")
def check_expiring_evidences():
    """
    증적 만료 예정 알림

    7일 이내 만료 예정인 증적에 대해 업로더에게 알림을 발송합니다.
    매일 오전 9시(KST)에 실행됩니다.
    """
    db = _get_db()
    try:
        today = date.today()
        threshold = today + timedelta(days=7)

        # 7일 이내 만료 예정 증적 (active 상태)
        expiring_evidences = (
            db.query(Evidence)
            .filter(
                Evidence.status == "active",
                Evidence.valid_until != None,
                Evidence.valid_until >= today,
                Evidence.valid_until <= threshold,
            )
            .all()
        )

        count = 0
        for evidence in expiring_evidences:
            days_remaining = (evidence.valid_until - today).days

            if evidence.uploader_id:
                # 중복 알림 방지: 오늘 이미 같은 증적에 대해 알림을 보냈는지 확인
                existing = (
                    db.query(Notification)
                    .filter(
                        Notification.user_id == evidence.uploader_id,
                        Notification.reference_type == "evidence",
                        Notification.reference_id == evidence.id,
                        Notification.notification_type == "evidence_expiring",
                        Notification.created_at >= today.isoformat(),
                    )
                    .first()
                )
                if existing:
                    continue

                notification = Notification(
                    user_id=evidence.uploader_id,
                    notification_type="evidence_expiring",
                    title="증적 만료 예정",
                    message=f"증적 '{evidence.title}'이(가) {days_remaining}일 후 만료됩니다. (만료일: {evidence.valid_until})",
                    link_url=f"/evidence/{evidence.id}",
                    reference_type="evidence",
                    reference_id=evidence.id,
                )
                db.add(notification)
                count += 1

        db.commit()
        logger.info(f"증적 만료 예정 알림 발송: {count}건")
        return {"notified_count": count}

    except Exception as e:
        db.rollback()
        logger.error(f"증적 만료 예정 알림 실패: {e}")
        raise
    finally:
        db.close()


@celery_app.task(name="app.services.scheduler_service.generate_scheduled_tasks")
def generate_scheduled_tasks():
    """
    정기 활동 알림 생성

    next_execution_at이 오늘이거나 지난 활동에 대해 담당자에게 알림을 발송합니다.
    매일 오전 1시(KST)에 실행됩니다.
    """
    db = _get_db()
    try:
        from datetime import datetime
        from app.models.scheduled_task import ScheduledTask

        now = datetime.utcnow()

        # 실행 예정일이 지난 active 활동
        tasks = (
            db.query(ScheduledTask)
            .filter(
                ScheduledTask.status == "active",
                ScheduledTask.next_execution_at <= now,
            )
            .all()
        )

        count = 0
        for task in tasks:
            if task.assignee_id:
                notification = Notification(
                    user_id=task.assignee_id,
                    notification_type="task_due",
                    title="정기 활동 실행 예정",
                    message=f"정기 활동 '{task.title}'의 실행 예정일입니다.",
                    link_url="/settings",
                    reference_type="scheduled_task",
                    reference_id=task.id,
                )
                db.add(notification)
                count += 1

        db.commit()
        logger.info(f"정기 활동 알림 생성 완료: {count}건")
        return {"notified_count": count}

    except Exception as e:
        db.rollback()
        logger.error(f"정기 활동 알림 생성 실패: {e}")
        raise
    finally:
        db.close()


@celery_app.task(name="app.services.scheduler_service.check_corrective_action_deadlines")
def check_corrective_action_deadlines():
    """
    시정조치 기한 알림

    기한이 3일 이내이거나 초과된 시정조치에 대해 알림을 발송합니다.
    매일 오전 9시(KST)에 실행됩니다.
    """
    db = _get_db()
    try:
        from app.models.audit import NonConformity, CorrectiveAction

        today = date.today()
        threshold = today + timedelta(days=3)

        # 기한 임박 또는 초과 부적합 사항
        ncs = (
            db.query(NonConformity)
            .filter(
                NonConformity.status.in_(["open", "in_progress"]),
                NonConformity.due_date != None,
                NonConformity.due_date <= threshold,
            )
            .all()
        )

        count = 0
        for nc in ncs:
            days_remaining = (nc.due_date - today).days
            if nc.responsible_person_id:
                if days_remaining < 0:
                    title = "시정조치 기한 초과"
                    msg = f"부적합 '{nc.title}'의 시정조치 기한이 {abs(days_remaining)}일 초과되었습니다."
                elif days_remaining == 0:
                    title = "시정조치 기한 만료"
                    msg = f"부적합 '{nc.title}'의 시정조치 기한이 오늘입니다."
                else:
                    title = "시정조치 기한 임박"
                    msg = f"부적합 '{nc.title}'의 시정조치 기한이 {days_remaining}일 남았습니다. (기한: {nc.due_date})"

                notification = Notification(
                    user_id=nc.responsible_person_id,
                    notification_type="corrective_action_due",
                    title=title,
                    message=msg,
                    link_url=f"/non-conformities/{nc.id}",
                    reference_type="non_conformity",
                    reference_id=nc.id,
                )
                db.add(notification)
                count += 1

        db.commit()
        logger.info(f"시정조치 기한 알림 발송: {count}건")
        return {"notified_count": count}

    except Exception as e:
        db.rollback()
        logger.error(f"시정조치 기한 알림 실패: {e}")
        raise
    finally:
        db.close()
