"""
위험도 자동 계산 API
Phase 2: 5.2 위험도 자동 계산 엔진

엔드포인트:
- POST /api/v1/risk-calculation/calculate - DoR 계산
- GET /api/v1/risk-calculation/thresholds - 위험 등급 기준 조회
- PUT /api/v1/risk-calculation/thresholds - 위험 등급 기준 설정
- POST /api/v1/risk-calculation/assessments/{id}/recalculate - 단일 위험 평가 재계산
- POST /api/v1/risk-calculation/scenarios/{id}/batch-recalculate - 시나리오 전체 재계산
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.services.risk_calculation_service import (
    RiskCalculationService,
    RiskLevelThresholds,
)


router = APIRouter(prefix="/risk-calculation", tags=["위험도 계산"])


# ========================================================================
# Pydantic 스키마
# ========================================================================

class DoRCalculateRequest(BaseModel):
    """DoR 계산 요청"""
    asset_value: int = Field(..., ge=1, le=5, description="자산 가치 (1-5)")
    threat_level: int = Field(..., ge=1, le=3, description="위협 등급 (1-3)")
    vulnerability_level: int = Field(..., ge=1, le=3, description="취약점 등급 (1-3)")


class DoRCalculateResponse(BaseModel):
    """DoR 계산 응답"""
    dor_score: int = Field(..., description="DoR 점수")
    risk_level: str = Field(..., description="위험 등급 (high/medium/low)")
    asset_value: int = Field(..., description="자산 가치")
    threat_level: int = Field(..., description="위협 등급")
    vulnerability_level: int = Field(..., description="취약점 등급")


class ThresholdsResponse(BaseModel):
    """위험 등급 기준 응답"""
    high_threshold: int = Field(..., description="고위험 하한선 (이 값 이상이면 high)")
    medium_threshold: int = Field(..., description="중위험 하한선 (이 값 이상이면 medium)")
    low_max: int = Field(..., description="저위험 최대값")


class ThresholdsUpdateRequest(BaseModel):
    """위험 등급 기준 수정 요청"""
    high_threshold: int = Field(..., ge=1, description="고위험 하한선")
    medium_threshold: int = Field(..., ge=1, description="중위험 하한선")


class RecalculateResponse(BaseModel):
    """재계산 응답"""
    assessment_id: int = Field(..., description="위험 평가 ID")
    risk_score: int = Field(..., description="재계산된 DoR 점수")
    risk_level: str = Field(..., description="재계산된 위험 등급")


class BatchRecalculateResponse(BaseModel):
    """배치 재계산 응답"""
    scenario_id: int = Field(..., description="시나리오 ID")
    total_recalculated: int = Field(..., description="재계산된 평가 수")
    success: bool = Field(..., description="성공 여부")
    high_count: int = Field(..., description="고위험 수")
    medium_count: int = Field(..., description="중위험 수")
    low_count: int = Field(..., description="저위험 수")


# ========================================================================
# API 엔드포인트
# ========================================================================

@router.post(
    "/calculate",
    response_model=DoRCalculateResponse,
    summary="DoR 계산",
    description="자산가치, 위협등급, 취약점등급을 입력받아 DoR 점수와 위험 등급을 계산합니다."
)
async def calculate_dor(
    request: DoRCalculateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    DoR (위험도) 계산

    - **asset_value**: 자산 가치 (1-5)
    - **threat_level**: 위협 등급 (1: 하, 2: 중, 3: 상)
    - **vulnerability_level**: 취약점 등급 (1: 하, 2: 중, 3: 상)

    공식: DoR = 자산가치 x 위협등급 x 취약점등급
    """
    service = RiskCalculationService(db)

    try:
        dor_score = service.calculate_dor(
            asset_value=request.asset_value,
            threat_level=request.threat_level,
            vulnerability_level=request.vulnerability_level
        )
        risk_level = service.classify_risk_level(dor_score)

        return DoRCalculateResponse(
            dor_score=dor_score,
            risk_level=risk_level,
            asset_value=request.asset_value,
            threat_level=request.threat_level,
            vulnerability_level=request.vulnerability_level
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/thresholds",
    response_model=ThresholdsResponse,
    summary="위험 등급 기준 조회",
    description="현재 설정된 위험 등급 분류 기준을 조회합니다."
)
async def get_thresholds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    위험 등급 분류 기준 조회

    기본 기준:
    - 상(high): DoR >= 30
    - 중(medium): 15 <= DoR < 30
    - 하(low): DoR < 15
    """
    service = RiskCalculationService(db)
    thresholds = service.get_risk_level_thresholds()

    return ThresholdsResponse(
        high_threshold=thresholds.high_threshold,
        medium_threshold=thresholds.medium_threshold,
        low_max=thresholds.low_max
    )


@router.put(
    "/thresholds",
    response_model=ThresholdsResponse,
    summary="위험 등급 기준 설정",
    description="위험 등급 분류 기준을 변경합니다. 관리자 권한이 필요합니다."
)
async def update_thresholds(
    request: ThresholdsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    위험 등급 분류 기준 설정

    high_threshold는 medium_threshold보다 커야 합니다.
    """
    # 권한 체크 (CISO 또는 관리자만 변경 가능)
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="위험 등급 기준 변경 권한이 없습니다."
        )

    service = RiskCalculationService(db)

    try:
        new_thresholds = RiskLevelThresholds(
            high_threshold=request.high_threshold,
            medium_threshold=request.medium_threshold
        )
        service.set_risk_level_thresholds(new_thresholds)

        updated = service.get_risk_level_thresholds()
        return ThresholdsResponse(
            high_threshold=updated.high_threshold,
            medium_threshold=updated.medium_threshold,
            low_max=updated.low_max
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/assessments/{assessment_id}/recalculate",
    response_model=RecalculateResponse,
    summary="단일 위험 평가 재계산",
    description="특정 위험 평가의 DoR과 위험 등급을 재계산합니다."
)
async def recalculate_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    단일 위험 평가 재계산

    자산가치, 위협등급, 취약점등급 값이 변경된 후 DoR과 위험 등급을 다시 계산합니다.
    """
    service = RiskCalculationService(db)

    try:
        result = service.recalculate_risk_assessment(
            assessment_id=assessment_id,
            user_id=current_user.id
        )

        return RecalculateResponse(
            assessment_id=result.id,
            risk_score=result.risk_score,
            risk_level=result.risk_level
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post(
    "/scenarios/{scenario_id}/batch-recalculate",
    response_model=BatchRecalculateResponse,
    summary="시나리오 전체 재계산",
    description="시나리오에 속한 모든 위험 평가를 일괄 재계산합니다."
)
async def batch_recalculate_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    시나리오 전체 위험 평가 재계산

    시나리오에 포함된 모든 위험 평가의 DoR과 위험 등급을 재계산합니다.
    위험 등급 기준이 변경되었거나, 자산 가치가 일괄 변경된 경우 사용합니다.
    """
    service = RiskCalculationService(db)

    try:
        result = service.batch_recalculate_scenario(scenario_id)

        return BatchRecalculateResponse(
            scenario_id=result["scenario_id"],
            total_recalculated=result["total_recalculated"],
            success=result["success"],
            high_count=result["summary"]["high_count"],
            medium_count=result["summary"]["medium_count"],
            low_count=result["summary"]["low_count"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
