"""
전체 백업/복원 서비스 (데이터베이스 + 파일)

백업에 포함되는 항목:
- PostgreSQL 데이터베이스 전체 (pg_dump)
- MinIO 저장 파일 전체 (증적, 스크립트 등)

백업 파일 형식: .zip
  ├── database.sql    (pg_dump 출력)
  └── files/           (MinIO 파일 전체)
      ├── evidences/...
      ├── vuln-check-scripts/...
      └── ...
"""
import io
import logging
import os
import subprocess
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List
from urllib.parse import urlparse

from app.core.config import get_settings
from app.services.file_service import get_file_service

logger = logging.getLogger(__name__)

BACKUP_FOLDER = "database-backups"
DB_DUMP_NAME = "database.sql"
FILES_PREFIX = "files/"


@dataclass
class BackupInfo:
    """백업 정보"""
    file_name: str
    file_path: str
    file_size: int
    created_at: str
    description: str = ""


def _parse_db_url() -> dict:
    """DATABASE_URL에서 연결 정보 추출"""
    settings = get_settings()
    parsed = urlparse(settings.DATABASE_URL)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username or "",
        "password": parsed.password or "",
    }


def _run_pg_dump() -> bytes:
    """pg_dump 실행하여 SQL 덤프 생성"""
    db_info = _parse_db_url()
    env = os.environ.copy()
    env["PGPASSWORD"] = db_info["password"]

    result = subprocess.run(
        [
            "pg_dump",
            "-h", db_info["host"],
            "-p", db_info["port"],
            "-U", db_info["user"],
            "-d", db_info["dbname"],
            "--no-owner",
            "--no-acl",
            "--clean",
            "--if-exists",
        ],
        capture_output=True,
        env=env,
        timeout=300,
    )

    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"pg_dump 실패: {stderr[:500]}")

    if not result.stdout:
        raise RuntimeError("백업 데이터가 비어있습니다.")

    return result.stdout


def _run_psql_restore(sql_data: bytes) -> None:
    """psql로 SQL 덤프 복원"""
    db_info = _parse_db_url()
    env = os.environ.copy()
    env["PGPASSWORD"] = db_info["password"]

    result = subprocess.run(
        [
            "psql",
            "-h", db_info["host"],
            "-p", db_info["port"],
            "-U", db_info["user"],
            "-d", db_info["dbname"],
            "--single-transaction",
        ],
        input=sql_data,
        capture_output=True,
        env=env,
        timeout=300,
    )

    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"DB 복원 실패: {stderr[:500]}")


def _collect_minio_files() -> list:
    """MinIO에서 백업 폴더를 제외한 모든 파일 목록 수집"""
    file_service = get_file_service()
    files = []

    try:
        objects = file_service.client.list_objects(
            bucket_name=file_service.bucket_name,
            recursive=True,
        )
        for obj in objects:
            # 백업 폴더 자체는 제외
            if obj.object_name.startswith(f"{BACKUP_FOLDER}/"):
                continue
            files.append(obj.object_name)
    except Exception as e:
        logger.warning(f"MinIO 파일 목록 수집 중 오류: {e}")

    return files


def create_backup(description: str = "") -> BackupInfo:
    """
    전체 백업 생성 (DB + MinIO 파일)

    Returns:
        BackupInfo: 생성된 백업 정보
    """
    file_service = get_file_service()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    file_name = f"isms_backup_{timestamp}.zip"
    file_path = f"{BACKUP_FOLDER}/{file_name}"

    try:
        # 1. DB 덤프 생성
        logger.info("백업: DB 덤프 생성 중...")
        sql_data = _run_pg_dump()

        # 2. ZIP 아카이브 생성
        logger.info("백업: ZIP 아카이브 생성 중...")
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            # DB 덤프 추가
            zf.writestr(DB_DUMP_NAME, sql_data)

            # MinIO 파일 추가
            minio_files = _collect_minio_files()
            for obj_name in minio_files:
                try:
                    data = file_service.download_file(obj_name)
                    zf.writestr(f"{FILES_PREFIX}{obj_name}", data)
                except Exception as e:
                    logger.warning(f"파일 백업 건너뜀: {obj_name} - {e}")

        zip_data = zip_buffer.getvalue()

        # 3. MinIO에 백업 ZIP 업로드
        file_service.client.put_object(
            bucket_name=file_service.bucket_name,
            object_name=file_path,
            data=io.BytesIO(zip_data),
            length=len(zip_data),
            content_type="application/zip",
        )

        logger.info(
            f"전체 백업 생성 완료: {file_path} "
            f"({len(zip_data)} bytes, DB + {len(minio_files)}개 파일)"
        )

        return BackupInfo(
            file_name=file_name,
            file_path=file_path,
            file_size=len(zip_data),
            created_at=datetime.now(timezone.utc).isoformat(),
            description=description,
        )

    except subprocess.TimeoutExpired:
        raise RuntimeError("백업 시간이 초과되었습니다 (5분).")


def _restore_from_zip(zip_data: bytes) -> str:
    """ZIP 아카이브에서 DB + 파일 복원"""
    file_service = get_file_service()

    with zipfile.ZipFile(io.BytesIO(zip_data), "r") as zf:
        names = zf.namelist()

        # 1. DB 복원
        if DB_DUMP_NAME not in names:
            raise RuntimeError("백업 파일에 데이터베이스 덤프가 없습니다.")

        logger.info("복원: 데이터베이스 복원 중...")
        sql_data = zf.read(DB_DUMP_NAME)
        _run_psql_restore(sql_data)

        # 2. MinIO 파일 복원
        file_count = 0
        for name in names:
            if name.startswith(FILES_PREFIX) and not name.endswith("/"):
                obj_name = name[len(FILES_PREFIX):]
                if not obj_name:
                    continue
                try:
                    data = zf.read(name)
                    file_service.client.put_object(
                        bucket_name=file_service.bucket_name,
                        object_name=obj_name,
                        data=io.BytesIO(data),
                        length=len(data),
                        content_type="application/octet-stream",
                    )
                    file_count += 1
                except Exception as e:
                    logger.warning(f"파일 복원 건너뜀: {obj_name} - {e}")

        logger.info(f"복원 완료: DB + {file_count}개 파일")
        return f"데이터베이스 및 {file_count}개 파일이 성공적으로 복원되었습니다."


def _restore_sql_only(sql_data: bytes) -> str:
    """SQL 파일만으로 DB 복원 (레거시 .sql 백업 호환)"""
    logger.info("복원: 데이터베이스만 복원 중 (SQL 파일)...")
    _run_psql_restore(sql_data)
    return "데이터베이스가 성공적으로 복원되었습니다. (파일은 포함되지 않음)"


def restore_backup(file_path: str) -> str:
    """
    MinIO에 저장된 백업에서 복원

    .zip → DB + 파일 전체 복원
    .sql → DB만 복원 (하위호환)
    """
    file_service = get_file_service()

    try:
        data = file_service.download_file(file_path)
    except FileNotFoundError:
        raise RuntimeError(f"백업 파일을 찾을 수 없습니다: {file_path}")

    if not data:
        raise RuntimeError("백업 파일이 비어있습니다.")

    if file_path.endswith(".zip"):
        return _restore_from_zip(data)
    else:
        return _restore_sql_only(data)


def restore_from_upload(data: bytes, file_name: str = "") -> str:
    """
    업로드된 파일로 복원

    .zip → DB + 파일 전체 복원
    .sql/.dump/.bak → DB만 복원
    """
    if not data:
        raise RuntimeError("백업 파일이 비어있습니다.")

    if file_name.endswith(".zip"):
        return _restore_from_zip(data)
    else:
        return _restore_sql_only(data)


def list_backups() -> List[BackupInfo]:
    """MinIO에 저장된 백업 목록 조회 (최신순)"""
    file_service = get_file_service()
    backups = []

    try:
        objects = file_service.client.list_objects(
            bucket_name=file_service.bucket_name,
            prefix=f"{BACKUP_FOLDER}/",
            recursive=True,
        )

        for obj in objects:
            name = obj.object_name
            if name.endswith(".zip") or name.endswith(".sql"):
                backups.append(BackupInfo(
                    file_name=name.rsplit("/", 1)[-1],
                    file_path=name,
                    file_size=obj.size or 0,
                    created_at=obj.last_modified.isoformat() if obj.last_modified else "",
                ))
    except Exception as e:
        logger.error(f"백업 목록 조회 실패: {e}")

    backups.sort(key=lambda b: b.created_at, reverse=True)
    return backups


def delete_backup(file_path: str) -> None:
    """백업 파일 삭제"""
    file_service = get_file_service()
    try:
        file_service.delete_file(file_path)
        logger.info(f"백업 삭제: {file_path}")
    except FileNotFoundError:
        raise RuntimeError(f"백업 파일을 찾을 수 없습니다: {file_path}")


def download_backup(file_path: str) -> bytes:
    """백업 파일 다운로드"""
    file_service = get_file_service()
    try:
        return file_service.download_file(file_path)
    except FileNotFoundError:
        raise RuntimeError(f"백업 파일을 찾을 수 없습니다: {file_path}")
