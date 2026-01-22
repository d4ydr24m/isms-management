"""
MinIO 파일 서비스
S3-compatible 객체 스토리지를 통한 파일 관리
"""
import hashlib
import io
import uuid
from datetime import datetime, timedelta
from typing import BinaryIO, Dict, Optional

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


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

    def _generate_unique_path(self, filename: str, folder: Optional[str] = None) -> str:
        """고유한 파일 경로 생성"""
        timestamp = datetime.utcnow().strftime("%Y/%m/%d")
        unique_id = uuid.uuid4().hex[:12]

        # 파일 확장자 추출
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1]

        # 경로 구성
        if folder:
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
        # 파일 내용 읽기
        file_content = file.read()
        file_size = len(file_content)

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
