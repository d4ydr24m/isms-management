"""
MinIO 파일 서비스
S3-compatible 객체 스토리지를 통한 파일 관리
"""
import hashlib
import io
import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import BinaryIO, Dict, Optional

from minio import Minio
from minio.error import S3Error

from app.core.config import settings

logger = logging.getLogger(__name__)

# MIME type whitelist mapping
ALLOWED_MIME_TYPES: Dict[str, str] = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt": "text/plain",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
}


class FileService:
    """
    MinIO 기반 파일 서비스

    기능:
    - 파일 업로드 (해시값 계산, 메타데이터 추출)
    - 파일 다운로드
    - 파일 삭제
    - 미리보기 URL 생성 (presigned URL)
    """

    def __init__(self):
        """MinIO 클라이언트 초기화 및 버킷 확인/생성"""
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        """버킷이 없으면 생성"""
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)

    def _calculate_hash(self, data: bytes) -> str:
        """SHA-256 해시 계산"""
        return hashlib.sha256(data).hexdigest()

    def _sanitize_filename(self, filename: str) -> str:
        """파일명 살균 - 경로 순회 및 특수문자 방지"""
        # 경로 구분자 제거
        filename = os.path.basename(filename)
        # 특수문자 제거 (알파벳, 숫자, 밑줄, 하이픈, 마침표만 허용)
        filename = re.sub(r'[^\w\-.]', '_', filename)
        # 연속 마침표 제거 (경로 순회 방지)
        filename = re.sub(r'\.{2,}', '.', filename)
        return filename

    def _validate_file_extension(self, filename: str) -> str:
        """파일 확장자 검증 및 반환"""
        if "." not in filename:
            raise ValueError("파일 확장자가 없습니다.")
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise ValueError(
                f"허용되지 않는 파일 형식입니다: .{ext}. "
                f"허용 형식: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )
        return ext

    def _validate_mime_type(self, content_type: str, extension: str) -> None:
        """MIME 타입과 확장자 일치 여부 검증"""
        expected_mime = ALLOWED_MIME_TYPES.get(extension)
        if expected_mime and content_type != expected_mime:
            logger.warning(
                f"MIME 타입 불일치: 확장자={extension}, "
                f"기대={expected_mime}, 실제={content_type}"
            )
            raise ValueError(
                f"파일의 MIME 타입({content_type})이 확장자(.{extension})와 일치하지 않습니다."
            )

    def _validate_file_size(self, file_size: int) -> None:
        """파일 크기 검증"""
        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_size:
            raise ValueError(
                f"파일 크기가 제한({settings.MAX_UPLOAD_SIZE_MB}MB)을 초과했습니다."
            )

    def _generate_unique_path(self, filename: str, folder: Optional[str] = None) -> str:
        """고유한 파일 경로 생성"""
        timestamp = datetime.utcnow().strftime("%Y/%m/%d")
        unique_id = uuid.uuid4().hex[:12]

        # 파일 확장자 추출 (살균된 이름 사용)
        safe_name = self._sanitize_filename(filename)
        ext = ""
        if "." in safe_name:
            ext = "." + safe_name.rsplit(".", 1)[-1].lower()

        # 폴더 이름 살균 (경로 순회 방지)
        if folder:
            folder = re.sub(r'[^\w\-/]', '_', folder)
            folder = folder.strip('/')
            # 경로 순회 방지
            if '..' in folder:
                raise ValueError("잘못된 폴더 경로입니다.")
            return f"{folder}/{timestamp}/{unique_id}{ext}"
        return f"{timestamp}/{unique_id}{ext}"

    def upload_file(
        self,
        file: BinaryIO,
        filename: str,
        content_type: str,
        folder: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        파일 업로드

        Args:
            file: 파일 객체 (BytesIO 또는 file-like object)
            filename: 원본 파일명
            content_type: MIME 타입
            folder: 저장할 폴더 (선택)

        Returns:
            dict: 파일 메타데이터
                - file_path: MinIO 경로
                - file_hash: SHA-256 해시
                - file_size: 파일 크기 (bytes)
                - mime_type: MIME 타입
                - original_filename: 원본 파일명
        """
        # 파일명 살균 및 확장자 검증
        filename = self._sanitize_filename(filename)
        extension = self._validate_file_extension(filename)

        # MIME 타입 검증
        self._validate_mime_type(content_type, extension)

        # 파일 내용 읽기
        file_content = file.read()
        file_size = len(file_content)

        # 파일 크기 검증
        self._validate_file_size(file_size)

        # 해시 계산
        file_hash = self._calculate_hash(file_content)

        # 고유 경로 생성
        file_path = self._generate_unique_path(filename, folder)

        # MinIO에 업로드
        self.client.put_object(
            bucket_name=self.bucket_name,
            object_name=file_path,
            data=io.BytesIO(file_content),
            length=file_size,
            content_type=content_type,
        )

        return {
            "file_path": file_path,
            "file_hash": file_hash,
            "file_size": file_size,
            "mime_type": content_type,
            "original_filename": filename,
        }

    def download_file(self, file_path: str) -> bytes:
        """
        파일 다운로드

        Args:
            file_path: MinIO 파일 경로

        Returns:
            bytes: 파일 내용

        Raises:
            FileNotFoundError: 파일이 존재하지 않을 경우
        """
        try:
            response = self.client.get_object(
                bucket_name=self.bucket_name,
                object_name=file_path,
            )
            content = response.read()
            response.release_conn()
            return content
        except S3Error as e:
            if e.code == "NoSuchKey":
                raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
            raise

    def delete_file(self, file_path: str) -> None:
        """
        파일 삭제

        Args:
            file_path: MinIO 파일 경로

        Raises:
            FileNotFoundError: 파일이 존재하지 않을 경우
        """
        try:
            self.client.remove_object(
                bucket_name=self.bucket_name,
                object_name=file_path,
            )
        except S3Error as e:
            if e.code == "NoSuchKey":
                raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
            raise

    def get_presigned_url(
        self,
        file_path: str,
        expires_minutes: int = 15,
    ) -> str:
        """
        미리보기 URL 생성 (presigned URL)

        Args:
            file_path: MinIO 파일 경로
            expires_minutes: 만료 시간 (분, 기본값 15분)

        Returns:
            str: presigned URL
        """
        return self.client.presigned_get_object(
            bucket_name=self.bucket_name,
            object_name=file_path,
            expires=timedelta(minutes=expires_minutes),
        )

    def file_exists(self, file_path: str) -> bool:
        """
        파일 존재 여부 확인

        Args:
            file_path: MinIO 파일 경로

        Returns:
            bool: 파일 존재 여부
        """
        try:
            self.client.stat_object(
                bucket_name=self.bucket_name,
                object_name=file_path,
            )
            return True
        except S3Error as e:
            if e.code == "NoSuchKey":
                return False
            raise


# 싱글톤 인스턴스 (선택적)
_file_service: Optional[FileService] = None


def get_file_service() -> FileService:
    """파일 서비스 인스턴스 반환"""
    global _file_service
    if _file_service is None:
        _file_service = FileService()
    return _file_service
