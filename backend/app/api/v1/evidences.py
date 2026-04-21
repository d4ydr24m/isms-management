"""
증적 관리 API
증적 CRUD, 버전 관리, 통제항목 매핑
"""
import json
import logging
from datetime import date
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from app.core.deps import get_db, require_permission
from app.models.control import ControlItem
from app.models.evidence import Evidence, control_item_evidences
from app.models.user import User
from app.schemas.evidence import (
    EvidenceCreate,
    EvidenceUpdate,
    EvidenceResponse,
    EvidenceSimpleResponse,
    EvidenceList,
    EvidenceVersionResponse,
    EvidenceMappingRequest,
    ExpiringEvidenceResponse,
    ExpiringEvidenceList,
)
from app.services.evidence_service import EvidenceService
from app.services.file_service import FileService
from app.services.audit_log_service import log_user_activity

logger = logging.getLogger(__name__)

router = APIRouter()


def get_evidence_response(evidence: Evidence) -> dict:
    """Evidence 모델을 응답 딕셔너리로 변환"""
    control_ids = [ci.id for ci in evidence.control_items]
    control_codes = [ci.code for ci in evidence.control_items]

    return {
        "id": evidence.id,
        "title": evidence.title,
        "description": evidence.description,
        "file_path": evidence.file_path,
        "file_name": evidence.file_name,
        "file_hash": evidence.file_hash,
        "file_size": evidence.file_size,
        "mime_type": evidence.mime_type,
        "version": evidence.version,
        "status": evidence.status,
        "valid_from": evidence.valid_from,
        "valid_until": evidence.valid_until,
        "uploader_id": evidence.uploader_id,
        "uploader_name": evidence.uploader.name if evidence.uploader else None,
        "author": evidence.author,
        "reviewed_by": evidence.reviewed_by,
        "reviewer_name": evidence.reviewer.name if evidence.reviewer else None,
        "reviewed_at": evidence.reviewed_at,
        "review_comment": evidence.review_comment,
        "control_ids": control_ids,
        "control_codes": control_codes,
        "created_at": evidence.created_at,
        "updated_at": evidence.updated_at,
    }


def get_evidence_simple_response(evidence: Evidence) -> dict:
    """Evidence 모델을 간략 응답 딕셔너리로 변환"""
    control_ids = [ci.id for ci in evidence.control_items]
    control_codes = [ci.code for ci in evidence.control_items]
    control_items_info = [
        {"id": ci.id, "code": ci.code, "title": ci.title}
        for ci in evidence.control_items
    ]

    return {
        "id": evidence.id,
        "title": evidence.title,
        "file_path": evidence.file_path,
        "file_name": evidence.file_name,
        "file_hash": evidence.file_hash,
        "file_size": evidence.file_size,
        "mime_type": evidence.mime_type,
        "version": evidence.version,
        "status": evidence.status,
        "valid_from": evidence.valid_from,
        "valid_until": evidence.valid_until,
        "uploader_id": evidence.uploader_id,
        "uploader_name": evidence.uploader.name if evidence.uploader else None,
        "control_ids": control_ids,
        "control_codes": control_codes,
        "control_items_info": control_items_info,
        "created_at": evidence.created_at,
        "updated_at": evidence.updated_at,
    }


@router.get("/expiring", response_model=ExpiringEvidenceList)
def get_expiring_evidences(
    days: int = Query(30, ge=1, le=365, description="만료 임계일 수"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:read")),
):
    """
    만료 예정 증적 목록 조회

    지정된 일수 내에 만료되는 증적 목록을 반환합니다.
    """
    service = EvidenceService(db)
    evidences = service.check_expiring_evidences(days=days)

    items = []
    today = date.today()
    for evidence in evidences:
        days_until_expiry = (evidence.valid_until - today).days
        control_codes = [ci.code for ci in evidence.control_items]

        items.append(
            ExpiringEvidenceResponse(
                id=evidence.id,
                title=evidence.title,
                file_name=evidence.file_name,
                valid_until=evidence.valid_until,
                days_until_expiry=days_until_expiry,
                status=evidence.status,
                uploader_id=evidence.uploader_id,
                uploader_name=evidence.uploader.name if evidence.uploader else None,
                control_codes=control_codes,
            )
        )

    return ExpiringEvidenceList(
        items=items,
        total=len(items),
        days_threshold=days,
    )


@router.get("", response_model=EvidenceList)
def get_evidences(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="검색어 (제목, 설명)"),
    status: Optional[str] = Query(None, description="상태 필터"),
    control_id: Optional[int] = Query(None, description="통제항목 ID 필터"),
    evidence_type: Optional[str] = Query(None, description="증적 유형 필터"),
    source: Optional[str] = Query(
        "library",
        description=(
            "증적 출처 필터. 기본 'library' (일반 증적 관리 페이지 전용). "
            "결함 증적은 'nc_finding', 모두 보려면 'all'."
        ),
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:read")),
):
    """
    증적 목록 조회

    페이지네이션 및 필터링 지원. 기본적으로 일반 증적(source=library)만 반환된다.
    결함 증적을 포함하려면 source=nc_finding 또는 source=all 로 호출한다.
    """
    # source='all' 은 서비스 레이어에서 None 으로 해석해 전체 반환.
    source_filter = None if source == "all" else source
    service = EvidenceService(db)
    result = service.search_evidences(
        search=search,
        evidence_type=evidence_type,
        status=status,
        control_id=control_id,
        source=source_filter,
        page=page,
        page_size=page_size,
    )

    items = [get_evidence_simple_response(e) for e in result["items"]]

    return EvidenceList(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@router.post("", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
def create_evidence(
    file: UploadFile = File(..., description="증적 파일"),
    title: str = Form(..., description="증적 제목"),
    description: Optional[str] = Form(None, description="증적 설명"),
    evidence_type: Optional[str] = Form(None, description="증적 유형"),
    valid_from: Optional[str] = Form(None, description="유효 시작일 (YYYY-MM-DD)"),
    valid_until: Optional[str] = Form(None, description="유효 만료일 (YYYY-MM-DD)"),
    control_ids: Optional[str] = Form(None, description="통제항목 ID 목록 (쉼표 구분)"),
    author: Optional[str] = Form(None, description="작성자"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:create")),
):
    """
    증적 생성 (파일 업로드)

    multipart/form-data로 파일과 메타데이터를 함께 전송
    """
    # 날짜 파싱
    parsed_valid_from = None
    parsed_valid_until = None
    if valid_from:
        try:
            parsed_valid_from = date.fromisoformat(valid_from)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효 시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)",
            )
    if valid_until:
        try:
            parsed_valid_until = date.fromisoformat(valid_until)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효 만료일 형식이 올바르지 않습니다. (YYYY-MM-DD)",
            )

    # 통제항목 ID 파싱
    parsed_control_ids = []
    if control_ids:
        try:
            parsed_control_ids = [int(x.strip()) for x in control_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="통제항목 ID 형식이 올바르지 않습니다.",
            )

    service = EvidenceService(db)

    try:
        evidence = service.create_evidence(
            file=file.file,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            title=title,
            uploader_id=current_user.id,
            description=description,
            evidence_type=evidence_type,
            valid_from=parsed_valid_from,
            valid_until=parsed_valid_until,
            control_ids=parsed_control_ids,
            author=author,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"증적 생성 실패: {str(e)}",
        )

    return get_evidence_response(evidence)


@router.get("/{evidence_id}", response_model=EvidenceResponse)
def get_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:read")),
):
    """
    증적 상세 조회
    """
    service = EvidenceService(db)
    evidence = service.get_evidence_by_id(evidence_id)

    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증적을 찾을 수 없습니다.",
        )

    return get_evidence_response(evidence)


@router.put("/{evidence_id}", response_model=EvidenceResponse)
def update_evidence(
    evidence_id: int,
    evidence_update: EvidenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:update")),
):
    """
    증적 정보 수정
    """
    service = EvidenceService(db)

    try:
        evidence = service.update_evidence(
            evidence_id=evidence_id,
            title=evidence_update.title,
            description=evidence_update.description,
            valid_from=evidence_update.valid_from,
            valid_until=evidence_update.valid_until,
            author=evidence_update.author,
            status=evidence_update.status,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return get_evidence_response(evidence)


@router.delete("/{evidence_id}")
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:delete")),
):
    """
    증적 삭제 (완전 삭제)

    증적 파일, 버전 이력, 통제항목 매핑을 모두 삭제합니다.
    CISO 또는 보안담당자만 삭제 가능
    """
    service = EvidenceService(db)

    try:
        service.delete_evidence(evidence_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return {"message": "증적이 삭제되었습니다."}


@router.delete("/{evidence_id}/versions/{version_id}")
def delete_evidence_version(
    evidence_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:delete")),
):
    """
    증적 특정 버전 삭제 (현재 버전은 삭제 불가)
    """
    service = EvidenceService(db)
    try:
        service.delete_version(evidence_id, version_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return {"message": "버전이 삭제되었습니다."}


@router.post("/{evidence_id}/versions", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
def create_evidence_version(
    evidence_id: int,
    file: UploadFile = File(..., description="새 버전 파일"),
    change_description: Optional[str] = Form(None, description="변경 설명"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:update")),
):
    """
    새 버전 업로드
    """
    service = EvidenceService(db)

    try:
        evidence = service.create_version(
            evidence_id=evidence_id,
            file=file.file,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            uploader_id=current_user.id,
            change_description=change_description,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"버전 생성 실패: {str(e)}",
        )

    return get_evidence_response(evidence)


@router.get("/{evidence_id}/versions", response_model=List[EvidenceVersionResponse])
def get_evidence_versions(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:read")),
):
    """
    버전 히스토리 조회
    """
    service = EvidenceService(db)

    # 증적 존재 확인
    evidence = service.get_evidence_by_id(evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증적을 찾을 수 없습니다.",
        )

    versions = service.get_version_history(evidence_id)

    return [
        EvidenceVersionResponse(
            id=v.id,
            evidence_id=v.evidence_id,
            version=v.version,
            file_path=v.file_path,
            file_name=v.file_name,
            file_size=v.file_size,
            file_hash=v.file_hash,
            uploaded_by=v.uploaded_by,
            uploader_name=v.uploader.name if v.uploader else None,
            change_description=v.change_description,
            created_at=v.created_at,
        )
        for v in versions
    ]


@router.get("/{evidence_id}/download")
def download_evidence(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:read")),
):
    """
    파일 다운로드
    """
    service = EvidenceService(db)
    evidence = service.get_evidence_by_id(evidence_id)

    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증적을 찾을 수 없습니다.",
        )

    try:
        file_service = FileService()
        content = file_service.download_file(evidence.file_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 다운로드 실패: {str(e)}",
        )

    # 클라이언트 IP 추출 (X-Forwarded-For / X-Real-IP 우선)
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
                request.headers.get("X-Real-IP", "") or \
                (request.client.host if request.client else "")

    # 감사 로그 기록 (다운로드)
    log_user_activity(
        db=db,
        user=current_user,
        action="download",
        resource_type="evidence",
        resource_id=evidence_id,
        new_value={
            "evidence_title": evidence.title,
            "file_name": evidence.file_name,
        },
        ip_address=client_ip,
        user_agent=request.headers.get("User-Agent", "")[:500],
        request_method="GET",
        request_path=f"/api/v1/evidences/{evidence_id}/download",
        status_code=200,
    )

    # 파일명 인코딩 (한글 파일명 지원)
    encoded_filename = quote(evidence.file_name)

    return StreamingResponse(
        io.BytesIO(content),
        media_type=evidence.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(len(content)),
        },
    )


@router.get("/{evidence_id}/versions/{version_id}/download")
def download_evidence_version(
    evidence_id: int,
    version_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:read")),
):
    """
    특정 버전 파일 다운로드
    """
    from app.models.evidence import EvidenceVersion as EvidenceVersionModel

    version = db.query(EvidenceVersionModel).filter(
        EvidenceVersionModel.id == version_id,
        EvidenceVersionModel.evidence_id == evidence_id,
    ).first()

    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="버전을 찾을 수 없습니다.",
        )

    try:
        file_service = FileService()
        content = file_service.download_file(version.file_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다.",
        )

    # 클라이언트 IP 추출
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
                request.headers.get("X-Real-IP", "") or \
                (request.client.host if request.client else "")

    # 감사 로그 기록 (버전 다운로드)
    log_user_activity(
        db=db,
        user=current_user,
        action="download",
        resource_type="evidence",
        resource_id=evidence_id,
        new_value={
            "version_id": version_id,
            "file_name": version.file_name,
        },
        ip_address=client_ip,
        user_agent=request.headers.get("User-Agent", "")[:500],
        request_method="GET",
        request_path=f"/api/v1/evidences/{evidence_id}/versions/{version_id}/download",
        status_code=200,
    )

    encoded_filename = quote(version.file_name)

    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(len(content)),
        },
    )


@router.get("/{evidence_id}/preview")
def get_preview_url(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:read")),
):
    """
    파일 미리보기 (백엔드를 통한 프록시 스트리밍)

    - PDF / 이미지: 원본 바이트를 inline으로 반환
    - Office 문서(docx, xlsx, pptx, odt 등): LibreOffice로 PDF 변환 후 반환 (해시 기반 캐시)
    - 기타: 원본 바이트를 반환 (브라우저 미리보기는 클라이언트에서 판정)
    """
    from app.services.preview_service import ensure_preview, is_office_document

    service = EvidenceService(db)
    evidence = service.get_evidence_by_id(evidence_id)

    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="증적을 찾을 수 없습니다.",
        )

    file_service = FileService()
    source_mime = evidence.mime_type or "application/octet-stream"
    preview_bytes: bytes
    response_mime: str
    response_filename: str

    try:
        if is_office_document(source_mime, evidence.file_name):
            # Office 문서 → PDF 또는 HTML 변환 (스프레드시트는 HTML)
            try:
                preview_bytes, response_mime = ensure_preview(
                    file_service=file_service,
                    source_file_path=evidence.file_path,
                    file_hash=evidence.file_hash,
                    filename=evidence.file_name,
                )
                # 브라우저 힌트용 가상 확장자 부여
                ext_map = {"application/pdf": "pdf", "text/html; charset=utf-8": "html"}
                target_ext = ext_map.get(response_mime, "bin")
                base_name = evidence.file_name.rsplit(".", 1)[0] if "." in evidence.file_name else evidence.file_name
                response_filename = f"{base_name}.{target_ext}"
            except Exception as conv_err:
                logger.warning(f"Office 변환 실패, 원본 반환: {conv_err}")
                preview_bytes = file_service.get_file(evidence.file_path)
                response_mime = source_mime
                response_filename = evidence.file_name
        else:
            preview_bytes = file_service.get_file(evidence.file_path)
            response_mime = source_mime
            response_filename = evidence.file_name
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="파일을 찾을 수 없습니다.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 조회 실패: {str(e)}",
        )

    # 클라이언트 IP 추출
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
                request.headers.get("X-Real-IP", "") or \
                (request.client.host if request.client else "")

    # 감사 로그 기록 (조회/미리보기)
    log_user_activity(
        db=db,
        user=current_user,
        action="view",
        resource_type="evidence",
        resource_id=evidence_id,
        new_value={
            "evidence_title": evidence.title,
            "file_name": evidence.file_name,
            "preview_mime": response_mime,
        },
        ip_address=client_ip,
        user_agent=request.headers.get("User-Agent", "")[:500],
        request_method="GET",
        request_path=f"/api/v1/evidences/{evidence_id}/preview",
        status_code=200,
    )

    encoded_filename = quote(response_filename)
    # ETag은 원본 파일 해시에 렌더링 대상 확장자를 더해 동일 원본+동일 포맷을 공유
    etag_ext = response_filename.rsplit(".", 1)[-1] if "." in response_filename else "raw"
    etag = f'W/"{evidence.file_hash}-{etag_ext}"'
    return StreamingResponse(
        io.BytesIO(preview_bytes),
        media_type=response_mime,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(len(preview_bytes)),
            "X-Frame-Options": "SAMEORIGIN",
            "Content-Security-Policy": "frame-ancestors 'self'",
            # 브라우저가 같은 세션 내에서 동일 미리보기를 재요청하지 않도록 캐싱.
            # private: 프록시 캐싱 금지 (사용자별 권한 검증 결과이므로)
            "Cache-Control": "private, max-age=3600",
            "ETag": etag,
        },
    )


@router.post("/{evidence_id}/controls", response_model=EvidenceResponse)
def set_control_mapping(
    evidence_id: int,
    mapping_request: EvidenceMappingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:update")),
):
    """
    통제항목 매핑 설정 (기존 매핑을 대체)
    """
    service = EvidenceService(db)

    try:
        evidence = service.replace_control_mappings(
            evidence_id=evidence_id,
            control_ids=mapping_request.control_ids,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return get_evidence_response(evidence)


@router.delete("/{evidence_id}/controls/{control_id}", response_model=EvidenceResponse)
def remove_control_mapping(
    evidence_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("evidence:update")),
):
    """
    통제항목 매핑 해제
    """
    service = EvidenceService(db)

    try:
        evidence = service.update_control_mappings(
            evidence_id=evidence_id,
            control_ids=[control_id],
            add=False,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return get_evidence_response(evidence)
