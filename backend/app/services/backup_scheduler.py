"""
데이터베이스 자동 백업 스케줄러 (Celery Task)

매일 오전 3시에 자동 백업을 생성하고, 30일 이상 된 백업을 삭제합니다.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)

RETENTION_DAYS = 30


@celery_app.task(name="app.services.backup_scheduler.auto_database_backup")
def auto_database_backup():
    """
    자동 데이터베이스 백업

    1. 새 백업 생성
    2. 보관 기간(30일) 초과 백업 자동 삭제
    """
    from app.services.backup_service import create_backup, list_backups, delete_backup

    # 1. 백업 생성
    try:
        result = create_backup(description="자동 백업 (일일)")
        logger.info(f"자동 백업 생성: {result.file_name} ({result.file_size} bytes)")
    except Exception as e:
        logger.error(f"자동 백업 실패: {e}")
        return {"success": False, "error": str(e)}

    # 2. 오래된 백업 삭제
    deleted = 0
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
        backups = list_backups()
        for backup in backups:
            try:
                backup_time = datetime.fromisoformat(backup.created_at)
                if backup_time.tzinfo is None:
                    backup_time = backup_time.replace(tzinfo=timezone.utc)
                if backup_time < cutoff:
                    delete_backup(backup.file_path)
                    deleted += 1
                    logger.info(f"오래된 백업 삭제: {backup.file_name}")
            except (ValueError, TypeError):
                continue
    except Exception as e:
        logger.warning(f"오래된 백업 정리 실패: {e}")

    logger.info(f"자동 백업 완료: 생성 1건, 삭제 {deleted}건")
    return {"success": True, "created": result.file_name, "deleted_count": deleted}
