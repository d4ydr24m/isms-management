"""
Phase 1.0 - Celery 설정 테스트
celery_app.py에 대한 단위 테스트
"""
import pytest
from unittest.mock import patch, MagicMock


class TestCeleryAppConfiguration:
    """Celery 앱 설정 테스트"""

    def test_celery_app_exists(self):
        """celery_app 인스턴스가 존재하는지 테스트"""
        from app.core.celery_app import celery_app
        assert celery_app is not None

    def test_celery_app_name(self):
        """Celery 앱 이름이 올바른지 테스트"""
        from app.core.celery_app import celery_app
        assert celery_app.main == "isms_management"

    def test_celery_includes_tasks(self):
        """Celery가 태스크 모듈을 포함하는지 테스트"""
        from app.core.celery_app import celery_app

        # include 설정 확인
        includes = celery_app.conf.get("include", [])
        assert "app.services.scheduler_service" in includes or \
               "app.services.scheduler_service" in (celery_app.conf.include or [])

    def test_celery_serializer_settings(self):
        """Celery 직렬화 설정 테스트"""
        from app.core.celery_app import celery_app

        assert celery_app.conf.task_serializer == "json"
        assert "json" in celery_app.conf.accept_content
        assert celery_app.conf.result_serializer == "json"

    def test_celery_timezone_settings(self):
        """Celery 타임존 설정 테스트"""
        from app.core.celery_app import celery_app

        assert celery_app.conf.timezone == "Asia/Seoul"
        assert celery_app.conf.enable_utc is True

    def test_celery_task_tracking(self):
        """Celery 태스크 추적 설정 테스트"""
        from app.core.celery_app import celery_app

        assert celery_app.conf.task_track_started is True

    def test_celery_time_limits(self):
        """Celery 태스크 시간 제한 설정 테스트"""
        from app.core.celery_app import celery_app

        # 30분 = 1800초
        assert celery_app.conf.task_time_limit == 30 * 60
        # 25분 = 1500초
        assert celery_app.conf.task_soft_time_limit == 25 * 60


class TestCeleryBeatSchedule:
    """Celery Beat 스케줄 설정 테스트"""

    def test_beat_schedule_exists(self):
        """beat_schedule이 설정되어 있는지 테스트"""
        from app.core.celery_app import celery_app

        assert celery_app.conf.beat_schedule is not None
        assert isinstance(celery_app.conf.beat_schedule, dict)

    def test_expiring_evidences_task_scheduled(self):
        """증적 만료 알림 태스크가 스케줄되어 있는지 테스트"""
        from app.core.celery_app import celery_app

        schedule = celery_app.conf.beat_schedule
        assert "check-expiring-evidences" in schedule

        task_config = schedule["check-expiring-evidences"]
        assert task_config["task"] == "app.services.scheduler_service.check_expiring_evidences"

    def test_scheduled_tasks_generation_scheduled(self):
        """정기 활동 자동 생성 태스크가 스케줄되어 있는지 테스트"""
        from app.core.celery_app import celery_app

        schedule = celery_app.conf.beat_schedule
        assert "generate-scheduled-tasks" in schedule

        task_config = schedule["generate-scheduled-tasks"]
        assert task_config["task"] == "app.services.scheduler_service.generate_scheduled_tasks"

    def test_corrective_action_deadline_task_scheduled(self):
        """시정조치 기한 알림 태스크가 스케줄되어 있는지 테스트"""
        from app.core.celery_app import celery_app

        schedule = celery_app.conf.beat_schedule
        assert "check-corrective-action-deadlines" in schedule

        task_config = schedule["check-corrective-action-deadlines"]
        assert task_config["task"] == "app.services.scheduler_service.check_corrective_action_deadlines"

    def test_daily_summary_task_scheduled(self):
        """일간 요약 이메일 태스크가 스케줄되어 있는지 테스트"""
        from app.core.celery_app import celery_app

        schedule = celery_app.conf.beat_schedule
        assert "send-daily-summary" in schedule

        task_config = schedule["send-daily-summary"]
        assert task_config["task"] == "app.services.notification_service.send_daily_summary"

    def test_weekly_summary_task_scheduled(self):
        """주간 요약 이메일 태스크가 스케줄되어 있는지 테스트"""
        from app.core.celery_app import celery_app

        schedule = celery_app.conf.beat_schedule
        assert "send-weekly-summary" in schedule

        task_config = schedule["send-weekly-summary"]
        assert task_config["task"] == "app.services.notification_service.send_weekly_summary"

    def test_all_scheduled_tasks_have_schedule(self):
        """모든 스케줄된 태스크에 schedule이 설정되어 있는지 테스트"""
        from app.core.celery_app import celery_app

        schedule = celery_app.conf.beat_schedule
        for task_name, task_config in schedule.items():
            assert "schedule" in task_config, f"'{task_name}' 태스크에 schedule이 없습니다."
            assert "task" in task_config, f"'{task_name}' 태스크에 task가 없습니다."


class TestCeleryBeatScheduleTiming:
    """Celery Beat 스케줄 타이밍 테스트"""

    def test_daily_tasks_run_at_appropriate_hours(self):
        """일간 태스크가 적절한 시간에 실행되는지 테스트"""
        from app.core.celery_app import celery_app
        from celery.schedules import crontab

        schedule = celery_app.conf.beat_schedule

        # 증적 만료 알림: 오전 9시
        expiring_schedule = schedule["check-expiring-evidences"]["schedule"]
        assert isinstance(expiring_schedule, crontab)
        assert expiring_schedule._orig_hour == 9
        assert expiring_schedule._orig_minute == 0

        # 정기 활동 생성: 오전 1시
        generate_schedule = schedule["generate-scheduled-tasks"]["schedule"]
        assert isinstance(generate_schedule, crontab)
        assert generate_schedule._orig_hour == 1
        assert generate_schedule._orig_minute == 0

        # 일간 요약: 오전 8시
        daily_schedule = schedule["send-daily-summary"]["schedule"]
        assert isinstance(daily_schedule, crontab)
        assert daily_schedule._orig_hour == 8
        assert daily_schedule._orig_minute == 0

    def test_weekly_summary_runs_on_monday(self):
        """주간 요약이 월요일에 실행되는지 테스트"""
        from app.core.celery_app import celery_app
        from celery.schedules import crontab

        schedule = celery_app.conf.beat_schedule

        weekly_schedule = schedule["send-weekly-summary"]["schedule"]
        assert isinstance(weekly_schedule, crontab)
        assert weekly_schedule._orig_day_of_week == 1  # 월요일
        assert weekly_schedule._orig_hour == 8
        assert weekly_schedule._orig_minute == 0
