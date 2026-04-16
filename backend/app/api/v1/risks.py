"""
위험 관리 API 라우터
/api/v1/risks
Phase 2: FR-603 ~ FR-607
"""
from io import BytesIO
from typing import Dict, List, Optional
from datetime import date, datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.user import User
from app.schemas.risk import (
    # 시나리오
    RiskScenarioCreate,
    RiskScenarioUpdate,
    RiskScenarioResponse,
    RiskScenarioList,
    # 위험 평가
    RiskAssessmentCreate,
    RiskAssessmentBulkCreate,
    RiskAssessmentUpdate,
    RiskAssessmentResponse,
    RiskAssessmentList,
    # DoA
    DoAConfigCreate,
    DoAConfigResponse,
    DoAHistoryResponse,
    # 처리 계획
    RiskTreatmentPlanCreate,
    RiskTreatmentPlanUpdate,
    RiskTreatmentPlanResponse,
    RiskTreatmentPlanList,
    RiskTreatmentActionCreate,
    RiskTreatmentActionResponse,
    RiskTreatmentProgress,
    # 보고서
    RiskDistribution,
    RiskMatrixData,
    ScenarioComparison,
    RiskReportSummary,
    ExecutiveSummary,
)
from app.services.risk_service import RiskService


router = APIRouter()


# =============================================================================
# 헬퍼 함수
# =============================================================================

def get_risk_service(db: Session = Depends(get_db)) -> RiskService:
    """RiskService 의존성"""
    return RiskService(db)


STRATEGY_NAMES = {
    "reduce": "감소",
    "avoid": "회피",
    "transfer": "전가",
    "accept": "수용",
}


def scenario_to_response(
    scenario,
    service: RiskService,
    stats: Optional[Dict[str, int]] = None,
    skip_exceeding_doa: bool = False
) -> RiskScenarioResponse:
    """
    RiskScenario 모델을 응답으로 변환

    Args:
        scenario: RiskScenario 인스턴스
        service: RiskService 인스턴스
        stats: 미리 조회된 통계 (total, high_count). None이면 개별 조회
        skip_exceeding_doa: DoA 초과 건수 계산 스킵 (목록 조회 시 성능 향상)
    """
    # 통계 가져오기 (배치 조회 또는 개별 조회)
    if stats is None:
        result = service.get_risk_assessments(scenario_id=scenario.id, page=1, size=1)
        assessment_count = result["total"]

        high_risk_count = len([
            a for a in service.get_risk_assessments(scenario_id=scenario.id, risk_level="high", page=1, size=1000)["items"]
        ])
    else:
        assessment_count = stats.get("total", 0)
        high_risk_count = stats.get("high_count", 0)

    # DoA 초과 위험 계산 (목록 조회 시에는 스킵 가능)
    if skip_exceeding_doa:
        exceeding_doa_count = 0
    else:
        exceeding_risks = service.get_risks_exceeding_doa(scenario.id)
        exceeding_doa_count = len(exceeding_risks)

    return RiskScenarioResponse(
        id=scenario.id,
        name=scenario.name,
        description=scenario.description,
        start_date=scenario.start_date,
        end_date=scenario.end_date,
        status=scenario.status,
        created_by=scenario.created_by,
        creator_name=scenario.creator.name if scenario.creator else None,
        completed_at=scenario.completed_at,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at,
        assessment_count=assessment_count,
        high_risk_count=high_risk_count,
        exceeding_doa_count=exceeding_doa_count,
    )


def assessment_to_response(assessment, service: RiskService) -> RiskAssessmentResponse:
    """RiskAssessment 모델을 응답으로 변환"""
    doa = service.get_current_doa()
    exceeds_doa = (
        assessment.risk_score > doa.threshold_value
        if doa and assessment.risk_score
        else False
    )

    # 처리 계획 여부 확인
    result = service.get_treatment_plans(risk_assessment_id=assessment.id, page=1, size=1)
    has_treatment_plan = result["total"] > 0

    return RiskAssessmentResponse(
        id=assessment.id,
        scenario_id=assessment.scenario_id,
        asset_id=assessment.asset_id,
        asset_name=assessment.asset.name if assessment.asset else None,
        asset_code=assessment.asset.asset_code if assessment.asset else None,
        threat_id=assessment.threat_id,
        threat_name=assessment.threat.name if assessment.threat else None,
        vulnerability_id=assessment.vulnerability_id,
        vulnerability_name=assessment.vulnerability.name if assessment.vulnerability else None,
        asset_value=assessment.asset_value,
        threat_level=assessment.threat_level,
        vulnerability_level=assessment.vulnerability_level,
        risk_score=assessment.risk_score,
        risk_level=assessment.risk_level,
        exceeds_doa=exceeds_doa,
        evaluated_by=assessment.evaluated_by,
        evaluator_name=assessment.evaluator.name if assessment.evaluator else None,
        evaluated_at=assessment.evaluated_at,
        remarks=assessment.remarks,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        has_treatment_plan=has_treatment_plan,
    )


def treatment_plan_to_response(plan, service: RiskService) -> RiskTreatmentPlanResponse:
    """RiskTreatmentPlan 모델을 응답으로 변환"""
    assessment = plan.risk_assessment
    latest_residual = service.get_latest_residual_risk(plan.id)

    return RiskTreatmentPlanResponse(
        id=plan.id,
        risk_assessment_id=plan.risk_assessment_id,
        risk_score=assessment.risk_score if assessment else None,
        risk_level=assessment.risk_level if assessment else None,
        asset_name=assessment.asset.name if assessment and assessment.asset else None,
        threat_name=assessment.threat.name if assessment and assessment.threat else None,
        vulnerability_name=assessment.vulnerability.name if assessment and assessment.vulnerability else None,
        strategy=plan.strategy,
        strategy_name=STRATEGY_NAMES.get(plan.strategy),
        description=plan.description,
        assignee_id=plan.assignee_id,
        assignee_name=plan.assignee.name if plan.assignee else None,
        due_date=plan.due_date,
        budget=plan.budget,
        status=plan.status,
        completed_at=plan.completed_at,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        action_count=len(plan.actions) if plan.actions else 0,
        latest_residual_risk=latest_residual,
    )


# =============================================================================
# 4.5: 위험 시나리오 API (FR-603)
# =============================================================================

@router.get("/scenarios", response_model=RiskScenarioList)
def get_risk_scenarios(
    status: Optional[str] = Query(None, description="상태 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskScenarioList:
    """
    위험 시나리오 목록 조회 (N+1 쿼리 최적화)

    - **status**: 상태 필터 (draft/in_progress/completed/cancelled)
    """
    result = service.get_risk_scenarios(status=status, page=page, size=size)

    # N+1 쿼리 방지: 모든 시나리오의 통계를 한 번에 조회
    scenario_ids = [s.id for s in result["items"]]
    stats_map = service.get_scenario_stats_batch(scenario_ids) if scenario_ids else {}

    return RiskScenarioList(
        items=[
            scenario_to_response(
                s,
                service,
                stats=stats_map.get(s.id),
                skip_exceeding_doa=True  # 목록에서는 DoA 초과 건수 계산 스킵
            )
            for s in result["items"]
        ],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.post("/scenarios", response_model=RiskScenarioResponse, status_code=status.HTTP_201_CREATED)
def create_risk_scenario(
    data: RiskScenarioCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> RiskScenarioResponse:
    """
    위험 시나리오 생성

    - **name**: 시나리오명 (필수)
    - **start_date**: 평가 시작일 (필수)
    - **end_date**: 평가 종료일 (선택)
    """
    scenario = service.create_risk_scenario(
        name=data.name,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
        user_id=current_user.id,
    )
    return scenario_to_response(scenario, service)


@router.get("/scenarios/compare")
def compare_scenarios(
    scenario1_id: int = Query(..., description="시나리오 1 ID"),
    scenario2_id: int = Query(..., description="시나리오 2 ID"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> ScenarioComparison:
    """
    시나리오 비교 분석

    두 시나리오의 위험 분포, 위험 수, 평균 점수 등을 비교합니다.
    """
    try:
        result = service.compare_scenarios(scenario1_id, scenario2_id)
        return ScenarioComparison(
            scenario1_id=result["scenario1_id"],
            scenario1_name=result["scenario1_name"],
            scenario2_id=result["scenario2_id"],
            scenario2_name=result["scenario2_name"],
            risk_count_diff=result["risk_count_diff"],
            high_risk_diff=result["high_risk_diff"],
            avg_risk_score_diff=result["avg_risk_score_diff"],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/scenarios/{scenario_id}", response_model=RiskScenarioResponse)
def get_risk_scenario(
    scenario_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskScenarioResponse:
    """위험 시나리오 상세 조회"""
    scenario = service.get_risk_scenario_by_id(scenario_id)
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="시나리오를 찾을 수 없습니다.",
        )
    return scenario_to_response(scenario, service)


@router.put("/scenarios/{scenario_id}", response_model=RiskScenarioResponse)
def update_risk_scenario(
    scenario_id: int,
    data: RiskScenarioUpdate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> RiskScenarioResponse:
    """위험 시나리오 수정"""
    try:
        scenario = service.update_risk_scenario(
            scenario_id=scenario_id,
            **data.model_dump(exclude_unset=True),
        )
        return scenario_to_response(scenario, service)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_risk_scenario(
    scenario_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:delete")),
):
    """위험 시나리오 삭제"""
    try:
        service.delete_risk_scenario(scenario_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# =============================================================================
# 위험 평가 API (FR-603)
# =============================================================================

@router.get("/scenarios/{scenario_id}/assessments", response_model=RiskAssessmentList)
def get_risk_assessments(
    scenario_id: int,
    risk_level: Optional[str] = Query(None, description="위험 등급 필터"),
    exceeds_doa: Optional[bool] = Query(None, description="DoA 초과 필터"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskAssessmentList:
    """
    시나리오별 위험 평가 목록 조회

    - **risk_level**: 위험 등급 필터 (high/medium/low)
    - **exceeds_doa**: DoA 초과 필터
    """
    result = service.get_risk_assessments(
        scenario_id=scenario_id,
        risk_level=risk_level,
        exceeds_doa=exceeds_doa,
        page=page,
        size=size,
    )
    return RiskAssessmentList(
        items=[assessment_to_response(a, service) for a in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.post("/scenarios/{scenario_id}/assessments", response_model=RiskAssessmentResponse, status_code=status.HTTP_201_CREATED)
def create_risk_assessment(
    scenario_id: int,
    data: RiskAssessmentCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> RiskAssessmentResponse:
    """
    위험 평가 생성 (자산-위협-취약점 3-way 매핑)

    - **asset_id**: 자산 ID (필수)
    - **threat_id**: 위협 ID (필수)
    - **vulnerability_id**: 취약점 ID (필수)
    - **asset_value**: 자산 가치 (1-3)
    - **threat_level**: 위협 등급 (1-3)
    - **vulnerability_level**: 취약점 등급 (1-3)

    위험도(DoR)는 자동 계산됩니다: DoR = 자산가치 x 위협등급 x 취약점등급
    """
    assessment = service.create_risk_assessment(
        scenario_id=scenario_id,
        asset_id=data.asset_id,
        threat_id=data.threat_id,
        vulnerability_id=data.vulnerability_id,
        asset_value=data.asset_value,
        threat_level=data.threat_level,
        vulnerability_level=data.vulnerability_level,
        user_id=current_user.id,
        remarks=data.remarks,
    )
    return assessment_to_response(assessment, service)


@router.post("/scenarios/{scenario_id}/assessments/bulk", status_code=status.HTTP_201_CREATED)
def bulk_create_risk_assessments(
    scenario_id: int,
    data: RiskAssessmentBulkCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
):
    """위험 평가 대량 생성"""
    created = []
    for item in data.assessments:
        assessment = service.create_risk_assessment(
            scenario_id=scenario_id,
            asset_id=item.asset_id,
            threat_id=item.threat_id,
            vulnerability_id=item.vulnerability_id,
            asset_value=item.asset_value,
            threat_level=item.threat_level,
            vulnerability_level=item.vulnerability_level,
            user_id=current_user.id,
            remarks=item.remarks,
        )
        created.append(assessment)
    return {"count": len(created)}


@router.post("/scenarios/{scenario_id}/calculate")
def recalculate_scenario_risks(
    scenario_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:update")),
):
    """시나리오 전체 위험도 재계산"""
    count = service.recalculate_scenario_risks(scenario_id)
    return {"recalculated_count": count}


@router.get("/scenarios/{scenario_id}/report")
def get_risk_report(
    scenario_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskReportSummary:
    """위험 평가 보고서 요약 조회"""
    try:
        result = service.get_report_summary(scenario_id)
        return RiskReportSummary(
            scenario_id=result["scenario_id"],
            scenario_name=result["scenario_name"],
            assessment_period=result["assessment_period"],
            total_assets=result["total_assets"],
            total_risks=result["total_risks"],
            risk_distribution=RiskDistribution(**result["risk_distribution"]),
            exceeding_doa_count=result["exceeding_doa_count"],
            treatment_progress=RiskTreatmentProgress(**result["treatment_progress"]),
            top_risks=[assessment_to_response(r, service) for r in result["top_risks"]],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/scenarios/{scenario_id}/executive-summary", response_model=ExecutiveSummary)
def get_executive_summary(
    scenario_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> ExecutiveSummary:
    """경영진 요약 보고서 조회"""
    try:
        report = service.get_report_summary(scenario_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    dist = report["risk_distribution"]
    total = dist["total"]
    doa = service.get_current_doa()
    progress = report["treatment_progress"]

    # 주요 발견사항
    key_findings = []
    key_findings.append(f"총 {total}건의 위험이 식별되었습니다.")
    if dist["high"] > 0:
        key_findings.append(f"고위험 {dist['high']}건이 즉각적인 조치가 필요합니다.")
    if report["exceeding_doa_count"] > 0:
        key_findings.append(f"DoA 초과 위험이 {report['exceeding_doa_count']}건 존재합니다.")
    if progress.get("completed", 0) > 0:
        rate = progress.get("completion_rate", 0)
        key_findings.append(f"처리 계획 완료율은 {rate:.0f}%입니다.")

    # 권고사항
    recommendations = []
    if dist["high"] > 0:
        recommendations.append("고위험 항목에 대한 즉각적인 위험 처리 계획을 수립하십시오.")
    if report["exceeding_doa_count"] > 0:
        recommendations.append("DoA 초과 위험에 대한 처리 계획을 우선적으로 실행하십시오.")
    if progress.get("completion_rate", 0) < 50:
        recommendations.append("처리 계획 완료율을 높이기 위해 자원을 추가 배정하십시오.")
    if not recommendations:
        recommendations.append("현재 위험 수준이 양호합니다. 정기적인 모니터링을 계속하십시오.")

    # 조치 항목
    action_items = []
    if dist["high"] > 0:
        action_items.append({"priority": "높음", "action": f"고위험 {dist['high']}건 처리", "status": "필요"})
    if report["exceeding_doa_count"] > 0:
        action_items.append({"priority": "높음", "action": f"DoA 초과 {report['exceeding_doa_count']}건 처리", "status": "필요"})
    if dist["medium"] > 0:
        action_items.append({"priority": "중간", "action": f"중위험 {dist['medium']}건 모니터링", "status": "진행"})

    return ExecutiveSummary(
        report_date=date.today(),
        scenario_name=report["scenario_name"],
        key_findings=key_findings,
        risk_overview={
            "total": total,
            "high": dist["high"],
            "medium": dist["medium"],
            "low": dist["low"],
            "exceeding_doa": report["exceeding_doa_count"],
            "doa_threshold": doa.threshold_value if doa else None,
        },
        recommendations=recommendations,
        action_items=action_items,
    )


@router.get("/scenarios/{scenario_id}/matrix")
def get_risk_matrix(
    scenario_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskMatrixData:
    """위험 매트릭스 데이터 조회"""
    result = service.get_risk_matrix_data(scenario_id)
    return RiskMatrixData(**result)


@router.get("/scenarios/{scenario_id}/risk-distribution")
def get_risk_distribution(
    scenario_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskDistribution:
    """위험 분포 데이터 조회"""
    result = service.get_risk_distribution(scenario_id)
    return RiskDistribution(**result)


@router.put("/assessments/{assessment_id}", response_model=RiskAssessmentResponse)
def update_risk_assessment(
    assessment_id: int,
    data: RiskAssessmentUpdate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> RiskAssessmentResponse:
    """위험 평가 수정 (소유권 검증 포함)"""
    # 위험 평가 조회
    assessment = service.get_risk_assessment_by_id(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="위험 평가를 찾을 수 없습니다.",
        )

    # 시나리오 소유자 또는 슈퍼유저만 수정 가능
    scenario = service.get_risk_scenario_by_id(assessment.scenario_id)
    if scenario and scenario.created_by != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 시나리오의 평가를 수정할 권한이 없습니다.",
        )

    try:
        assessment = service.update_risk_assessment(
            assessment_id=assessment_id,
            user_id=current_user.id,
            **data.model_dump(exclude_unset=True),
        )
        return assessment_to_response(assessment, service)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/assessments/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_risk_assessment(
    assessment_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:delete")),
):
    """위험 평가 삭제 (소유권 검증 포함)"""
    # 위험 평가 조회
    assessment = service.get_risk_assessment_by_id(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="위험 평가를 찾을 수 없습니다.",
        )

    # 시나리오 소유자 또는 슈퍼유저만 삭제 가능
    scenario = service.get_risk_scenario_by_id(assessment.scenario_id)
    if scenario and scenario.created_by != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 시나리오의 평가를 삭제할 권한이 없습니다.",
        )

    try:
        service.delete_risk_assessment(assessment_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# =============================================================================
# 4.6: DoA 관리 API (FR-604)
# =============================================================================

@router.get("/doa", response_model=DoAConfigResponse)
def get_current_doa(
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> DoAConfigResponse:
    """현재 DoA 설정 조회"""
    doa = service.get_current_doa()
    if not doa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DoA 설정이 없습니다.",
        )
    return DoAConfigResponse(
        id=doa.id,
        threshold_value=doa.threshold_value,
        effective_date=doa.effective_date,
        expiry_date=doa.expiry_date,
        approved_by=doa.approved_by,
        approver_name=doa.approver.name if doa.approver else None,
        approval_date=doa.approval_date,
        remarks=doa.remarks,
        is_active=doa.is_active,
        created_at=doa.created_at,
        updated_at=doa.updated_at,
    )


@router.post("/doa", response_model=DoAConfigResponse, status_code=status.HTTP_201_CREATED)
def create_doa_config(
    data: DoAConfigCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> DoAConfigResponse:
    """
    DoA 설정 생성/변경

    - **threshold_value**: DoA 임계값 (1-27, 이 값 이상이면 DoA 초과)
    - **effective_date**: 적용 시작일

    기존 DoA 설정은 자동으로 비활성화됩니다.
    """
    doa = service.create_doa_config(
        threshold_value=data.threshold_value,
        effective_date=data.effective_date,
        user_id=current_user.id,
        expiry_date=data.expiry_date,
        remarks=data.remarks,
    )
    return DoAConfigResponse(
        id=doa.id,
        threshold_value=doa.threshold_value,
        effective_date=doa.effective_date,
        expiry_date=doa.expiry_date,
        approved_by=doa.approved_by,
        approver_name=current_user.name,
        approval_date=doa.approval_date,
        remarks=doa.remarks,
        is_active=doa.is_active,
        created_at=doa.created_at,
        updated_at=doa.updated_at,
    )


@router.get("/doa/history", response_model=List[DoAHistoryResponse])
def get_doa_history(
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> List[DoAHistoryResponse]:
    """DoA 변경 이력 조회"""
    histories = service.get_doa_history()
    return [
        DoAHistoryResponse(
            id=h.id,
            doa_config_id=h.doa_config_id,
            old_threshold=h.old_threshold,
            new_threshold=h.new_threshold,
            change_reason=h.change_reason,
            changed_by=h.changed_by,
            changer_name=h.changer.name if h.changer else None,
            changed_at=h.changed_at,
        )
        for h in histories
    ]


@router.get("/exceeding-doa", response_model=RiskAssessmentList)
def get_risks_exceeding_doa(
    scenario_id: Optional[int] = Query(None, description="시나리오 ID"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskAssessmentList:
    """DoA 초과 위험 목록 조회"""
    items = service.get_risks_exceeding_doa(scenario_id)
    return RiskAssessmentList(
        items=[assessment_to_response(a, service) for a in items],
        total=len(items),
        page=1,
        size=len(items),
        pages=1,
    )


# =============================================================================
# 4.7: 위험 처리 계획 API (FR-605)
# =============================================================================

@router.get("/treatments", response_model=RiskTreatmentPlanList)
def get_treatment_plans(
    status: Optional[str] = Query(None, description="상태 필터"),
    assignee_id: Optional[int] = Query(None, description="담당자 ID"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskTreatmentPlanList:
    """
    위험 처리 계획 목록 조회

    - **status**: 상태 필터 (planned/in_progress/completed/cancelled)
    - **assignee_id**: 담당자 ID 필터
    """
    result = service.get_treatment_plans(
        status=status,
        assignee_id=assignee_id,
        page=page,
        size=size,
    )
    return RiskTreatmentPlanList(
        items=[treatment_plan_to_response(p, service) for p in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
        pages=result["pages"],
    )


@router.get("/treatments/progress", response_model=RiskTreatmentProgress)
def get_treatment_progress(
    scenario_id: Optional[int] = Query(None, description="시나리오 ID"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskTreatmentProgress:
    """위험 처리 진행률 통계"""
    result = service.get_treatment_progress(scenario_id)
    return RiskTreatmentProgress(**result)


@router.post("/assessments/{assessment_id}/treatments", response_model=RiskTreatmentPlanResponse, status_code=status.HTTP_201_CREATED)
def create_treatment_plan(
    assessment_id: int,
    data: RiskTreatmentPlanCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> RiskTreatmentPlanResponse:
    """
    위험 처리 계획 생성

    - **strategy**: 처리 전략 (reduce: 감소, avoid: 회피, transfer: 전가, accept: 수용)
    - **description**: 계획 설명
    - **assignee_id**: 담당자 ID
    - **due_date**: 완료 예정일
    - **budget**: 예산
    """
    plan = service.create_treatment_plan(
        risk_assessment_id=assessment_id,
        strategy=data.strategy,
        description=data.description,
        assignee_id=data.assignee_id,
        due_date=data.due_date,
        budget=data.budget,
    )
    return treatment_plan_to_response(plan, service)


@router.get("/treatments/{plan_id}", response_model=RiskTreatmentPlanResponse)
def get_treatment_plan(
    plan_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> RiskTreatmentPlanResponse:
    """위험 처리 계획 상세 조회"""
    plan = service.get_treatment_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="처리 계획을 찾을 수 없습니다.",
        )
    return treatment_plan_to_response(plan, service)


@router.put("/treatments/{plan_id}", response_model=RiskTreatmentPlanResponse)
def update_treatment_plan(
    plan_id: int,
    data: RiskTreatmentPlanUpdate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:update")),
) -> RiskTreatmentPlanResponse:
    """위험 처리 계획 수정"""
    try:
        plan = service.update_treatment_plan(
            plan_id=plan_id,
            **data.model_dump(exclude_unset=True),
        )
        return treatment_plan_to_response(plan, service)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/treatments/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_treatment_plan(
    plan_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:delete")),
):
    """위험 처리 계획 삭제"""
    try:
        service.delete_treatment_plan(plan_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/treatments/{plan_id}/actions", response_model=List[RiskTreatmentActionResponse])
def get_treatment_actions(
    plan_id: int,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
) -> List[RiskTreatmentActionResponse]:
    """위험 처리 조치 목록 조회"""
    plan = service.get_treatment_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="처리 계획을 찾을 수 없습니다.",
        )
    return [
        RiskTreatmentActionResponse(
            id=a.id,
            plan_id=a.plan_id,
            action_description=a.action_description,
            result=a.result,
            residual_risk_score=a.residual_risk_score,
            completed_by=a.completed_by,
            completer_name=a.completer.name if a.completer else None,
            completed_at=a.completed_at,
            evidence_file_path=a.evidence_file_path,
            created_at=a.created_at,
        )
        for a in (plan.actions or [])
    ]


@router.post("/treatments/{plan_id}/actions", response_model=RiskTreatmentActionResponse, status_code=status.HTTP_201_CREATED)
def create_treatment_action(
    plan_id: int,
    data: RiskTreatmentActionCreate,
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:create")),
) -> RiskTreatmentActionResponse:
    """
    위험 처리 조치 결과 등록

    - **action_description**: 조치 내용 (필수)
    - **result**: 조치 결과
    - **residual_risk_score**: 잔여 위험 점수 (1-27)
    """
    action = service.create_treatment_action(
        plan_id=plan_id,
        action_description=data.action_description,
        user_id=current_user.id,
        result=data.result,
        residual_risk_score=data.residual_risk_score,
        evidence_file_path=data.evidence_file_path,
    )
    return RiskTreatmentActionResponse(
        id=action.id,
        plan_id=action.plan_id,
        action_description=action.action_description,
        result=action.result,
        residual_risk_score=action.residual_risk_score,
        completed_by=action.completed_by,
        completer_name=current_user.name,
        completed_at=action.completed_at,
        evidence_file_path=action.evidence_file_path,
        created_at=action.created_at,
    )


# =============================================================================
# 4.9.3: 위험 평가 보고서 내보내기 API (FR-607)
# =============================================================================

@router.get("/scenarios/{scenario_id}/report/export")
def export_risk_report(
    scenario_id: int,
    format: str = Query("excel", regex="^(excel|word)$", description="내보내기 형식"),
    service: RiskService = Depends(get_risk_service),
    current_user: User = Depends(require_permission("risk:read")),
):
    """
    위험 평가 보고서 내보내기

    - **format**: 내보내기 형식 (excel/word)
    """
    try:
        report = service.get_report_summary(scenario_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    # ORM 객체를 dict로 변환 (엑셀/워드 생성 함수에서 .get() 사용)
    doa = service.get_current_doa()
    report["top_risks"] = [
        {
            "asset_name": r.asset.name if r.asset else "",
            "threat_name": r.threat.name if r.threat else "",
            "vulnerability_name": r.vulnerability.name if r.vulnerability else "",
            "asset_value": r.asset_value,
            "threat_level": r.threat_level,
            "vulnerability_level": r.vulnerability_level,
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
            "exceeds_doa": r.risk_score > doa.threshold_value if doa and r.risk_score else False,
        }
        for r in report["top_risks"]
    ]

    if format == "excel":
        content = _generate_risk_report_excel(report, service)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"RiskReport_{report['scenario_name']}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    elif format == "word":
        content = _generate_risk_report_word(report, service)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"RiskReport_{report['scenario_name']}_{datetime.now().strftime('%Y%m%d')}.docx"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 형식입니다.",
        )

    # URL 인코딩으로 한글 파일명 지원
    encoded_filename = quote(filename)

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        },
    )


def _generate_risk_report_excel(report: dict, service: RiskService) -> bytes:
    """위험 평가 보고서 엑셀 생성"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openpyxl 패키지가 필요합니다.",
        )

    wb = Workbook()

    # 스타일 정의
    title_font = Font(bold=True, size=14)
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")
    sub_header_font = Font(bold=True, size=11)
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    # =========================================================================
    # 시트 1: 보고서 요약
    # =========================================================================
    ws_summary = wb.active
    ws_summary.title = "보고서 요약"

    row = 1
    # 제목
    ws_summary.cell(row=row, column=1, value="위험 평가 보고서").font = title_font
    row += 2

    # 기본 정보
    ws_summary.cell(row=row, column=1, value="평가 시나리오").font = sub_header_font
    ws_summary.cell(row=row, column=2, value=report["scenario_name"])
    row += 1
    ws_summary.cell(row=row, column=1, value="평가 기간").font = sub_header_font
    ws_summary.cell(row=row, column=2, value=report["assessment_period"])
    row += 1
    ws_summary.cell(row=row, column=1, value="평가 자산 수").font = sub_header_font
    ws_summary.cell(row=row, column=2, value=report["total_assets"])
    row += 1
    ws_summary.cell(row=row, column=1, value="전체 위험 수").font = sub_header_font
    ws_summary.cell(row=row, column=2, value=report["total_risks"])
    row += 2

    # 위험 분포
    ws_summary.cell(row=row, column=1, value="위험 분포").font = sub_header_font
    row += 1
    dist = report["risk_distribution"]
    ws_summary.cell(row=row, column=1, value="높음 (High)")
    ws_summary.cell(row=row, column=2, value=dist["high"])
    row += 1
    ws_summary.cell(row=row, column=1, value="중간 (Medium)")
    ws_summary.cell(row=row, column=2, value=dist["medium"])
    row += 1
    ws_summary.cell(row=row, column=1, value="낮음 (Low)")
    ws_summary.cell(row=row, column=2, value=dist["low"])
    row += 2

    # DoA 초과
    ws_summary.cell(row=row, column=1, value="DoA 초과 위험").font = sub_header_font
    ws_summary.cell(row=row, column=2, value=report["exceeding_doa_count"])
    row += 2

    # 처리 진행률
    ws_summary.cell(row=row, column=1, value="위험 처리 진행률").font = sub_header_font
    row += 1
    progress = report["treatment_progress"]
    ws_summary.cell(row=row, column=1, value="전체")
    ws_summary.cell(row=row, column=2, value=progress["total"])
    row += 1
    ws_summary.cell(row=row, column=1, value="완료")
    ws_summary.cell(row=row, column=2, value=progress["completed"])
    row += 1
    ws_summary.cell(row=row, column=1, value="진행률")
    ws_summary.cell(row=row, column=2, value=f"{progress['completion_rate']:.1f}%")

    # 열 너비 조정
    ws_summary.column_dimensions['A'].width = 20
    ws_summary.column_dimensions['B'].width = 40

    # =========================================================================
    # 시트 2: 주요 위험 목록
    # =========================================================================
    ws_risks = wb.create_sheet(title="주요 위험 목록")

    # 헤더
    headers = [
        "순위",
        "자산명",
        "위협",
        "취약점",
        "자산가치",
        "위협등급",
        "취약점등급",
        "위험점수",
        "위험등급",
        "DoA 초과",
    ]

    for col, header in enumerate(headers, 1):
        cell = ws_risks.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    # 데이터
    for idx, risk in enumerate(report["top_risks"], 1):
        row = idx + 1
        ws_risks.cell(row=row, column=1, value=idx).border = thin_border
        ws_risks.cell(row=row, column=2, value=risk.get("asset_name", "")).border = thin_border
        ws_risks.cell(row=row, column=3, value=risk.get("threat_name", "")).border = thin_border
        ws_risks.cell(row=row, column=4, value=risk.get("vulnerability_name", "")).border = thin_border
        ws_risks.cell(row=row, column=5, value=risk.get("asset_value", "")).border = thin_border
        ws_risks.cell(row=row, column=6, value=risk.get("threat_level", "")).border = thin_border
        ws_risks.cell(row=row, column=7, value=risk.get("vulnerability_level", "")).border = thin_border
        ws_risks.cell(row=row, column=8, value=risk.get("risk_score", "")).border = thin_border
        ws_risks.cell(row=row, column=9, value=risk.get("risk_level", "")).border = thin_border
        ws_risks.cell(row=row, column=10, value="예" if risk.get("exceeds_doa") else "아니오").border = thin_border

    # 열 너비 조정
    column_widths = [8, 30, 30, 30, 10, 10, 10, 10, 10, 10]
    for col, width in enumerate(column_widths, 1):
        ws_risks.column_dimensions[chr(64 + col)].width = width

    ws_risks.auto_filter.ref = "A1:J1"

    # 바이트로 반환
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output.read()


def _generate_risk_report_word(report: dict, service: RiskService) -> bytes:
    """위험 평가 보고서 Word 생성"""
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor, Inches
        from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="python-docx 패키지가 필요합니다.",
        )

    doc = Document()

    # 제목
    title = doc.add_heading("위험 평가 보고서", level=0)
    title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

    # 기본 정보
    doc.add_heading("1. 평가 개요", level=1)
    table = doc.add_table(rows=4, cols=2)
    table.style = "Light Grid Accent 1"

    table.cell(0, 0).text = "평가 시나리오"
    table.cell(0, 1).text = report["scenario_name"]
    table.cell(1, 0).text = "평가 기간"
    table.cell(1, 1).text = report["assessment_period"]
    table.cell(2, 0).text = "평가 자산 수"
    table.cell(2, 1).text = str(report["total_assets"])
    table.cell(3, 0).text = "전체 위험 수"
    table.cell(3, 1).text = str(report["total_risks"])

    doc.add_paragraph()

    # 위험 분포
    doc.add_heading("2. 위험 분포", level=1)
    dist = report["risk_distribution"]
    table = doc.add_table(rows=4, cols=2)
    table.style = "Light Grid Accent 1"

    table.cell(0, 0).text = "위험 등급"
    table.cell(0, 1).text = "건수"
    table.cell(1, 0).text = "높음 (High)"
    table.cell(1, 1).text = str(dist["high"])
    table.cell(2, 0).text = "중간 (Medium)"
    table.cell(2, 1).text = str(dist["medium"])
    table.cell(3, 0).text = "낮음 (Low)"
    table.cell(3, 1).text = str(dist["low"])

    doc.add_paragraph()

    # DoA 초과
    doc.add_heading("3. DoA 초과 위험", level=1)
    p = doc.add_paragraph()
    p.add_run(f"허용 가능 위험 수준(DoA)을 초과한 위험: ").bold = True
    p.add_run(f"{report['exceeding_doa_count']}건")

    doc.add_paragraph()

    # 처리 진행률
    doc.add_heading("4. 위험 처리 진행률", level=1)
    progress = report["treatment_progress"]
    table = doc.add_table(rows=3, cols=2)
    table.style = "Light Grid Accent 1"

    table.cell(0, 0).text = "전체 위험"
    table.cell(0, 1).text = str(progress["total"])
    table.cell(1, 0).text = "처리 완료"
    table.cell(1, 1).text = str(progress["completed"])
    table.cell(2, 0).text = "진행률"
    table.cell(2, 1).text = f"{progress['completion_rate']:.1f}%"

    doc.add_paragraph()

    # 주요 위험 목록
    doc.add_heading("5. 주요 위험 목록 (상위 10개)", level=1)
    if report["top_risks"]:
        table = doc.add_table(rows=len(report["top_risks"]) + 1, cols=7)
        table.style = "Light Grid Accent 1"

        # 헤더
        headers = ["순위", "자산명", "위협", "취약점", "위험점수", "위험등급", "DoA 초과"]
        for col, header in enumerate(headers):
            table.cell(0, col).text = header

        # 데이터
        for idx, risk in enumerate(report["top_risks"], 1):
            table.cell(idx, 0).text = str(idx)
            table.cell(idx, 1).text = risk.get("asset_name", "")
            table.cell(idx, 2).text = risk.get("threat_name", "")
            table.cell(idx, 3).text = risk.get("vulnerability_name", "")
            table.cell(idx, 4).text = str(risk.get("risk_score", ""))
            table.cell(idx, 5).text = risk.get("risk_level", "")
            table.cell(idx, 6).text = "예" if risk.get("exceeds_doa") else "아니오"
    else:
        doc.add_paragraph("평가된 위험이 없습니다.")

    # 바이트로 반환
    output = BytesIO()
    doc.save(output)
    output.seek(0)
    return output.read()
