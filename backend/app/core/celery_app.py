"""
Celery 애플리케이션 설정
"""
from celery import Celery
from celery.schedules import crontab
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "isms_management",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.services.scheduler_service",
        "app.services.notification_service",
        "app.services.vuln_check_scheduler",
    ]
)

# Celery 설정
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30분
    task_soft_time_limit=25 * 60,  # 25분
)

# Celery Beat 스케줄 설정
celery_app.conf.beat_schedule = {
    # 증적 자동 만료 처리 (매일 자정 KST)
    "expire-evidences": {
        "task": "app.services.scheduler_service.expire_evidences",
        "schedule": crontab(hour=0, minute=0),
    },
    # 증적 만료 예정 알림 (매일 오전 9시)
    "check-expiring-evidences": {
        "task": "app.services.scheduler_service.check_expiring_evidences",
        "schedule": crontab(hour=9, minute=0),
    },
    # 정기 활동 자동 생성 (매일 오전 1시)
    "generate-scheduled-tasks": {
        "task": "app.services.scheduler_service.generate_scheduled_tasks",
        "schedule": crontab(hour=1, minute=0),
    },
    # 시정조치 기한 알림 (매일 오전 9시)
    "check-corrective-action-deadlines": {
        "task": "app.services.scheduler_service.check_corrective_action_deadlines",
        "schedule": crontab(hour=9, minute=0),
    },
    # 일간 요약 이메일 (매일 오전 8시)
    "send-daily-summary": {
        "task": "app.services.notification_service.send_daily_summary",
        "schedule": crontab(hour=8, minute=0),
    },
    # 주간 요약 이메일 (매주 월요일 오전 8시)
    "send-weekly-summary": {
        "task": "app.services.notification_service.send_weekly_summary",
        "schedule": crontab(day_of_week=1, hour=8, minute=0),
    },
    # 취약점 점검 스케줄 실행 (매 10분마다 스케줄 확인)
    "run-vuln-check-schedules": {
        "task": "app.services.vuln_check_scheduler.run_scheduled_vuln_checks",
        "schedule": crontab(minute="*/10"),
    },
}
