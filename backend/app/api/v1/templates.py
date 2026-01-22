"""
증적 템플릿 API
템플릿 관리 및 다운로드
"""
import io
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_role
from app.models.evidence import EvidenceTemplate
from app.models.user import User
from app.schemas.evidence import (
    EvidenceTemplateCreate,
    EvidenceTemplateResponse,
    EvidenceTemplateList,
)
from app.services.file_service import FileService

router = APIRouter()


def get_template_response(template: EvidenceTemplate) -> dict:
    """EvidenceTemplate 모델을 응답 딕셔너리로 변환"""
    return {
        "id": template.id,
        "name": template.name,
        "description": template.description,
        "category": template.category,
        "file_path": template.file_path,
        "file_name": template.file_name,
        "mime_type": template.mime_type,
        "is_system_template": template.is_system_template,
        "created_by": template.created_by,
        "creator_name": template.creator.name if template.creator else None,
        "download_count": template.download_count,
        "created_at": template.created_at,
    }


@router.get("", response_model=EvidenceTemplateList)
def get_templates(
    category: Optional[str] = Query(None, description="템플릿 카테고리"),
    search: Optional[str] = Query(None, description="검색어"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    템플릿 목록 조회
    """
    query = db.query(EvidenceTemplate)

    # 카테고리 필터
    if category:
        query = query.filter(EvidenceTemplate.category == category)

    # 검색어 필터
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            EvidenceTemplate.name.ilike(search_term)
            | EvidenceTemplate.description.ilike(search_term)
        )

    templates = query.order_by(EvidenceTemplate.category, EvidenceTemplate.name).all()

    return EvidenceTemplateList(
        items=[get_template_response(t) for t in templates],
        total=len(templates),
    )


@router.post("", response_model=EvidenceTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    file: UploadFile = File(..., description="템플릿 파일"),
    name: str = Form(..., description="템플릿명"),
    description: Optional[str] = Form(None, description="설명"),
    category: str = Form(..., description="카테고리"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    커스텀 템플릿 등록

    CISO 또는 보안담당자만 등록 가능
    """
    try:
        file_service = FileService()
        file_metadata = file_service.upload_file(
            file=file.file,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            folder="templates",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 업로드 실패: {str(e)}",
        )

    template = EvidenceTemplate(
        name=name,
        description=description,
        category=category,
        file_path=file_metadata["file_path"],
        file_name=file_metadata["original_filename"],
        mime_type=file_metadata["mime_type"],
        is_system_template=False,
        created_by=current_user.id,
        download_count=0,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    return get_template_response(template)


@router.get("/{template_id}", response_model=EvidenceTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    템플릿 상세 조회
    """
    template = db.query(EvidenceTemplate).filter(EvidenceTemplate.id == template_id).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다.",
        )

    return get_template_response(template)


@router.get("/{template_id}/download")
def download_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    템플릿 다운로드
    """
    template = db.query(EvidenceTemplate).filter(EvidenceTemplate.id == template_id).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다.",
        )

    try:
        file_service = FileService()
        content = file_service.download_file(template.file_path)
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

    # 다운로드 횟수 증가
    template.download_count += 1
    db.commit()

    # 파일명 인코딩 (한글 파일명 지원)
    encoded_filename = quote(template.file_name)

    return StreamingResponse(
        io.BytesIO(content),
        media_type=template.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(len(content)),
        },
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    템플릿 삭제

    시스템 템플릿은 삭제 불가
    """
    template = db.query(EvidenceTemplate).filter(EvidenceTemplate.id == template_id).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다.",
        )

    if template.is_system_template:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="시스템 템플릿은 삭제할 수 없습니다.",
        )

    # 파일 삭제
    try:
        file_service = FileService()
        file_service.delete_file(template.file_path)
    except Exception:
        pass  # 파일 삭제 실패해도 템플릿은 삭제

    db.delete(template)
    db.commit()

    return None
