"""
MinIO 파일 서비스 테스트
TDD - RED 단계: 테스트 먼저 작성
"""
import pytest
import io
import hashlib
from unittest.mock import Mock, MagicMock, patch, AsyncMock
from datetime import timedelta

from app.services.file_service import FileService


class TestFileServiceInit:
    """파일 서비스 초기화 테스트"""

    def test_init_creates_minio_client(self):
        """MinIO 클라이언트가 올바르게 생성되는지 확인"""
        with patch("app.services.file_service.Minio") as mock_minio:
            service = FileService()
            mock_minio.assert_called_once()

    def test_ensure_bucket_creates_bucket_if_not_exists(self):
        """버킷이 없으면 생성하는지 확인"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = False
            mock_minio.return_value = mock_client

            service = FileService()

            mock_client.bucket_exists.assert_called_once()
            mock_client.make_bucket.assert_called_once()

    def test_does_not_create_bucket_if_exists(self):
        """버킷이 이미 존재하면 생성하지 않음"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_minio.return_value = mock_client

            service = FileService()

            mock_client.bucket_exists.assert_called_once()
            mock_client.make_bucket.assert_not_called()


class TestFileUpload:
    """파일 업로드 테스트"""

    def test_upload_file_returns_metadata(self):
        """파일 업로드 시 메타데이터 반환"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_client.put_object.return_value = Mock(
                object_name="test/file.pdf",
                etag="abc123"
            )
            mock_minio.return_value = mock_client

            service = FileService()
            file_content = b"test file content"
            file = io.BytesIO(file_content)

            result = service.upload_file(
                file=file,
                filename="test.pdf",
                content_type="application/pdf",
                folder="evidences"
            )

            assert "file_path" in result
            assert "file_hash" in result
            assert "file_size" in result
            assert "mime_type" in result
            assert "original_filename" in result
            assert result["file_size"] == len(file_content)
            assert result["mime_type"] == "application/pdf"
            assert result["original_filename"] == "test.pdf"

    def test_upload_file_calculates_sha256_hash(self):
        """파일 업로드 시 SHA-256 해시 계산"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_minio.return_value = mock_client

            service = FileService()
            file_content = b"test file content"
            file = io.BytesIO(file_content)

            result = service.upload_file(
                file=file,
                filename="test.pdf",
                content_type="application/pdf"
            )

            expected_hash = hashlib.sha256(file_content).hexdigest()
            assert result["file_hash"] == expected_hash

    def test_upload_file_generates_unique_path(self):
        """업로드된 파일 경로가 고유한지 확인"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_minio.return_value = mock_client

            service = FileService()

            result1 = service.upload_file(
                file=io.BytesIO(b"content1"),
                filename="test.pdf",
                content_type="application/pdf"
            )
            result2 = service.upload_file(
                file=io.BytesIO(b"content2"),
                filename="test.pdf",
                content_type="application/pdf"
            )

            assert result1["file_path"] != result2["file_path"]

    def test_upload_file_with_folder(self):
        """폴더 지정하여 업로드"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_minio.return_value = mock_client

            service = FileService()
            result = service.upload_file(
                file=io.BytesIO(b"content"),
                filename="test.pdf",
                content_type="application/pdf",
                folder="evidences/2024"
            )

            assert "evidences/2024" in result["file_path"]


class TestFileDownload:
    """파일 다운로드 테스트"""

    def test_download_file_returns_bytes(self):
        """파일 다운로드 시 바이트 반환"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True

            mock_response = Mock()
            mock_response.read.return_value = b"file content"
            mock_response.release_conn = Mock()
            mock_client.get_object.return_value = mock_response

            mock_minio.return_value = mock_client

            service = FileService()
            content = service.download_file("path/to/file.pdf")

            assert content == b"file content"
            mock_client.get_object.assert_called_once()

    def test_download_file_not_found_raises_exception(self):
        """존재하지 않는 파일 다운로드 시 예외 발생"""
        from minio.error import S3Error

        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True

            # S3Error를 Mock으로 생성
            s3_error = S3Error(
                response=Mock(),
                code="NoSuchKey",
                message="The specified key does not exist",
                resource="resource",
                request_id="request_id",
                host_id="host_id"
            )
            mock_client.get_object.side_effect = s3_error
            mock_minio.return_value = mock_client

            service = FileService()

            with pytest.raises(FileNotFoundError):
                service.download_file("nonexistent/file.pdf")


class TestFileDelete:
    """파일 삭제 테스트"""

    def test_delete_file_success(self):
        """파일 삭제 성공"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_minio.return_value = mock_client

            service = FileService()
            service.delete_file("path/to/file.pdf")

            mock_client.remove_object.assert_called_once()

    def test_delete_file_not_found_raises_exception(self):
        """존재하지 않는 파일 삭제 시 예외 발생"""
        from minio.error import S3Error

        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True

            s3_error = S3Error(
                response=Mock(),
                code="NoSuchKey",
                message="The specified key does not exist",
                resource="resource",
                request_id="request_id",
                host_id="host_id"
            )
            mock_client.remove_object.side_effect = s3_error
            mock_minio.return_value = mock_client

            service = FileService()

            with pytest.raises(FileNotFoundError):
                service.delete_file("nonexistent/file.pdf")


class TestPresignedUrl:
    """미리보기 URL 생성 테스트"""

    def test_get_presigned_url_returns_url(self):
        """presigned URL 반환"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_client.presigned_get_object.return_value = (
                "https://minio:9000/bucket/file.pdf?signature=xxx"
            )
            mock_minio.return_value = mock_client

            service = FileService()
            url = service.get_presigned_url("path/to/file.pdf")

            assert url.startswith("https://")
            mock_client.presigned_get_object.assert_called_once()

    def test_get_presigned_url_with_custom_expiry(self):
        """커스텀 만료 시간으로 presigned URL 생성"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_client.presigned_get_object.return_value = "https://..."
            mock_minio.return_value = mock_client

            service = FileService()
            service.get_presigned_url("path/to/file.pdf", expires_minutes=30)

            call_args = mock_client.presigned_get_object.call_args
            assert call_args[1]["expires"] == timedelta(minutes=30)

    def test_get_presigned_url_default_expiry_15_minutes(self):
        """기본 만료 시간 15분"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_client.presigned_get_object.return_value = "https://..."
            mock_minio.return_value = mock_client

            service = FileService()
            service.get_presigned_url("path/to/file.pdf")

            call_args = mock_client.presigned_get_object.call_args
            assert call_args[1]["expires"] == timedelta(minutes=15)


class TestFileExists:
    """파일 존재 확인 테스트"""

    def test_file_exists_returns_true_when_exists(self):
        """파일이 존재하면 True 반환"""
        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True
            mock_client.stat_object.return_value = Mock()
            mock_minio.return_value = mock_client

            service = FileService()
            result = service.file_exists("path/to/file.pdf")

            assert result is True

    def test_file_exists_returns_false_when_not_exists(self):
        """파일이 없으면 False 반환"""
        from minio.error import S3Error

        with patch("app.services.file_service.Minio") as mock_minio:
            mock_client = Mock()
            mock_client.bucket_exists.return_value = True

            s3_error = S3Error(
                response=Mock(),
                code="NoSuchKey",
                message="The specified key does not exist",
                resource="resource",
                request_id="request_id",
                host_id="host_id"
            )
            mock_client.stat_object.side_effect = s3_error
            mock_minio.return_value = mock_client

            service = FileService()
            result = service.file_exists("nonexistent/file.pdf")

            assert result is False
