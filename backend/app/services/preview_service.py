"""
증적 파일 미리보기 지원 서비스

Office 문서(docx/xlsx/pptx/odt/odp/ods 등)를 LibreOffice headless로 PDF 변환.
변환된 PDF는 MinIO `preview-cache/` 접두사 아래 file_hash 기반으로 캐시하여
동일 파일에 대한 재변환을 방지한다.
"""
import logging
import os
import shutil
import subprocess
import tempfile
from typing import Optional

from minio.error import S3Error

from app.services.file_service import FileService

logger = logging.getLogger(__name__)

# LibreOffice로 PDF 변환을 지원하는 MIME 타입
OFFICE_MIME_TYPES = {
    # Microsoft Office
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Haansoft (office 확장자로 업로드된 경우)
    "application/haansoftdocx",
    "application/haansoftxlsx",
    "application/haansoftpptx",
    # OpenDocument
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    # Rich Text / plain text
    "application/rtf",
    "text/rtf",
    "text/csv",
}

# 확장자 기반 보조 판정 (MIME이 application/octet-stream으로 들어온 경우)
OFFICE_EXTENSIONS = {
    "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "odt", "ods", "odp", "rtf", "csv",
}

# 스프레드시트: PDF보다 HTML 렌더링이 훨씬 빠르고 가볍다.
# (xlsx → PDF는 페이지 레이아웃/벡터 그래픽으로 수 MB가 나오지만,
#  xlsx → HTML은 테이블 구조로 KB 단위)
SPREADSHEET_EXTENSIONS = {"xlsx", "xls", "ods", "csv"}

CACHE_PREFIX = "preview-cache"
LIBREOFFICE_TIMEOUT_SECONDS = 60


def is_office_document(mime_type: str, filename: str) -> bool:
    """LibreOffice로 PDF 변환 가능한 Office 문서인지 판정"""
    if mime_type in OFFICE_MIME_TYPES:
        return True
    # octet-stream 등 일반 MIME일 때 확장자로 보조 판정
    if "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in OFFICE_EXTENSIONS:
            return True
    return False


def _cache_path(file_hash: str, target_format: str = "pdf") -> str:
    """
    MinIO 캐시 경로 생성.
    (file_hash, target_format) 쌍으로 샤딩하므로 PDF/HTML 캐시가 섞이지 않는다.
    """
    return f"{CACHE_PREFIX}/{file_hash[:2]}/{file_hash}.{target_format}"


def _get_cached(file_service: FileService, file_hash: str, target_format: str) -> Optional[bytes]:
    """캐시된 변환 결과가 있으면 반환"""
    cache_key = _cache_path(file_hash, target_format)
    try:
        return file_service.get_file(cache_key)
    except S3Error as e:
        if e.code == "NoSuchKey":
            return None
        logger.warning(f"미리보기 캐시 조회 실패: {e}")
        return None
    except Exception as e:
        logger.warning(f"미리보기 캐시 조회 실패: {e}")
        return None


def _store_cached(
    file_service: FileService,
    file_hash: str,
    target_format: str,
    content_bytes: bytes,
    content_type: str,
) -> None:
    """변환 결과를 캐시에 저장"""
    import io
    cache_key = _cache_path(file_hash, target_format)
    try:
        file_service.client.put_object(
            bucket_name=file_service.bucket_name,
            object_name=cache_key,
            data=io.BytesIO(content_bytes),
            length=len(content_bytes),
            content_type=content_type,
        )
    except Exception as e:
        logger.warning(f"미리보기 캐시 저장 실패: {e}")


def _convert_with_libreoffice(
    source_bytes: bytes,
    source_ext: str,
    target_format: str = "pdf",
) -> bytes:
    """
    LibreOffice headless로 바이트 스트림을 대상 포맷으로 변환.

    Args:
        source_bytes: 원본 파일 바이트
        source_ext: 원본 확장자 (예: 'docx') — 임시 파일명에 사용
        target_format: 'pdf' 또는 'html'

    Raises:
        RuntimeError: LibreOffice 실행 실패 또는 변환 결과물 없음
        subprocess.TimeoutExpired: LIBREOFFICE_TIMEOUT_SECONDS 초과
    """
    if target_format not in ("pdf", "html"):
        raise ValueError(f"지원하지 않는 대상 포맷: {target_format}")

    with tempfile.TemporaryDirectory(prefix="lo_convert_") as work_dir:
        safe_ext = source_ext.lower() if source_ext.isalnum() else "bin"
        src_path = os.path.join(work_dir, f"input.{safe_ext}")
        with open(src_path, "wb") as f:
            f.write(source_bytes)

        # 격리된 UserInstallation으로 동시 호출 시 프로파일 충돌 방지
        user_profile = os.path.join(work_dir, "lo_profile")
        cmd = [
            "soffice",
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            "--nolockcheck",
            f"-env:UserInstallation=file://{user_profile}",
            "--convert-to", target_format,
            "--outdir", work_dir,
            src_path,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=LIBREOFFICE_TIMEOUT_SECONDS,
                check=False,
            )
        except FileNotFoundError as e:
            raise RuntimeError(
                "LibreOffice(soffice) 실행 파일을 찾을 수 없습니다. "
                "컨테이너에 libreoffice 패키지가 설치되어 있는지 확인하세요."
            ) from e

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="ignore")[:500]
            raise RuntimeError(f"LibreOffice 변환 실패 (rc={result.returncode}): {stderr}")

        out_path = os.path.join(work_dir, f"input.{target_format}")
        if not os.path.exists(out_path):
            raise RuntimeError(f"LibreOffice가 {target_format.upper()}를 생성하지 못했습니다.")

        with open(out_path, "rb") as f:
            return f.read()


def _pick_target_format(filename: str) -> str:
    """
    파일 확장자에 따라 최적 변환 포맷 선택.
    - 스프레드시트 → html (테이블 구조라 브라우저가 즉시 렌더)
    - 그 외 Office 문서 → pdf (레이아웃 보존)
    """
    if "." not in filename:
        return "pdf"
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext in SPREADSHEET_EXTENSIONS:
        return "html"
    return "pdf"


def ensure_preview(
    file_service: FileService,
    source_file_path: str,
    file_hash: str,
    filename: str,
) -> tuple[bytes, str]:
    """
    주어진 파일의 미리보기용 바이트와 미디어 타입을 반환.

    캐시 HIT 시 캐시 바이트를 그대로 반환하고, MISS 시 LibreOffice로 변환 후 캐시에 저장.

    Returns:
        (content_bytes, media_type)

    Raises:
        RuntimeError: 변환 실패
    """
    target_format = _pick_target_format(filename)
    media_type = "application/pdf" if target_format == "pdf" else "text/html; charset=utf-8"

    # 1) 캐시 조회
    cached = _get_cached(file_service, file_hash, target_format)
    if cached:
        return cached, media_type

    # 2) 원본 다운로드
    source_bytes = file_service.get_file(source_file_path)

    # 3) 확장자 추출
    ext = "bin"
    if "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()

    # 4) 변환
    logger.info(
        f"LibreOffice 변환 시작: {filename} → {target_format} ({len(source_bytes)} bytes)"
    )
    converted_bytes = _convert_with_libreoffice(source_bytes, ext, target_format)
    logger.info(
        f"LibreOffice 변환 완료: {filename} → {target_format} {len(converted_bytes)} bytes"
    )

    # 5) 캐시 저장 (실패해도 반환값에 영향 없음)
    _store_cached(
        file_service,
        file_hash,
        target_format,
        converted_bytes,
        "application/pdf" if target_format == "pdf" else "text/html; charset=utf-8",
    )

    return converted_bytes, media_type


# 하위 호환: PDF만 돌려주는 구 API
def ensure_preview_pdf(
    file_service: FileService,
    source_file_path: str,
    file_hash: str,
    filename: str,
) -> bytes:
    """Deprecated: ensure_preview() 사용. PDF 바이트만 반환."""
    content, _ = ensure_preview(file_service, source_file_path, file_hash, filename)
    return content


def invalidate_cache(file_service: FileService, file_hash: str) -> None:
    """캐시된 변환 결과 삭제 (PDF/HTML 모두)"""
    for fmt in ("pdf", "html"):
        cache_key = _cache_path(file_hash, fmt)
        try:
            file_service.delete_file(cache_key)
        except FileNotFoundError:
            continue
        except Exception as e:
            logger.warning(f"미리보기 캐시 삭제 실패({fmt}): {e}")
