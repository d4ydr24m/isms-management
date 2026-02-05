"""
위협 DB API 라우터
/api/v1/threats
Phase 2: FR-601
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.schemas.risk import (
    ThreatCreate,
    ThreatUpdate,
    ThreatResponse,
    ThreatList,
    ThreatCategoryCreate,
    ThreatCategoryResponse,
)
from app.services.risk_service import RiskService


router = APIRouter()


# =============================================================================
# 헬퍼 함수
# =============================================================================

def get_risk_service(db: Session = Depends(get_db)) -> RiskService:
    """RiskService 의존성"""
    return RiskService(db)


def threat_to_response(threat) -> ThreatResponse:
    """Threat 모델을 ThreatResponse로 변환"""
    return ThreatResponse(
        id=threat.id,
        code=threat.code,
        name=threat.name,
        description=threat.description,
        category_id=threat.category_id,
        category_name=threat.category.name if threat.category else None,
        threat_level=threat.threat_level,
        is_custom=threat.is_custom,
        is_active=threat.is_active,
        created_at=threat.created_at,
        updated_at=threat.updated_at,
    )


# =============================================================================
# 위협 분류 API
# =============================================================================

@router.get("/categories", response_model=List[ThreatCategoryResponse])
def get_threat_categories(
    parent_id: Optional[int] = Query(None, description="상위 분류 ID"),
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> List[ThreatCategoryResponse]:
    """
    위협 분류 목록 조회

    - **parent_id**: 상위 분류 ID (선택)
    - **is_active**: 활성 상태 필터 (선택)
    """
    items, _ = service.get_threat_categories(parent_id=parent_id, is_active=is_active)
    return [ThreatCategoryResponse.model_validate(item) for item in items]


@router.post("/categories", response_model=ThreatCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_threat_category(
    data: ThreatCategoryCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> ThreatCategoryResponse:
    """
    위협 분류 생성

    - **code**: 분류 코드 (필수, 고유)
    - **name**: 분류명 (필수)
    """
    try:
        category = service.create_threat_category(
            code=data.code,
            name=data.name,
            description=data.description,
            parent_id=data.parent_id,
            sort_order=data.sort_order,
        )
        return ThreatCategoryResponse.model_validate(category)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================================
# 4.3: 위협 API (FR-601)
# =============================================================================

@router.get("", response_model=ThreatList)
def get_threats(
    category_id: Optional[int] = Query(None, description="위협 분류 ID"),
    is_active: Optional[bool] = Query(True, description="활성 상태 필터"),
    search: Optional[str] = Query(None, description="검색어"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> ThreatList:
    """
    위협 목록 조회

    - **category_id**: 위협 분류 ID (선택)
    - **is_active**: 활성 상태 필터 (기본: True)
    - **search**: 검색어 (이름, 코드, 설명)
    """
    items, total = service.get_threats(
        category_id=category_id,
        is_active=is_active,
        search=search,
    )
    return ThreatList(
        items=[threat_to_response(item) for item in items],
        total=total,
    )


@router.post("", response_model=ThreatResponse, status_code=status.HTTP_201_CREATED)
def create_threat(
    data: ThreatCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> ThreatResponse:
    """
    커스텀 위협 생성

    - **code**: 위협 코드 (필수, 고유)
    - **name**: 위협명 (필수)
    - **threat_level**: 위협 등급 (1: 하, 2: 중, 3: 상)
    """
    try:
        threat = service.create_threat(
            code=data.code,
            name=data.name,
            description=data.description,
            category_id=data.category_id,
            threat_level=data.threat_level,
        )
        return threat_to_response(threat)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/by-asset-type/{type_id}", response_model=ThreatList)
def get_threats_by_asset_type(
    type_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> ThreatList:
    """
    자산 유형별 위협 조회

    해당 자산 유형에 매핑된 위협 목록을 반환합니다.
    """
    items = service.get_threats_by_asset_type(type_id)
    return ThreatList(
        items=[threat_to_response(item) for item in items],
        total=len(items),
    )


@router.get("/{threat_id}", response_model=ThreatResponse)
def get_threat(
    threat_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> ThreatResponse:
    """위협 상세 조회"""
    threat = service.get_threat_by_id(threat_id)
    if not threat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="위협을 찾을 수 없습니다.",
        )
    return threat_to_response(threat)


@router.put("/{threat_id}", response_model=ThreatResponse)
def update_threat(
    threat_id: int,
    data: ThreatUpdate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> ThreatResponse:
    """위협 수정"""
    try:
        threat = service.update_threat(
            threat_id=threat_id,
            **data.model_dump(exclude_unset=True),
        )
        return threat_to_response(threat)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/{threat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_threat(
    threat_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:delete")),
):
    """
    커스텀 위협 삭제 (비활성화)

    기본 제공 위협은 삭제할 수 없습니다.
    """
    try:
        service.delete_threat(threat_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
