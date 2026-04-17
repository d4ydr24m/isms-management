"""
취약점 점검 스크립트 API 라우터
/api/v1/vuln-check
"""
import json
import logging
import os
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.schemas.vuln_check import (
    VulnCheckScriptUpdate,
    VulnCheckScriptResponse,
    VulnCheckScriptList,
    VulnCheckScheduleCreate,
    VulnCheckScheduleUpdate,
    VulnCheckScheduleResponse,
    VulnCheckScheduleList,
    VulnCheckExecutionCreate,
    VulnCheckExecutionUpdate,
    VulnCheckExecutionResponse,
    VulnCheckExecutionList,
    VulnCheckStats,
)
from app.services.vuln_check_service import VulnCheckService
from app.services.file_service import get_file_service

logger = logging.getLogger(__name__)

router = APIRouter()

# 스크립트 파일 허용 확장자
ALLOWED_SCRIPT_EXTENSIONS = {"py", "sh", "ps1", "bat", "rb", "pl", "yaml", "yml", "json", "xml", "txt"}
MAX_SCRIPT_SIZE_MB = 10


# =============================================================================
# 헬퍼 함수
# =============================================================================

def get_vuln_check_service(db: Session = Depends(get_db)) -> VulnCheckService:
    return VulnCheckService(db)


def _validate_script_file(file: UploadFile) -> str:
    """스크립트 파일 확장자 검증"""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일명이 없습니다.",
        )
    # 경로 순회 방지
    filename = os.path.basename(file.filename)
    if ".." in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="잘못된 파일명입니다.",
        )
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_SCRIPT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"허용되지 않은 파일 형식입니다. 허용: {', '.join(sorted(ALLOWED_SCRIPT_EXTENSIONS))}",
        )
    return filename


def _script_to_response(script) -> VulnCheckScriptResponse:
    return VulnCheckScriptResponse(
        id=script.id,
        name=script.name,
        description=script.description,
        script_type=script.script_type,
        file_name=script.file_name,
        file_size=script.file_size,
        version=script.version,
        category_id=script.category_id,
        category_name=script.category.name if script.category else None,
        target_asset_type_id=script.target_asset_type_id,
        target_asset_type_name=script.target_asset_type.name if script.target_asset_type else None,
        is_active=script.is_active,
        uploaded_by=script.uploaded_by,
        uploader_name=script.uploader.name if script.uploader else None,
        schedule_count=len(script.schedules) if script.schedules else 0,
        execution_count=len(script.executions) if script.executions else 0,
        created_at=script.created_at,
        updated_at=script.updated_at,
    )


def _schedule_to_response(schedule) -> VulnCheckScheduleResponse:
    target_ids = None
    if schedule.target_asset_ids:
        try:
            target_ids = json.loads(schedule.target_asset_ids)
        except (json.JSONDecodeError, TypeError):
            target_ids = None

    return VulnCheckScheduleResponse(
        id=schedule.id,
        script_id=schedule.script_id,
        script_name=schedule.script.name if schedule.script else None,
        name=schedule.name,
        description=schedule.description,
        cron_expression=schedule.cron_expression,
        target_asset_ids=target_ids,
        is_active=schedule.is_active,
        last_run_at=schedule.last_run_at,
        next_run_at=schedule.next_run_at,
        created_by=schedule.created_by,
        creator_name=schedule.creator.name if schedule.creator else None,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


def _execution_to_response(execution) -> VulnCheckExecutionResponse:
    return VulnCheckExecutionResponse(
        id=execution.id,
        script_id=execution.script_id,
        script_name=execution.script.name if execution.script else None,
        schedule_id=execution.schedule_id,
        schedule_name=execution.schedule.name if execution.schedule else None,
        asset_id=execution.asset_id,
        asset_name=execution.asset.name if execution.asset else None,
        asset_code=execution.asset.asset_code if execution.asset else None,
        status=execution.status,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        result_summary=execution.result_summary,
        result_detail=execution.result_detail,
        vulnerabilities_found=execution.vulnerabilities_found,
        severity_high=execution.severity_high,
        severity_medium=execution.severity_medium,
        severity_low=execution.severity_low,
        info_count=execution.info_count or 0,
        executed_by=execution.executed_by,
        executor_name=execution.executor.name if execution.executor else None,
        error_message=execution.error_message,
        created_at=execution.created_at,
    )


# =============================================================================
# 스크립트 API
# =============================================================================

@router.get("/scripts", response_model=VulnCheckScriptList)
def get_scripts(
    script_type: Optional[str] = Query(None, description="스크립트 유형"),
    is_active: Optional[bool] = Query(None, description="활성 상태"),
    category_id: Optional[int] = Query(None, description="취약점 분류 ID"),
    search: Optional[str] = Query(None, description="검색어"),
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnCheckScriptList:
    """취약점 점검 스크립트 목록 조회"""
    items, total = service.get_scripts(
        script_type=script_type,
        is_active=is_active,
        category_id=category_id,
        search=search,
    )
    return VulnCheckScriptList(
        items=[_script_to_response(item) for item in items],
        total=total,
    )


@router.post("/scripts", response_model=VulnCheckScriptResponse, status_code=status.HTTP_201_CREATED)
async def create_script(
    file: UploadFile = File(..., description="스크립트 파일"),
    name: str = Form(..., min_length=1, max_length=200),
    script_type: str = Form(...),
    description: Optional[str] = Form(None),
    version: str = Form(default="1.0"),
    category_id: Optional[int] = Form(None),
    target_asset_type_id: Optional[int] = Form(None),
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> VulnCheckScriptResponse:
    """
    취약점 점검 스크립트 업로드

    multipart/form-data로 스크립트 파일과 메타데이터를 함께 전송합니다.
    """
    # 스크립트 유형 검증
    valid_types = ["python", "shell", "powershell", "custom"]
    if script_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"유효하지 않은 스크립트 유형입니다. 허용값: {valid_types}",
        )

    # 파일 검증
    filename = _validate_script_file(file)

    # 파일 크기 검증
    content = await file.read()
    if len(content) > MAX_SCRIPT_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"스크립트 파일 크기가 {MAX_SCRIPT_SIZE_MB}MB를 초과합니다.",
        )

    # MinIO에 업로드
    import io
    file_service = get_file_service()
    try:
        upload_result = file_service.upload_file(
            file=io.BytesIO(content),
            filename=filename,
            content_type=file.content_type or "application/octet-stream",
            folder="vuln-check-scripts",
        )
    except ValueError as e:
        # FileService의 확장자 검증 우회: 스크립트 전용 업로드
        # 직접 MinIO에 업로드
        import uuid
        from datetime import datetime as dt
        timestamp = dt.utcnow().strftime("%Y/%m/%d")
        unique_id = uuid.uuid4().hex[:12]
        safe_name = re.sub(r'[^\w\-.]', '_', os.path.basename(filename))
        ext = "." + safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
        object_path = f"vuln-check-scripts/{timestamp}/{unique_id}{ext}"

        file_service.client.put_object(
            bucket_name=file_service.bucket_name,
            object_name=object_path,
            data=io.BytesIO(content),
            length=len(content),
            content_type=file.content_type or "application/octet-stream",
        )
        upload_result = {
            "file_path": object_path,
            "file_size": len(content),
            "original_filename": safe_name,
        }

    try:
        script = service.create_script(
            name=name,
            description=description,
            script_type=script_type,
            file_path=upload_result["file_path"],
            file_name=upload_result.get("original_filename", filename),
            file_size=upload_result.get("file_size"),
            version=version,
            category_id=category_id,
            target_asset_type_id=target_asset_type_id,
            uploaded_by=current_user.id,
        )
        return _script_to_response(script)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/scripts/{script_id}", response_model=VulnCheckScriptResponse)
def get_script(
    script_id: int,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnCheckScriptResponse:
    """스크립트 상세 조회"""
    script = service.get_script_by_id(script_id)
    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스크립트를 찾을 수 없습니다.",
        )
    return _script_to_response(script)


@router.put("/scripts/{script_id}", response_model=VulnCheckScriptResponse)
def update_script(
    script_id: int,
    data: VulnCheckScriptUpdate,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> VulnCheckScriptResponse:
    """스크립트 정보 수정"""
    try:
        script = service.update_script(
            script_id=script_id,
            **data.model_dump(exclude_unset=True),
        )
        return _script_to_response(script)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put("/scripts/{script_id}/file", response_model=VulnCheckScriptResponse)
async def replace_script_file(
    script_id: int,
    file: UploadFile = File(..., description="새 스크립트 파일"),
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> VulnCheckScriptResponse:
    """스크립트 파일 교체 (메타데이터는 유지)"""
    # 스크립트 존재 확인
    existing = service.get_script_by_id(script_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스크립트를 찾을 수 없습니다.",
        )

    filename = _validate_script_file(file)
    content = await file.read()
    if len(content) > MAX_SCRIPT_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"스크립트 파일 크기가 {MAX_SCRIPT_SIZE_MB}MB를 초과합니다.",
        )

    import io
    import uuid
    from datetime import datetime as dt
    file_service = get_file_service()
    timestamp = dt.utcnow().strftime("%Y/%m/%d")
    unique_id = uuid.uuid4().hex[:12]
    safe_name = re.sub(r'[^\w\-.]', '_', os.path.basename(filename))
    ext = "." + safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
    object_path = f"vuln-check-scripts/{timestamp}/{unique_id}{ext}"

    file_service.client.put_object(
        bucket_name=file_service.bucket_name,
        object_name=object_path,
        data=io.BytesIO(content),
        length=len(content),
        content_type=file.content_type or "application/octet-stream",
    )

    try:
        script, old_file_path = service.replace_script_file(
            script_id=script_id,
            file_path=object_path,
            file_name=safe_name,
            file_size=len(content),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    # 이전 파일 삭제 (실패해도 계속 진행)
    if old_file_path and old_file_path != object_path:
        try:
            file_service.delete_file(old_file_path)
        except Exception:
            pass

    return _script_to_response(script)


@router.delete("/scripts/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_script(
    script_id: int,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:delete")),
):
    """스크립트 삭제 (비활성화)"""
    try:
        service.delete_script(script_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/scripts/{script_id}/download")
def download_script(
    script_id: int,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
):
    """스크립트 파일 다운로드 (백엔드 프록시)"""
    from fastapi.responses import Response

    script = service.get_script_by_id(script_id)
    if not script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스크립트를 찾을 수 없습니다.",
        )

    file_service = get_file_service()
    try:
        content = file_service.download_file(script.file_path)
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{script.file_name}"',
            },
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스크립트 파일을 찾을 수 없습니다.",
        )


# =============================================================================
# 스케줄 API
# =============================================================================

@router.get("/schedules", response_model=VulnCheckScheduleList)
def get_schedules(
    script_id: Optional[int] = Query(None, description="스크립트 ID"),
    is_active: Optional[bool] = Query(None, description="활성 상태"),
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnCheckScheduleList:
    """스케줄 목록 조회"""
    items, total = service.get_schedules(
        script_id=script_id,
        is_active=is_active,
    )
    return VulnCheckScheduleList(
        items=[_schedule_to_response(item) for item in items],
        total=total,
    )


@router.post("/schedules", response_model=VulnCheckScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(
    data: VulnCheckScheduleCreate,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> VulnCheckScheduleResponse:
    """스케줄 생성"""
    try:
        schedule = service.create_schedule(
            script_id=data.script_id,
            name=data.name,
            description=data.description,
            cron_expression=data.cron_expression,
            target_asset_ids=data.target_asset_ids,
            created_by=current_user.id,
        )
        return _schedule_to_response(schedule)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/schedules/{schedule_id}", response_model=VulnCheckScheduleResponse)
def get_schedule(
    schedule_id: int,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnCheckScheduleResponse:
    """스케줄 상세 조회"""
    schedule = service.get_schedule_by_id(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="스케줄을 찾을 수 없습니다.",
        )
    return _schedule_to_response(schedule)


@router.put("/schedules/{schedule_id}", response_model=VulnCheckScheduleResponse)
def update_schedule(
    schedule_id: int,
    data: VulnCheckScheduleUpdate,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> VulnCheckScheduleResponse:
    """스케줄 수정"""
    try:
        schedule = service.update_schedule(
            schedule_id=schedule_id,
            **data.model_dump(exclude_unset=True),
        )
        return _schedule_to_response(schedule)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: int,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:delete")),
):
    """스케줄 삭제 (비활성화)"""
    try:
        service.delete_schedule(schedule_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================================
# 실행 API
# =============================================================================

@router.get("/executions", response_model=VulnCheckExecutionList)
def get_executions(
    script_id: Optional[int] = Query(None, description="스크립트 ID"),
    schedule_id: Optional[int] = Query(None, description="스케줄 ID"),
    asset_id: Optional[int] = Query(None, description="자산 ID"),
    execution_status: Optional[str] = Query(None, alias="status", description="실행 상태"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnCheckExecutionList:
    """실행 결과 목록 조회"""
    result = service.get_executions(
        script_id=script_id,
        schedule_id=schedule_id,
        asset_id=asset_id,
        status=execution_status,
        page=page,
        size=size,
    )
    return VulnCheckExecutionList(
        items=[_execution_to_response(item) for item in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.post("/executions", response_model=List[VulnCheckExecutionResponse], status_code=status.HTTP_201_CREATED)
def create_execution(
    data: VulnCheckExecutionCreate,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> List[VulnCheckExecutionResponse]:
    """수동 실행 생성"""
    try:
        executions = service.create_manual_executions(
            script_id=data.script_id,
            asset_ids=data.asset_ids,
            user_id=current_user.id,
        )
        return [_execution_to_response(ex) for ex in executions]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/executions/{execution_id}", response_model=VulnCheckExecutionResponse)
def update_execution(
    execution_id: int,
    data: VulnCheckExecutionUpdate,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> VulnCheckExecutionResponse:
    """실행 결과 업데이트 (결과 입력)"""
    try:
        execution = service.update_execution_result(
            execution_id=execution_id,
            status=data.status,
            result_summary=data.result_summary,
            result_detail=data.result_detail,
            vulnerabilities_found=data.vulnerabilities_found,
            severity_high=data.severity_high,
            severity_medium=data.severity_medium,
            severity_low=data.severity_low,
            info_count=data.info_count,
            error_message=data.error_message,
        )
        return _execution_to_response(execution)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/executions/{execution_id}/parse-result", response_model=VulnCheckExecutionResponse)
async def parse_execution_result_text(
    execution_id: int,
    payload: dict,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> VulnCheckExecutionResponse:
    """
    상세 결과 텍스트(붙여넣기) 자동 파싱

    요청 본문: { "content": "<scan output>", "format": "txt" | "json" | "csv" }
    format 미지정 시 "txt"로 처리합니다.
    """
    from app.services.vuln_result_parser import parse_result_file

    content = payload.get("content")
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=400, detail="분석할 결과 텍스트가 없습니다.")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="텍스트 크기가 10MB를 초과합니다.")

    fmt = (payload.get("format") or "txt").lower()
    if fmt not in {"txt", "json", "csv"}:
        fmt = "txt"
    pseudo_filename = f"pasted_result.{fmt}"

    parsed = parse_result_file(content, pseudo_filename)

    try:
        execution = service.update_execution_result(
            execution_id=execution_id,
            status=parsed.status,
            result_summary=parsed.result_summary,
            result_detail=parsed.result_detail,
            vulnerabilities_found=parsed.vulnerabilities_found,
            severity_high=parsed.severity_high,
            severity_medium=parsed.severity_medium,
            severity_low=parsed.severity_low,
            info_count=parsed.info_count,
            error_message=parsed.error_message,
        )
        return _execution_to_response(execution)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/executions/{execution_id}/upload-result", response_model=VulnCheckExecutionResponse)
async def upload_execution_result(
    execution_id: int,
    file: UploadFile = File(..., description="결과 파일 (TXT, JSON, CSV)"),
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> VulnCheckExecutionResponse:
    """
    실행 결과 파일 업로드 및 자동 파싱

    지원 형식:
    - TXT: ISMS-P 취약점 점검 보고서 형식 ([VULN], [WARN], [PASS], [INFO] 태그)
    - JSON: { "summary": { "vuln": N, "warn": N, "pass": N, "info": N }, ... }
    - CSV: severity, check_id, check_name, result, description 컬럼
    """
    from app.services.vuln_result_parser import parse_result_file

    # 파일 확장자 검증
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")
    filename = os.path.basename(file.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed = {"txt", "json", "csv", "log", "xml"}
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 허용: {', '.join(sorted(allowed))}",
        )

    # 파일 읽기 (최대 10MB)
    content_bytes = await file.read()
    if len(content_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기가 10MB를 초과합니다.")

    # 텍스트 디코딩 (UTF-8 우선, 실패 시 CP949/EUC-KR)
    content = None
    for encoding in ("utf-8", "utf-8-sig", "cp949", "euc-kr", "latin-1"):
        try:
            content = content_bytes.decode(encoding)
            break
        except (UnicodeDecodeError, LookupError):
            continue

    if content is None:
        raise HTTPException(status_code=400, detail="파일 인코딩을 인식할 수 없습니다.")

    # 파싱
    parsed = parse_result_file(content, filename)

    # 실행 결과 업데이트
    try:
        execution = service.update_execution_result(
            execution_id=execution_id,
            status=parsed.status,
            result_summary=parsed.result_summary,
            result_detail=parsed.result_detail,
            vulnerabilities_found=parsed.vulnerabilities_found,
            severity_high=parsed.severity_high,
            severity_medium=parsed.severity_medium,
            severity_low=parsed.severity_low,
            info_count=parsed.info_count,
            error_message=parsed.error_message,
        )
        return _execution_to_response(execution)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/executions/{execution_id}", response_model=VulnCheckExecutionResponse)
def get_execution(
    execution_id: int,
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnCheckExecutionResponse:
    """실행 결과 상세 조회"""
    execution = service.get_execution_by_id(execution_id)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="실행 결과를 찾을 수 없습니다.",
        )
    return _execution_to_response(execution)


# =============================================================================
# 통계 API
# =============================================================================

@router.get("/stats", response_model=VulnCheckStats)
def get_stats(
    service: VulnCheckService = Depends(get_vuln_check_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnCheckStats:
    """취약점 점검 통계"""
    stats = service.get_stats()
    return VulnCheckStats(**stats)
