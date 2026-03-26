"""
취약점 DB API 라우터
/api/v1/vulnerabilities
Phase 2: FR-602
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.schemas.risk import (
    VulnerabilityCreate,
    VulnerabilityUpdate,
    VulnerabilityResponse,
    VulnerabilityList,
    VulnerabilityCategoryCreate,
    VulnerabilityCategoryResponse,
    VulnerabilityAssessmentCreate,
    VulnerabilityAssessmentResponse,
    VulnerabilityAssessmentList,
)
from app.services.risk_service import RiskService


router = APIRouter()


# =============================================================================
# 헬퍼 함수
# =============================================================================

def get_risk_service(db: Session = Depends(get_db)) -> RiskService:
    """RiskService 의존성"""
    return RiskService(db)


def vulnerability_to_response(vuln) -> VulnerabilityResponse:
    """Vulnerability 모델을 VulnerabilityResponse로 변환"""
    return VulnerabilityResponse(
        id=vuln.id,
        code=vuln.code,
        name=vuln.name,
        description=vuln.description,
        category_id=vuln.category_id,
        category_name=vuln.category.name if vuln.category else None,
        vulnerability_level=vuln.vulnerability_level,
        is_custom=vuln.is_custom,
        is_active=vuln.is_active,
        created_at=vuln.created_at,
        updated_at=vuln.updated_at,
    )


def assessment_to_response(assessment) -> VulnerabilityAssessmentResponse:
    """VulnerabilityAssessment 모델을 응답으로 변환"""
    return VulnerabilityAssessmentResponse(
        id=assessment.id,
        asset_id=assessment.asset_id,
        asset_name=assessment.asset.name if assessment.asset else None,
        asset_code=assessment.asset.asset_code if assessment.asset else None,
        vulnerability_id=assessment.vulnerability_id,
        vulnerability_name=assessment.vulnerability.name if assessment.vulnerability else None,
        vulnerability_code=assessment.vulnerability.code if assessment.vulnerability else None,
        is_vulnerable=assessment.is_vulnerable,
        assessment_date=assessment.assessment_date,
        assessed_by=assessment.assessed_by,
        assessor_name=assessment.assessor.name if assessment.assessor else None,
        findings=assessment.findings,
        remediation_status=assessment.remediation_status,
        remediation_date=assessment.remediation_date,
        remarks=assessment.remarks,
        created_at=assessment.created_at,
    )


# =============================================================================
# 취약점 분류 API
# =============================================================================

@router.get("/categories", response_model=List[VulnerabilityCategoryResponse])
def get_vulnerability_categories(
    parent_id: Optional[int] = Query(None, description="상위 분류 ID"),
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> List[VulnerabilityCategoryResponse]:
    """
    취약점 분류 목록 조회

    - **parent_id**: 상위 분류 ID (선택)
    - **is_active**: 활성 상태 필터 (선택)
    """
    items, _ = service.get_vulnerability_categories(parent_id=parent_id, is_active=is_active)
    return [VulnerabilityCategoryResponse.model_validate(item) for item in items]


# =============================================================================
# 4.4: 취약점 API (FR-602)
# =============================================================================

@router.get("", response_model=VulnerabilityList)
def get_vulnerabilities(
    category_id: Optional[int] = Query(None, description="취약점 분류 ID"),
    vulnerability_level: Optional[int] = Query(None, description="취약점 등급 (1-5)"),
    is_active: Optional[bool] = Query(True, description="활성 상태 필터"),
    is_custom: Optional[bool] = Query(None, description="커스텀 여부"),
    search: Optional[str] = Query(None, description="검색어"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnerabilityList:
    """
    취약점 목록 조회
    """
    items, total = service.get_vulnerabilities(
        category_id=category_id,
        is_active=is_active,
        search=search,
    )
    # 추가 필터 적용
    if vulnerability_level is not None:
        items = [i for i in items if i.vulnerability_level == vulnerability_level]
    if is_custom is not None:
        items = [i for i in items if i.is_custom == is_custom]
    total = len(items)
    # 페이지네이션
    start = (page - 1) * limit
    items = items[start:start + limit]
    return VulnerabilityList(
        items=[vulnerability_to_response(item) for item in items],
        total=total,
    )


@router.post("", response_model=VulnerabilityResponse, status_code=status.HTTP_201_CREATED)
def create_vulnerability(
    data: VulnerabilityCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> VulnerabilityResponse:
    """
    커스텀 취약점 생성

    - **code**: 취약점 코드 (필수, 고유)
    - **name**: 취약점명 (필수)
    - **vulnerability_level**: 취약점 등급 (1: 하, 2: 중, 3: 상)
    """
    try:
        vuln = service.create_vulnerability(
            code=data.code,
            name=data.name,
            description=data.description,
            category_id=data.category_id,
            vulnerability_level=data.vulnerability_level,
        )
        return vulnerability_to_response(vuln)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/assessments", response_model=VulnerabilityAssessmentList)
def get_vulnerability_assessments(
    asset_id: Optional[int] = Query(None, description="자산 ID"),
    vulnerability_id: Optional[int] = Query(None, description="취약점 ID"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnerabilityAssessmentList:
    """
    취약점 점검 결과 조회

    - **asset_id**: 자산 ID (선택)
    - **vulnerability_id**: 취약점 ID (선택)
    """
    result = service.get_vulnerability_assessments(
        asset_id=asset_id,
        vulnerability_id=vulnerability_id,
        page=page,
        size=size,
    )
    return VulnerabilityAssessmentList(
        items=[assessment_to_response(item) for item in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.post("/assessments", response_model=VulnerabilityAssessmentResponse, status_code=status.HTTP_201_CREATED)
def create_vulnerability_assessment(
    data: VulnerabilityAssessmentCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> VulnerabilityAssessmentResponse:
    """
    취약점 점검 결과 등록

    - **asset_id**: 자산 ID (필수)
    - **vulnerability_id**: 취약점 ID (필수)
    - **is_vulnerable**: 취약 여부 (필수)
    - **assessment_date**: 점검일 (필수)
    """
    try:
        assessment = service.create_vulnerability_assessment(
            asset_id=data.asset_id,
            vulnerability_id=data.vulnerability_id,
            is_vulnerable=data.is_vulnerable,
            assessment_date=data.assessment_date,
            user_id=current_user.id,
            findings=data.findings,
            remediation_status=data.remediation_status,
            remarks=data.remarks,
        )
        return assessment_to_response(assessment)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{vulnerability_id}", response_model=VulnerabilityResponse)
def get_vulnerability(
    vulnerability_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> VulnerabilityResponse:
    """취약점 상세 조회"""
    vuln = service.get_vulnerability_by_id(vulnerability_id)
    if not vuln:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="취약점을 찾을 수 없습니다.",
        )
    return vulnerability_to_response(vuln)


@router.put("/{vulnerability_id}", response_model=VulnerabilityResponse)
def update_vulnerability(
    vulnerability_id: int,
    data: VulnerabilityUpdate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> VulnerabilityResponse:
    """취약점 수정"""
    try:
        vuln = service.update_vulnerability(
            vulnerability_id=vulnerability_id,
            **data.model_dump(exclude_unset=True),
        )
        return vulnerability_to_response(vuln)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/{vulnerability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vulnerability(
    vulnerability_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:delete")),
):
    """
    커스텀 취약점 삭제 (비활성화)

    기본 제공 취약점은 삭제할 수 없습니다.
    """
    try:
        service.delete_vulnerability(vulnerability_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
