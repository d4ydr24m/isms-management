"""
위험-통제항목 연계 API
Phase 2: 섹션 5.4 위험-통제항목 연계 구현

엔드포인트:
- POST /api/v1/risk-control-linkage/link - 처리 계획과 통제항목 연결
- GET /api/v1/risk-control-linkage/treatment/{id}/controls - 연결된 통제항목 조회
- GET /api/v1/risk-control-linkage/control/{id}/treatments - 연결된 처리 계획 조회
- DELETE /api/v1/risk-control-linkage/unlink - 연결 해제
- GET /api/v1/risk-control-linkage/control/{id}/effectiveness - 통제 효과성 분석
- GET /api/v1/risk-control-linkage/matrix - 위험-통제 매트릭스
- GET /api/v1/risk-control-linkage/treatment/{id}/residual-trend - 잔여 위험 추이
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.services.risk_control_linkage_service import RiskControlLinkageService


router = APIRouter(prefix="/risk-control-linkage", tags=["risk-control-linkage"])


# ============================================================================
# Pydantic 스키마
# ============================================================================


class LinkControlsRequest(BaseModel):
    """통제항목 연결 요청"""
    treatment_plan_id: int = Field(..., description="위험 처리 계획 ID")
    control_item_ids: List[int] = Field(..., description="연결할 통제항목 ID 목록")
    link_type: str = Field(
        default="primary",
        description="연결 유형 (primary: 주요, secondary: 부차적, related: 관련)",
    )
    effectiveness_rating: Optional[float] = Field(
        default=None,
        description="효과성 등급 (0.0 ~ 1.0)",
        ge=0.0,
        le=1.0,
    )
    remarks: Optional[str] = Field(default=None, description="비고")

    @field_validator("link_type")
    @classmethod
    def validate_link_type(cls, v: str) -> str:
        valid_types = ("primary", "secondary", "related")
        if v not in valid_types:
            raise ValueError(f"link_type은 {valid_types} 중 하나여야 합니다")
        return v


class UnlinkControlRequest(BaseModel):
    """통제항목 연결 해제 요청"""
    treatment_plan_id: int = Field(..., description="위험 처리 계획 ID")
    control_item_id: int = Field(..., description="통제항목 ID")


class BulkLinkRequest(BaseModel):
    """대량 연결 요청"""
    links: List[LinkControlsRequest] = Field(..., description="연결 데이터 목록")


class LinkResponse(BaseModel):
    """연결 응답"""
    id: int
    treatment_plan_id: int
    control_item_id: int
    link_type: str
    effectiveness_rating: Optional[float] = None
    created_at: Any
    remarks: Optional[str] = None

    model_config = {"from_attributes": True}


class ControlItemBrief(BaseModel):
    """통제항목 간략 정보"""
    id: int
    code: str
    title: str

    model_config = {"from_attributes": True}


class TreatmentPlanBrief(BaseModel):
    """처리 계획 간략 정보"""
    id: int
    strategy: str
    status: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class LinkedControlDetailResponse(BaseModel):
    """연결된 통제항목 상세 응답"""
    id: int
    control_item: ControlItemBrief
    link_type: str
    effectiveness_rating: Optional[float] = None
    created_at: Any
    remarks: Optional[str] = None


class EffectivenessAnalysisResponse(BaseModel):
    """통제 효과성 분석 응답"""
    control_item_id: int
    linked_treatment_count: int
    average_effectiveness: float
    implementation_rate: float
    residual_risk_summary: Dict[str, Any]


class CoverageAnalysis(BaseModel):
    """커버리지 분석"""
    total_risks: int
    controlled_risks: int
    coverage_percentage: float


class RiskControlMatrixResponse(BaseModel):
    """위험-통제 매트릭스 응답"""
    matrix: List[Dict[str, Any]]
    coverage_analysis: CoverageAnalysis
    uncontrolled_risks: List[Dict[str, Any]]
    control_summary: Dict[str, Any]


class ResidualRiskTrendResponse(BaseModel):
    """잔여 위험 추이 응답"""
    treatment_plan_id: int
    initial_risk_score: int
    current_residual_score: int
    trend_data: List[Dict[str, Any]]
    reduction_percentage: float


class BulkLinkResponse(BaseModel):
    """대량 연결 응답"""
    success_count: int
    failed_count: int


# ============================================================================
# API 엔드포인트
# ============================================================================


@router.post(
    "/link",
    response_model=List[LinkResponse],
    status_code=status.HTTP_201_CREATED,
    summary="위험 처리 계획과 통제항목 연결",
)
async def link_treatment_to_controls(
    request: LinkControlsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[LinkResponse]:
    """
    위험 처리 계획에 통제항목을 연결합니다.

    - **treatment_plan_id**: 위험 처리 계획 ID
    - **control_item_ids**: 연결할 통제항목 ID 목록
    - **link_type**: 연결 유형 (primary/secondary/related)
    - **effectiveness_rating**: 효과성 등급 (0.0 ~ 1.0, 선택)
    """
    service = RiskControlLinkageService(db)

    try:
        links = service.link_treatment_to_controls(
            treatment_plan_id=request.treatment_plan_id,
            control_item_ids=request.control_item_ids,
            link_type=request.link_type,
            effectiveness_rating=request.effectiveness_rating,
            user_id=current_user.id,
            remarks=request.remarks,
        )
        return links
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/treatment/{treatment_plan_id}/controls",
    response_model=List[LinkedControlDetailResponse],
    summary="연결된 통제항목 조회",
)
async def get_linked_controls(
    treatment_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[LinkedControlDetailResponse]:
    """
    위험 처리 계획에 연결된 통제항목 목록을 조회합니다.
    """
    service = RiskControlLinkageService(db)
    return service.get_linked_controls_with_details(treatment_plan_id)


@router.get(
    "/control/{control_item_id}/treatments",
    response_model=List[TreatmentPlanBrief],
    summary="통제항목에 연결된 처리 계획 조회",
)
async def get_treatments_by_control(
    control_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[TreatmentPlanBrief]:
    """
    통제항목에 연결된 위험 처리 계획 목록을 조회합니다.
    """
    service = RiskControlLinkageService(db)
    treatments = service.get_treatments_by_control(control_item_id)
    return treatments


@router.delete(
    "/unlink",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="연결 해제",
)
async def unlink_treatment_from_control(
    request: UnlinkControlRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """
    위험 처리 계획과 통제항목 간의 연결을 해제합니다.
    """
    service = RiskControlLinkageService(db)

    try:
        service.unlink_treatment_from_control(
            treatment_plan_id=request.treatment_plan_id,
            control_item_id=request.control_item_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get(
    "/control/{control_item_id}/effectiveness",
    response_model=EffectivenessAnalysisResponse,
    summary="통제 효과성 분석",
)
async def analyze_control_effectiveness(
    control_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EffectivenessAnalysisResponse:
    """
    통제항목의 효과성을 분석합니다.

    - 연결된 처리 계획 수
    - 평균 효과성 등급
    - 이행률
    - 잔여 위험 요약
    """
    service = RiskControlLinkageService(db)
    return service.analyze_control_effectiveness(control_item_id)


@router.get(
    "/matrix",
    response_model=RiskControlMatrixResponse,
    summary="위험-통제 매트릭스",
)
async def get_risk_control_matrix(
    scenario_id: Optional[int] = Query(
        default=None,
        description="시나리오 ID (선택, 필터링용)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RiskControlMatrixResponse:
    """
    위험-통제 매핑 매트릭스를 생성합니다.

    - 위험과 통제항목 간의 연결 관계
    - 커버리지 분석 (통제되지 않은 위험 식별)
    - 통제항목별 요약
    """
    service = RiskControlLinkageService(db)
    return service.get_risk_control_matrix(scenario_id=scenario_id)


@router.get(
    "/treatment/{treatment_plan_id}/residual-trend",
    response_model=ResidualRiskTrendResponse,
    summary="잔여 위험 추이 분석",
)
async def calculate_residual_risk_trend(
    treatment_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ResidualRiskTrendResponse:
    """
    통제 이행에 따른 잔여 위험 추이를 분석합니다.

    - 초기 위험 점수
    - 현재 잔여 위험 점수
    - 시간별 추이 데이터
    - 위험 감소율
    """
    service = RiskControlLinkageService(db)

    try:
        return service.calculate_residual_risk_trend(treatment_plan_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/bulk-link",
    response_model=BulkLinkResponse,
    summary="대량 연결 작업",
)
async def bulk_link_controls(
    request: BulkLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> BulkLinkResponse:
    """
    여러 위험 처리 계획에 통제항목을 대량으로 연결합니다.
    """
    service = RiskControlLinkageService(db)

    links_data = [
        {
            "treatment_plan_id": link.treatment_plan_id,
            "control_item_ids": link.control_item_ids,
            "link_type": link.link_type,
            "effectiveness_rating": link.effectiveness_rating,
        }
        for link in request.links
    ]

    return service.bulk_link_controls(
        links_data=links_data,
        user_id=current_user.id,
    )
