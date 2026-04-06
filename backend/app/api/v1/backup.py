"""
데이터베이스 백업/복원 API 라우터
/api/v1/backup
"""
import logging
import os
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.deps import require_permission
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# 스키마
# =============================================================================

class BackupResponse(BaseModel):
    fileName: str
    filePath: str
    fileSize: int
    createdAt: str
    description: str = ""


class BackupListResponse(BaseModel):
    items: List[BackupResponse]
    total: int


class BackupCreateRequest(BaseModel):
    description: str = ""


class RestoreRequest(BaseModel):
    filePath: str


class MessageResponse(BaseModel):
    message: str


# =============================================================================
# 백업 API
# =============================================================================

@router.get("", response_model=BackupListResponse)
def get_backups(
    current_user: User = Depends(require_permission("system:admin")),
) -> BackupListResponse:
    """백업 목록 조회"""
    from app.services.backup_service import list_backups

    backups = list_backups()
    return BackupListResponse(
        items=[
            BackupResponse(
                fileName=b.file_name,
                filePath=b.file_path,
                fileSize=b.file_size,
                createdAt=b.created_at,
                description=b.description,
            )
            for b in backups
        ],
        total=len(backups),
    )


@router.post("", response_model=BackupResponse, status_code=status.HTTP_201_CREATED)
def create_backup(
    data: BackupCreateRequest,
    current_user: User = Depends(require_permission("system:admin")),
) -> BackupResponse:
    """데이터베이스 백업 생성"""
    from app.services.backup_service import create_backup

    try:
        result = create_backup(description=data.description)
        return BackupResponse(
            fileName=result.file_name,
            filePath=result.file_path,
            fileSize=result.file_size,
            createdAt=result.created_at,
            description=result.description,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore", response_model=MessageResponse)
def restore_from_backup(
    data: RestoreRequest,
    current_user: User = Depends(require_permission("system:admin")),
) -> MessageResponse:
    """저장된 백업에서 복원"""
    from app.services.backup_service import restore_backup

    try:
        msg = restore_backup(data.filePath)
        return MessageResponse(message=msg)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore-upload", response_model=MessageResponse)
async def restore_from_upload(
    file: UploadFile = File(..., description="SQL 백업 파일"),
    current_user: User = Depends(require_permission("system:admin")),
) -> MessageResponse:
    """업로드한 SQL 파일로 복원"""
    from app.services.backup_service import restore_from_upload

    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    filename = os.path.basename(file.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("sql", "dump", "bak", "zip"):
        raise HTTPException(
            status_code=400,
            detail="백업 파일만 업로드 가능합니다. (.zip, .sql, .dump, .bak)",
        )

    content = await file.read()
    if len(content) > 500 * 1024 * 1024:  # 500MB
        raise HTTPException(status_code=400, detail="파일 크기가 500MB를 초과합니다.")

    try:
        msg = restore_from_upload(content, file_name=filename)
        return MessageResponse(message=msg)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{file_name}")
def download_backup(
    file_name: str,
    current_user: User = Depends(require_permission("system:admin")),
):
    """백업 파일 다운로드"""
    from app.services.backup_service import download_backup, BACKUP_FOLDER

    # 경로 순회 방지
    safe_name = os.path.basename(file_name)
    if ".." in safe_name or "/" in safe_name:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    file_path = f"{BACKUP_FOLDER}/{safe_name}"

    try:
        content = download_backup(file_path)
        media_type = "application/zip" if safe_name.endswith(".zip") else "application/sql"
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}"',
            },
        )
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{file_name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_backup(
    file_name: str,
    current_user: User = Depends(require_permission("system:admin")),
):
    """백업 파일 삭제"""
    from app.services.backup_service import delete_backup, BACKUP_FOLDER

    safe_name = os.path.basename(file_name)
    if ".." in safe_name or "/" in safe_name:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    file_path = f"{BACKUP_FOLDER}/{safe_name}"

    try:
        delete_backup(file_path)
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))
