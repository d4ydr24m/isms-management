"""
자산 관리 API 라우터
/api/v1/assets
Phase 2: FR-501 ~ FR-505
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.models.asset import AssetStatus, AssetAssignmentRole
from app.schemas.asset import (
    # 자산 유형
    AssetTypeCreate,
    AssetTypeUpdate,
    AssetTypeResponse,
    AssetTypeList,
    # 자산 분류
    AssetCategoryCreate,
    AssetCategoryUpdate,
    AssetCategoryResponse,
    AssetCategoryList,
    # 자산
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetList,
    # 가치 평가
    AssetValuationCreate,
    AssetValuationResponse,
    # 이력
    AssetHistoryResponse,
    AssetDisposalCreate,
    AssetLifecycleStats,
    # 담당자
    AssetAssignmentCreate,
    AssetAssignmentUpdate,
    AssetAssignmentResponse,
    AssetHandoverResponse,
    # 임포트
    AssetImportResult,
    # 통계
    AssetStats,
    AssetByTypeStats,
    AssetByDepartmentStats,
    AssetByImportanceStats,
)
from app.services.asset_service import AssetService


router = APIRouter()


# =============================================================================
# 헬퍼 함수
# =============================================================================

def get_asset_service(db: Session = Depends(get_db)) -> AssetService:
    """AssetService 의존성"""
    return AssetService(db)


def asset_to_response(asset, service: AssetService) -> AssetResponse:
    """Asset 모델을 AssetResponse로 변환"""
    valuation = service.get_current_valuation(asset.id)
    assignments = service.get_assignments(asset.id)
    assignee_names = []
    for a in assignments:
        name = (a.user.name if a.user else None) or (a.personnel.name if a.personnel else None)
        if name:
            assignee_names.append(name)
    return AssetResponse(
        id=asset.id,
        asset_code=asset.asset_code,
        name=asset.name,
        description=asset.description,
        asset_type_id=asset.asset_type_id,
        asset_type_name=asset.asset_type.name if asset.asset_type else None,
        asset_type_code=asset.asset_type.code if asset.asset_type else None,
        category_ids=[c.id for c in asset.categories],
        category_names=[c.name for c in asset.categories],
        location=asset.location,
        department_id=asset.department_id,
        department_name=asset.department.name if asset.department else None,
        owner_id=asset.owner_id,
        owner_name=asset.owner.name if asset.owner else None,
        personnel_owner_id=asset.personnel_owner_id,
        personnel_owner_name=asset.personnel_owner.name if hasattr(asset, 'personnel_owner') and asset.personnel_owner else None,
        assignee_names=assignee_names,
        ip_address=asset.ip_address,
        mac_address=asset.mac_address,
        hostname=asset.hostname,
        os_version=asset.os_version,
        url=asset.url if hasattr(asset, 'url') else None,
        service_version=asset.service_version if hasattr(asset, 'service_version') else None,
        serial_number=asset.serial_number,
        manufacturer=asset.manufacturer,
        model=asset.model,
        specifications=asset.specifications,
        acquisition_date=asset.acquisition_date,
        acquisition_cost=asset.acquisition_cost,
        warranty_end_date=asset.warranty_end_date,
        eol_date=asset.eol_date,
        disposal_date=asset.disposal_date,
        status=asset.status,
        is_active=asset.is_active,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
        importance_level=valuation.importance_level if valuation else None,
        confidentiality=valuation.confidentiality if valuation else None,
        integrity=valuation.integrity if valuation else None,
        availability=valuation.availability if valuation else None,
    )


# =============================================================================
# FR-501: 자산 유형 API
# =============================================================================

@router.get("/types", response_model=AssetTypeList)
def get_asset_types(
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> AssetTypeList:
    """
    자산 유형 목록 조회

    - **is_active**: 활성 상태 필터 (선택)
    """
    items, total = service.get_asset_types(is_active=is_active)
    return AssetTypeList(
        items=[AssetTypeResponse.model_validate(item) for item in items],
        total=total,
    )


@router.post("/types", response_model=AssetTypeResponse, status_code=status.HTTP_201_CREATED)
def create_asset_type(
    data: AssetTypeCreate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:create")),
) -> AssetTypeResponse:
    """
    자산 유형 생성

    - **code**: 유형 코드 (필수, 고유)
    - **name**: 유형명 (필수)
    """
    try:
        asset_type = service.create_asset_type(
            code=data.code,
            name=data.name,
            description=data.description,
            icon=data.icon,
            sort_order=data.sort_order,
        )
        return AssetTypeResponse.model_validate(asset_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================================
# FR-501: 자산 분류 API
# =============================================================================

@router.get("/categories", response_model=AssetCategoryList)
def get_asset_categories(
    parent_id: Optional[int] = Query(None, description="상위 분류 ID"),
    level: Optional[int] = Query(None, ge=1, le=3, description="분류 레벨"),
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> AssetCategoryList:
    """
    자산 분류 목록 조회 (계층 구조)

    - **parent_id**: 상위 분류 ID (선택)
    - **level**: 분류 레벨 1: 대분류, 2: 중분류, 3: 소분류 (선택)
    """
    items, total = service.get_asset_categories(
        parent_id=parent_id,
        level=level,
        is_active=is_active,
    )

    # 계층 구조로 변환 (level 1만 top-level, 나머지는 children으로 중첩)
    if not parent_id and not level:
        # 전체 조회 시: 트리 구조로 반환
        items_by_id = {item.id: item for item in items}
        top_level = []

        def build_response(item):
            resp = AssetCategoryResponse(
                id=item.id,
                code=item.code,
                name=item.name,
                description=item.description,
                level=item.level,
                parent_id=item.parent_id,
                sort_order=item.sort_order,
                is_active=item.is_active,
                created_at=item.created_at,
                updated_at=item.updated_at,
                children=[],
            )
            child_items = [i for i in items if i.parent_id == item.id]
            child_items.sort(key=lambda x: (x.sort_order, x.id))
            resp.children = [build_response(c) for c in child_items]
            return resp

        for item in items:
            if item.level == 1:
                top_level.append(build_response(item))
        top_level.sort(key=lambda x: (x.sort_order, x.id))

        return AssetCategoryList(items=top_level, total=len(top_level))
    else:
        # 필터 조회 시: flat 리스트 반환
        responses = []
        for item in items:
            resp = AssetCategoryResponse(
                id=item.id,
                code=item.code,
                name=item.name,
                description=item.description,
                level=item.level,
                parent_id=item.parent_id,
                sort_order=item.sort_order,
                is_active=item.is_active,
                created_at=item.created_at,
                updated_at=item.updated_at,
                children=[],
            )
            responses.append(resp)
        return AssetCategoryList(items=responses, total=total)


@router.post("/categories", response_model=AssetCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_asset_category(
    data: AssetCategoryCreate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:create")),
) -> AssetCategoryResponse:
    """
    자산 분류 생성

    - **code**: 분류 코드 (필수, 고유)
    - **name**: 분류명 (필수)
    - **level**: 레벨 (1: 대, 2: 중, 3: 소)
    - **parent_id**: 상위 분류 ID (중/소분류 시 필수)
    """
    try:
        category = service.create_asset_category(
            code=data.code,
            name=data.name,
            level=data.level,
            parent_id=data.parent_id,
            description=data.description,
            sort_order=data.sort_order,
        )
        return AssetCategoryResponse.model_validate(category)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/categories/{category_id}", response_model=AssetCategoryResponse)
def update_asset_category(
    category_id: int,
    data: AssetCategoryUpdate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:update")),
) -> AssetCategoryResponse:
    """자산 분류 수정"""
    try:
        category = service.update_asset_category(
            category_id=category_id,
            **data.model_dump(exclude_unset=True),
        )
        return AssetCategoryResponse.model_validate(category)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_category(
    category_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:delete")),
):
    """
    자산 분류 삭제

    - 하위 분류가 있으면 삭제 불가
    - 연결된 자산이 있으면 삭제 불가
    """
    try:
        service.delete_asset_category(category_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =============================================================================
# FR-502: 자산 CRUD API
# =============================================================================

@router.get("", response_model=AssetList)
def get_assets(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="검색어"),
    asset_type_id: Optional[int] = Query(None, description="자산 유형 ID"),
    category_id: Optional[int] = Query(None, description="분류 ID"),
    department_id: Optional[int] = Query(None, description="부서 ID"),
    status: Optional[str] = Query(None, description="상태"),
    is_active: Optional[bool] = Query(True, description="활성 상태"),
    importance_level: Optional[int] = Query(None, ge=1, le=3, description="중요도"),
    eol_status: Optional[str] = Query(None, description="EoL 상태 (expired/soon/none)"),
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> AssetList:
    """
    자산 목록 조회 (페이지네이션, 필터)

    - **search**: 이름, 코드, IP, 호스트명 검색
    - **asset_type_id**: 자산 유형 필터
    - **department_id**: 부서 필터
    - **status**: 상태 필터 (도입/운영/변경/폐기)
    - **importance_level**: 중요도 필터 (1: 하, 2: 중, 3: 상)
    - **eol_status**: EoL 상태 필터 (expired: 만료, soon: 90일 이내, none: 미설정)
    """
    result = service.search_assets(
        search=search,
        asset_type_id=asset_type_id,
        category_id=category_id,
        department_id=department_id,
        status=status,
        is_active=is_active,
        importance_level=importance_level,
        eol_status=eol_status,
        page=page,
        size=size,
    )

    return AssetList(
        items=[asset_to_response(asset, service) for asset in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    data: AssetCreate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:create")),
) -> AssetResponse:
    """
    자산 등록

    - 자산코드는 자동 채번됩니다 (AST-{유형코드}-{년월}-{순번})
    - 초기 상태는 "도입"입니다
    """
    try:
        asset = service.create_asset(
            user_id=current_user.id,
            **data.model_dump(),
        )
        return asset_to_response(asset, service)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/stats", response_model=AssetStats)
def get_asset_stats(
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> AssetStats:
    """전체 자산 통계"""
    stats = service.get_stats()
    return AssetStats(**stats)


@router.get("/by-type", response_model=List[AssetByTypeStats])
def get_assets_by_type(
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> List[AssetByTypeStats]:
    """유형별 자산 통계"""
    return [AssetByTypeStats(**item) for item in service.get_by_type()]


@router.get("/by-department", response_model=List[AssetByDepartmentStats])
def get_assets_by_department(
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> List[AssetByDepartmentStats]:
    """부서별 자산 통계"""
    return [AssetByDepartmentStats(**item) for item in service.get_by_department()]


@router.get("/by-importance", response_model=List[AssetByImportanceStats])
def get_assets_by_importance(
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> List[AssetByImportanceStats]:
    """중요도별 자산 통계"""
    return [AssetByImportanceStats(**item) for item in service.get_by_importance()]


@router.get("/lifecycle-stats", response_model=AssetLifecycleStats)
def get_lifecycle_stats(
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> AssetLifecycleStats:
    """자산 생명주기 통계"""
    stats = service.get_lifecycle_stats()
    return AssetLifecycleStats(**stats)


@router.get("/template")
def get_import_template(
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
):
    """
    자산 임포트 템플릿 다운로드

    엑셀 파일 형식으로 템플릿을 다운로드합니다.
    """
    try:
        content = service.get_import_template()
        return StreamingResponse(
            BytesIO(content),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=asset_import_template.xlsx"
            },
        )
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/export")
def export_assets(
    asset_type_id: Optional[int] = Query(None, description="자산 유형 ID"),
    department_id: Optional[int] = Query(None, description="부서 ID"),
    status: Optional[str] = Query(None, description="상태"),
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
):
    """
    자산 목록 엑셀 내보내기

    필터 조건에 맞는 자산을 엑셀 파일로 다운로드합니다.
    """
    try:
        filters = {}
        if asset_type_id:
            filters["asset_type_id"] = asset_type_id
        if department_id:
            filters["department_id"] = department_id
        if status:
            filters["status"] = status

        content = service.export_assets(filters or None)
        return StreamingResponse(
            BytesIO(content),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=assets_export.xlsx"
            },
        )
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/import", response_model=AssetImportResult)
async def import_assets(
    file: UploadFile = File(...),
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:create")),
) -> AssetImportResult:
    """
    자산 엑셀 대량 등록

    엑셀 파일을 업로드하여 자산을 일괄 등록합니다.
    """
    try:
        file_content = await file.read()
        result = service.import_assets(file_content, current_user.id)
        return AssetImportResult(**result)
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> AssetResponse:
    """자산 상세 조회"""
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자산을 찾을 수 없습니다.",
        )
    return asset_to_response(asset, service)


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    data: AssetUpdate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:update")),
) -> AssetResponse:
    """자산 수정"""
    try:
        asset = service.update_asset(
            asset_id=asset_id,
            user_id=current_user.id,
            **data.model_dump(exclude_unset=True),
        )
        return asset_to_response(asset, service)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:delete")),
):
    """자산 비활성화 (소프트 삭제)"""
    try:
        service.delete_asset(asset_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# =============================================================================
# FR-503: 자산 가치 평가 API
# =============================================================================

@router.get("/{asset_id}/valuation", response_model=Optional[AssetValuationResponse])
def get_current_valuation(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> AssetValuationResponse:
    """현재 가치 평가 조회"""
    # 자산 확인
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자산을 찾을 수 없습니다.",
        )

    valuation = service.get_current_valuation(asset_id)
    if not valuation:
        return JSONResponse(content=None, status_code=status.HTTP_204_NO_CONTENT)

    response = AssetValuationResponse.model_validate(valuation)
    if valuation.evaluator:
        response.evaluator_name = valuation.evaluator.name
    return response


@router.post("/{asset_id}/valuation", response_model=AssetValuationResponse, status_code=status.HTTP_201_CREATED)
def create_valuation(
    asset_id: int,
    data: AssetValuationCreate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:update")),
) -> AssetValuationResponse:
    """
    자산 가치 평가 생성

    - **confidentiality**: 기밀성 (1: 하, 2: 중, 3: 상)
    - **integrity**: 무결성 (1: 하, 2: 중, 3: 상)
    - **availability**: 가용성 (1: 하, 2: 중, 3: 상)
    - 중요도는 MAX(C, I, A)로 자동 계산됩니다
    """
    try:
        valuation = service.create_valuation(
            asset_id=asset_id,
            confidentiality=data.confidentiality,
            integrity=data.integrity,
            availability=data.availability,
            user_id=current_user.id,
            evaluation_reason=data.evaluation_reason,
        )
        response = AssetValuationResponse.model_validate(valuation)
        response.evaluator_name = current_user.name
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{asset_id}/valuation/history", response_model=List[AssetValuationResponse])
def get_valuation_history(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> List[AssetValuationResponse]:
    """가치 평가 이력 조회"""
    # 자산 확인
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자산을 찾을 수 없습니다.",
        )

    valuations = service.get_valuation_history(asset_id)
    responses = []
    for v in valuations:
        response = AssetValuationResponse.model_validate(v)
        if v.evaluator:
            response.evaluator_name = v.evaluator.name
        responses.append(response)
    return responses


# =============================================================================
# FR-504: 자산 이력 API
# =============================================================================

@router.get("/{asset_id}/history", response_model=List[AssetHistoryResponse])
def get_asset_history(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> List[AssetHistoryResponse]:
    """자산 변경 이력 조회"""
    # 자산 확인
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자산을 찾을 수 없습니다.",
        )

    histories = service.get_asset_history(asset_id)
    responses = []
    for h in histories:
        response = AssetHistoryResponse.model_validate(h)
        if h.changer:
            response.changer_name = h.changer.name
        responses.append(response)
    return responses


@router.post("/{asset_id}/dispose", response_model=AssetResponse)
def dispose_asset(
    asset_id: int,
    data: AssetDisposalCreate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:delete")),
) -> AssetResponse:
    """
    자산 폐기 처리

    - 자산 상태를 "폐기"로 변경합니다
    - 폐기 상세 정보와 데이터 삭제 증적을 기록합니다
    """
    try:
        asset = service.dispose_asset(
            asset_id=asset_id,
            user_id=current_user.id,
            disposal_date=data.disposal_date,
            disposal_reason=data.disposal_reason,
            disposal_method=data.disposal_method,
            data_deletion_confirmed=data.data_deletion_confirmed,
            data_deletion_method=data.data_deletion_method,
            data_deletion_evidence_id=data.data_deletion_evidence_id,
            remarks=data.remarks,
        )
        return asset_to_response(asset, service)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# =============================================================================
# FR-505: 자산 담당자 API
# =============================================================================

@router.get("/{asset_id}/assignments", response_model=List[AssetAssignmentResponse])
def get_assignments(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> List[AssetAssignmentResponse]:
    """자산 담당자 목록 조회"""
    # 자산 확인
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자산을 찾을 수 없습니다.",
        )

    assignments = service.get_assignments(asset_id)
    responses = []
    for a in assignments:
        response = AssetAssignmentResponse.model_validate(a)
        if a.user:
            response.user_name = a.user.name
            response.user_email = a.user.email
        elif a.personnel:
            response.user_name = a.personnel.name
            response.user_email = a.personnel.email or ""
        if a.assigner:
            response.assigner_name = a.assigner.name
        responses.append(response)
    return responses


@router.post("/{asset_id}/assignments", response_model=AssetAssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    asset_id: int,
    data: AssetAssignmentCreate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:update")),
) -> AssetAssignmentResponse:
    """
    담당자 할당

    - **user_id**: 담당자 ID
    - **role**: 역할 (owner/manager/user)
    """
    try:
        assignment = service.create_assignment(
            asset_id=asset_id,
            user_id=data.user_id,
            role=data.role,
            assigned_by=current_user.id,
            remarks=data.remarks,
        )
        response = AssetAssignmentResponse.model_validate(assignment)
        if assignment.user:
            response.user_name = assignment.user.name
            response.user_email = assignment.user.email
        elif assignment.personnel:
            response.user_name = assignment.personnel.name
            response.user_email = assignment.personnel.email or ""
        response.assigner_name = current_user.name
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{asset_id}/assignments/{assignment_id}", response_model=AssetAssignmentResponse)
def update_assignment(
    asset_id: int,
    assignment_id: int,
    data: AssetAssignmentUpdate,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:update")),
) -> AssetAssignmentResponse:
    """담당자 역할 변경"""
    try:
        assignment = service.update_assignment(
            assignment_id=assignment_id,
            user_id=current_user.id,
            **data.model_dump(exclude_unset=True),
        )

        # asset_id 일치 확인
        if assignment.asset_id != asset_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="자산 ID가 일치하지 않습니다.",
            )

        response = AssetAssignmentResponse.model_validate(assignment)
        if assignment.user:
            response.user_name = assignment.user.name
            response.user_email = assignment.user.email
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/{asset_id}/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    asset_id: int,
    assignment_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:update")),
):
    """담당자 해제"""
    try:
        service.delete_assignment(assignment_id, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/{asset_id}/handover", response_model=List[AssetHandoverResponse])
def get_handover_history(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
    current_user: User = Depends(require_permission("asset:read")),
) -> List[AssetHandoverResponse]:
    """인수인계 이력 조회"""
    # 자산 확인
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="자산을 찾을 수 없습니다.",
        )

    handovers = service.get_handover_history(asset_id)
    responses = []
    for h in handovers:
        response = AssetHandoverResponse.model_validate(h)
        if h.from_user:
            response.from_user_name = h.from_user.name
        if h.to_user:
            response.to_user_name = h.to_user.name
        if h.approver:
            response.approver_name = h.approver.name
        responses.append(response)
    return responses
