"""
증적 관리 API
증적 CRUD, 버전 관리, 통제항목 매핑
"""
import json
from datetime import date
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from app.core.deps import get_db, get_current_active_user, require_role
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
    current_user: User = Depends(get_current_active_user),
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    증적 목록 조회

    페이지네이션 및 필터링 지원
    """
    service = EvidenceService(db)
    result = service.search_evidences(
        search=search,
        evidence_type=evidence_type,
        status=status,
        control_id=control_id,
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
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


@router.post("/{evidence_id}/versions", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
def create_evidence_version(
    evidence_id: int,
    file: UploadFile = File(..., description="새 버전 파일"),
    change_description: Optional[str] = Form(None, description="변경 설명"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
        request_method="GET",
        request_path=f"/api/v1/evidences/{evidence_id}/download",
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    미리보기 URL 조회 (presigned URL)
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
        url = file_service.get_presigned_url(evidence.file_path, expires_minutes=15)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"미리보기 URL 생성 실패: {str(e)}",
        )

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
        },
        request_method="GET",
        request_path=f"/api/v1/evidences/{evidence_id}/preview",
    )

    return {
        "url": url,
        "expires_in_minutes": 15,
        "evidence_id": evidence_id,
        "file_name": evidence.file_name,
        "mime_type": evidence.mime_type,
    }


@router.post("/{evidence_id}/controls", response_model=EvidenceResponse)
def set_control_mapping(
    evidence_id: int,
    mapping_request: EvidenceMappingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
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
