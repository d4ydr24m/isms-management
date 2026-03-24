"""
감사 로그 API

5.9 감사 추적 시스템 구현 (FR-206)
- 감사 로그 조회
- 감사 로그 내보내기
- 해시 체인 무결성 검증
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.services.audit_log_service import AuditLogService
from app.schemas.audit import AuditLogResponse, AuditLogList

router = APIRouter(prefix="/audit-logs", tags=["감사 로그"])


@router.get("", response_model=AuditLogList)
def list_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    ip_address: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("system:admin")),
):
    """
    감사 로그 조회

    관리자만 조회 가능

    - **user_id**: 사용자 ID 필터
    - **action**: 액션 필터 (create/read/update/delete/login/logout)
    - **resource_type**: 리소스 타입 필터 (user/evidence/audit 등)
    - **resource_id**: 리소스 ID 필터
    - **start_date**: 시작일 필터
    - **end_date**: 종료일 필터
    - **ip_address**: IP 주소 필터
    """
    service = AuditLogService(db)
    logs, total = service.list_logs(
        page=page,
        size=size,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        start_date=start_date,
        end_date=end_date,
        ip_address=ip_address,
    )

    items = []
    for log in logs:
        items.append(AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=log.user_email,
            user_name=log.user_name,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            old_value=log.old_value,
            new_value=log.new_value,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            request_method=log.request_method,
            request_path=log.request_path,
            status_code=log.status_code,
            error_message=log.error_message,
            previous_hash=log.previous_hash,
            current_hash=log.current_hash,
            created_at=log.created_at,
        ))

    return AuditLogList(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/export")
def export_audit_logs(
    format: str = Query("csv", regex="^(csv|json)$"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("system:admin")),
):
    """
    감사 로그 내보내기

    - **format**: 출력 형식 (csv 또는 json)
    - **start_date**: 시작일
    - **end_date**: 종료일
    """
    service = AuditLogService(db)
    content = service.export_logs(
        format=format,
        start_date=start_date,
        end_date=end_date,
    )

    if format == "json":
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            },
        )
    else:
        return Response(
            content=content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            },
        )


@router.get("/verify")
def verify_hash_chain(
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("system:admin")),
):
    """
    해시 체인 무결성 검증

    최근 limit 개의 로그에 대해 해시 체인 검증

    - **limit**: 검증할 로그 수 (기본 1000)
    """
    service = AuditLogService(db)
    result = service.verify_hash_chain(limit=limit)

    return result
