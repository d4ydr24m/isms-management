"""
엑셀 데이터 마이그레이션 API
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_role
from app.models.user import User
from app.services.migration_service import MigrationService

router = APIRouter()


# 마이그레이션 결과 저장소 (메모리)
_migration_results = {}


@router.post("/preview")
def preview_migration(
    file: UploadFile = File(..., description="엑셀 파일"),
    sheet_name: Optional[str] = Form(None, description="시트 이름"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    임포트 미리보기

    엑셀 파일을 파싱하고 검증 결과를 반환합니다.
    """
    # 파일 확장자 검증
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일만 업로드할 수 있습니다. (.xlsx, .xls)",
        )

    try:
        file_content = file.file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"파일 읽기 실패: {str(e)}",
        )

    service = MigrationService(db)
    result = service.preview(file_content, sheet_name)

    # 결과 저장 (실행 시 사용)
    _migration_results[result.id] = {
        "file_content": file_content,
        "sheet_name": sheet_name,
        "result": result.to_dict(),
    }

    return {
        "migration_id": result.id,
        "success_count": result.success_count,
        "error_count": result.error_count,
        "errors": [e.to_dict() for e in result.errors[:50]],  # 최대 50개
        "preview_data": result.preview_data[:100],  # 최대 100개
        "total_rows": len(result.preview_data),
    }


@router.post("/execute")
def execute_migration(
    migration_id: str = Form(..., description="미리보기 ID"),
    skip_errors: bool = Form(False, description="오류 행 건너뛰기"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    임포트 실행

    미리보기 결과를 기반으로 증적을 일괄 생성합니다.
    """
    # 저장된 결과 조회
    if migration_id not in _migration_results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="미리보기 결과를 찾을 수 없습니다. 다시 미리보기를 수행해주세요.",
        )

    stored = _migration_results[migration_id]
    file_content = stored["file_content"]
    sheet_name = stored["sheet_name"]

    service = MigrationService(db)
    result = service.execute(
        file_content=file_content,
        uploader_id=current_user.id,
        sheet_name=sheet_name,
        skip_errors=skip_errors,
    )

    # 결과 삭제
    del _migration_results[migration_id]

    return {
        "migration_id": result.id,
        "success_count": result.success_count,
        "error_count": result.error_count,
        "errors": [e.to_dict() for e in result.errors[:50]],
        "created_evidence_ids": result.created_evidences,
    }


@router.get("/{migration_id}/errors")
def get_migration_errors(
    migration_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["CISO", "보안담당자"])),
):
    """
    오류 리포트 조회
    """
    if migration_id not in _migration_results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="마이그레이션 결과를 찾을 수 없습니다.",
        )

    stored = _migration_results[migration_id]
    result = stored["result"]
    errors = result.get("errors", [])

    # 페이지네이션
    total = len(errors)
    start = (page - 1) * page_size
    end = start + page_size
    paginated_errors = errors[start:end]

    return {
        "migration_id": migration_id,
        "total": total,
        "page": page,
        "page_size": page_size,
        "errors": paginated_errors,
    }
