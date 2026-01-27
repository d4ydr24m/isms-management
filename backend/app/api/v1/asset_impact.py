"""
자산 변경 영향 분석 API
Phase 2: 5.3 자산 변경 시 위험 영향 분석 구현

엔드포인트:
- POST /api/v1/asset-impact/valuation-change/analyze - 가치 변경 영향 분석
- POST /api/v1/asset-impact/valuation-change/apply - 가치 변경 적용
- GET /api/v1/asset-impact/disposal/{asset_id}/analyze - 폐기 영향 분석
- POST /api/v1/asset-impact/disposal/{asset_id}/process - 폐기 처리
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.user import User
from app.services.asset_impact_service import (
    AssetImpactService,
    ValuationChangeImpact,
    DisposalImpact,
)

router = APIRouter(prefix="/asset-impact", tags=["자산 영향 분석"])


# ========================================================================
# Pydantic 스키마
# ========================================================================

class CIAValuation(BaseModel):
    """CIA 가치 평가 스키마"""
    confidentiality: int = Field(..., ge=1, le=3, description="기밀성 (1-3)")
    integrity: int = Field(..., ge=1, le=3, description="무결성 (1-3)")
    availability: int = Field(..., ge=1, le=3, description="가용성 (1-3)")


class ValuationChangeAnalyzeRequest(BaseModel):
    """가치 변경 영향 분석 요청"""
    asset_id: int = Field(..., description="자산 ID")
    new_valuation: CIAValuation = Field(..., description="새로운 CIA 평가")


class ValuationChangeApplyRequest(BaseModel):
    """가치 변경 적용 요청"""
    asset_id: int = Field(..., description="자산 ID")
    new_valuation: CIAValuation = Field(..., description="새로운 CIA 평가")
    auto_recalculate: bool = Field(
        default=True,
        description="관련 위험 자동 재계산 여부"
    )


class DisposalProcessRequest(BaseModel):
    """폐기 처리 요청"""
    disposal_reason: str = Field(..., min_length=1, max_length=500, description="폐기 사유")


class AssessmentImpactResponse(BaseModel):
    """개별 위험 평가 영향 응답"""
    assessment_id: int
    scenario_id: int
    before_dor: int
    after_dor: int
    before_level: str
    after_level: str
    level_changed: bool


class GradeChangeStats(BaseModel):
    """등급 변화 통계"""
    upgraded: int = Field(..., description="등급 상승 수")
    downgraded: int = Field(..., description="등급 하락 수")
    unchanged: int = Field(..., description="등급 유지 수")


class ValuationChangeImpactResponse(BaseModel):
    """가치 변경 영향 분석 응답"""
    success: bool = True
    asset_id: int
    asset_name: str
    current_importance: int
    new_importance: int
    affected_assessments: list
    grade_change_stats: GradeChangeStats


class ValuationChangeApplyResponse(BaseModel):
    """가치 변경 적용 응답"""
    success: bool
    valuation_updated: bool
    old_importance: int
    new_importance: int
    risks_recalculated: int


class ScenarioImpactResponse(BaseModel):
    """시나리오 영향 응답"""
    scenario_id: int
    scenario_name: str
    assessment_count: int


class DisposalImpactResponse(BaseModel):
    """폐기 영향 분석 응답"""
    success: bool = True
    asset_id: int
    asset_name: str
    affected_assessments: list
    affected_scenarios: list
    has_active_treatments: bool
    can_safely_dispose: bool
    warnings: list


class DisposalProcessResponse(BaseModel):
    """폐기 처리 응답"""
    success: bool
    asset_deactivated: bool
    assessments_updated: int
    disposal_date: str


# ========================================================================
# API 엔드포인트
# ========================================================================

@router.post(
    "/valuation-change/analyze",
    response_model=ValuationChangeImpactResponse,
    summary="자산 가치 변경 영향 분석",
    description="자산 가치(CIA) 변경 시 관련 위험 평가에 미치는 영향을 분석합니다."
)
async def analyze_valuation_change(
    request: ValuationChangeAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    자산 가치 변경 영향 분석

    - 변경 전후 DoR(위험도) 비교
    - 영향 받는 위험 평가 목록
    - 등급 변화 통계 (상승/하락/유지)
    """
    try:
        service = AssetImpactService(db)
        result = service.analyze_valuation_change_impact(
            asset_id=request.asset_id,
            new_valuation={
                "confidentiality": request.new_valuation.confidentiality,
                "integrity": request.new_valuation.integrity,
                "availability": request.new_valuation.availability,
            }
        )

        return {
            "success": True,
            "asset_id": result.asset_id,
            "asset_name": result.asset_name,
            "current_importance": result.current_importance,
            "new_importance": result.new_importance,
            "affected_assessments": result.affected_assessments,
            "grade_change_stats": result.grade_change_stats,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"영향 분석 중 오류 발생: {str(e)}"
        )


@router.post(
    "/valuation-change/apply",
    response_model=ValuationChangeApplyResponse,
    summary="자산 가치 변경 적용",
    description="자산 가치(CIA) 변경을 적용하고 선택적으로 관련 위험을 재계산합니다."
)
async def apply_valuation_change(
    request: ValuationChangeApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    자산 가치 변경 적용

    - 가치 평가 업데이트 또는 생성
    - 변경 이력 기록
    - 선택적 관련 위험 재계산 (auto_recalculate=True)
    """
    try:
        service = AssetImpactService(db)
        result = service.apply_valuation_change(
            asset_id=request.asset_id,
            new_valuation={
                "confidentiality": request.new_valuation.confidentiality,
                "integrity": request.new_valuation.integrity,
                "availability": request.new_valuation.availability,
            },
            user_id=current_user.id,
            auto_recalculate=request.auto_recalculate
        )

        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"가치 변경 적용 중 오류 발생: {str(e)}"
        )


@router.get(
    "/disposal/{asset_id}/analyze",
    response_model=DisposalImpactResponse,
    summary="자산 폐기 영향 분석",
    description="자산 폐기 시 관련 위험 평가에 미치는 영향을 분석합니다."
)
async def analyze_disposal_impact(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    자산 폐기 영향 분석

    - 영향 받는 위험 평가 목록
    - 영향 받는 시나리오 목록
    - 진행 중인 처리 계획 확인
    - 안전 폐기 가능 여부 및 경고
    """
    try:
        service = AssetImpactService(db)
        result = service.analyze_disposal_impact(asset_id=asset_id)

        return {
            "success": True,
            "asset_id": result.asset_id,
            "asset_name": result.asset_name,
            "affected_assessments": result.affected_assessments,
            "affected_scenarios": result.affected_scenarios,
            "has_active_treatments": result.has_active_treatments,
            "can_safely_dispose": result.can_safely_dispose,
            "warnings": result.warnings,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"영향 분석 중 오류 발생: {str(e)}"
        )


@router.post(
    "/disposal/{asset_id}/process",
    response_model=DisposalProcessResponse,
    summary="자산 폐기 처리",
    description="자산을 폐기 처리하고 관련 위험 평가 상태를 업데이트합니다."
)
async def process_asset_disposal(
    asset_id: int,
    request: DisposalProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    자산 폐기 처리

    - 자산 비활성화 (status='폐기', is_active=False)
    - 폐기 기록 생성
    - 변경 이력 기록
    - 관련 위험 평가를 폐기 상태로 표시
    """
    try:
        service = AssetImpactService(db)
        result = service.process_asset_disposal(
            asset_id=asset_id,
            disposal_reason=request.disposal_reason,
            user_id=current_user.id
        )

        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"폐기 처리 중 오류 발생: {str(e)}"
        )
