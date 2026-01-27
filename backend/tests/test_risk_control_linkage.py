"""
위험-통제항목 연계 서비스 및 API 테스트
Phase 2: 섹션 5.4 위험-통제항목 연계 구현

테스트 대상:
- 5.4.1 위험 처리 계획과 통제항목 연결
- 5.4.2 통제 이행 현황과 위험 수준 연계 분석
"""
from datetime import date, datetime, timedelta
from typing import Dict, List

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.risk import (
    RiskAssessment,
    RiskScenario,
    RiskTreatmentPlan,
    RiskTreatmentAction,
    RiskTreatmentControlLink,
)
from app.services.risk_control_linkage_service import RiskControlLinkageService


# ============================================================================
# 테스트 픽스처
# ============================================================================


@pytest.fixture
def test_control_domain_for_linkage(db: Session) -> ControlDomain:
    """연계 테스트용 통제영역 생성"""
    domain = ControlDomain(
        code="2",
        name="보호대책 요구사항",
        description="보호대책 구현",
        sort_order=2,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@pytest.fixture
def test_control_category_for_linkage(
    db: Session, test_control_domain_for_linkage: ControlDomain
) -> ControlCategory:
    """연계 테스트용 통제 카테고리 생성"""
    category = ControlCategory(
        domain_id=test_control_domain_for_linkage.id,
        code="2.1",
        name="접근통제",
        description="접근통제 정책",
        sort_order=1,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@pytest.fixture
def test_control_items_for_linkage(
    db: Session, test_control_category_for_linkage: ControlCategory
) -> List[ControlItem]:
    """연계 테스트용 통제항목 목록 생성 (3개)"""
    items = []
    for i in range(1, 4):
        item = ControlItem(
            category_id=test_control_category_for_linkage.id,
            code=f"2.1.{i}",
            title=f"접근통제 항목 {i}",
            description=f"접근통제 항목 {i} 설명",
            is_required=True,
            sort_order=i,
        )
        db.add(item)
        items.append(item)
    db.commit()
    for item in items:
        db.refresh(item)
    return items


@pytest.fixture
def multiple_treatment_plans(
    db: Session,
    test_risk_scenario,
    test_asset,
    test_threat,
    test_vulnerability,
    test_user,
) -> List[RiskTreatmentPlan]:
    """다중 위험 처리 계획 생성"""
    plans = []

    for i in range(3):
        # 각각 다른 위험 평가 생성
        assessment = RiskAssessment(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=2 + i % 2,  # 2 또는 3
            threat_level=2,
            vulnerability_level=2 + i % 2,  # 2 또는 3
        )
        db.add(assessment)
        db.commit()
        db.refresh(assessment)

        # 처리 계획 생성
        plan = RiskTreatmentPlan(
            risk_assessment_id=assessment.id,
            strategy="reduce" if i < 2 else "transfer",
            description=f"위험 처리 계획 {i + 1}",
            assignee_id=test_user.id,
            due_date=date.today() + timedelta(days=30 + i * 30),
            budget=1000000 * (i + 1),
            status="planned" if i == 0 else ("in_progress" if i == 1 else "completed"),
        )
        db.add(plan)
        plans.append(plan)

    db.commit()
    for plan in plans:
        db.refresh(plan)
    return plans


@pytest.fixture
def linkage_service(db: Session) -> RiskControlLinkageService:
    """연계 서비스 인스턴스 생성"""
    return RiskControlLinkageService(db)


# ============================================================================
# 5.4.1 위험 처리 계획과 통제항목 연결 테스트
# ============================================================================


class TestLinkTreatmentToControls:
    """위험 처리 계획과 통제항목 연결 테스트"""

    def test_link_single_control_to_treatment(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """단일 통제항목 연결 테스트"""
        control_item = test_control_items_for_linkage[0]

        # 연결 생성
        link = linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            effectiveness_rating=0.8,
            user_id=1,
        )

        assert len(link) == 1
        assert link[0].treatment_plan_id == test_risk_treatment_plan.id
        assert link[0].control_item_id == control_item.id
        assert link[0].link_type == "primary"
        assert link[0].effectiveness_rating == 0.8

    def test_link_multiple_controls_to_treatment(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """다중 통제항목 연결 테스트"""
        control_ids = [item.id for item in test_control_items_for_linkage]

        # 연결 생성
        links = linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=control_ids,
            link_type="secondary",
            effectiveness_rating=0.7,
            user_id=1,
        )

        assert len(links) == 3
        for link in links:
            assert link.treatment_plan_id == test_risk_treatment_plan.id
            assert link.link_type == "secondary"

    def test_link_treatment_not_found(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """존재하지 않는 처리 계획에 연결 시 예외 발생"""
        with pytest.raises(ValueError, match="위험 처리 계획을 찾을 수 없습니다"):
            linkage_service.link_treatment_to_controls(
                treatment_plan_id=99999,
                control_item_ids=[test_control_items_for_linkage[0].id],
                link_type="primary",
                user_id=1,
            )

    def test_link_control_not_found(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
    ):
        """존재하지 않는 통제항목에 연결 시 예외 발생"""
        with pytest.raises(ValueError, match="통제항목을 찾을 수 없습니다"):
            linkage_service.link_treatment_to_controls(
                treatment_plan_id=test_risk_treatment_plan.id,
                control_item_ids=[99999],
                link_type="primary",
                user_id=1,
            )

    def test_link_duplicate_prevention(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """중복 연결 방지 테스트"""
        control_item = test_control_items_for_linkage[0]

        # 첫 번째 연결
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            user_id=1,
        )

        # 동일한 연결 시도 시 예외 또는 무시
        with pytest.raises(ValueError, match="이미 연결되어 있습니다"):
            linkage_service.link_treatment_to_controls(
                treatment_plan_id=test_risk_treatment_plan.id,
                control_item_ids=[control_item.id],
                link_type="primary",
                user_id=1,
            )

    def test_link_type_validation(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결 유형 유효성 검사"""
        with pytest.raises(ValueError, match="유효하지 않은 연결 유형"):
            linkage_service.link_treatment_to_controls(
                treatment_plan_id=test_risk_treatment_plan.id,
                control_item_ids=[test_control_items_for_linkage[0].id],
                link_type="invalid_type",
                user_id=1,
            )

    def test_effectiveness_rating_range(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """효과성 등급 범위 검사"""
        with pytest.raises(ValueError, match="효과성 등급"):
            linkage_service.link_treatment_to_controls(
                treatment_plan_id=test_risk_treatment_plan.id,
                control_item_ids=[test_control_items_for_linkage[0].id],
                link_type="primary",
                effectiveness_rating=1.5,  # 범위 초과
                user_id=1,
            )


class TestGetLinkedControls:
    """연결된 통제항목 조회 테스트"""

    def test_get_linked_controls_success(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결된 통제항목 조회 성공"""
        control_ids = [item.id for item in test_control_items_for_linkage[:2]]

        # 연결 생성
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=control_ids,
            link_type="primary",
            user_id=1,
        )

        # 조회
        linked_controls = linkage_service.get_linked_controls(
            treatment_plan_id=test_risk_treatment_plan.id
        )

        assert len(linked_controls) == 2
        assert all(c.id in control_ids for c in linked_controls)

    def test_get_linked_controls_empty(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
    ):
        """연결된 통제항목이 없는 경우 빈 목록 반환"""
        linked_controls = linkage_service.get_linked_controls(
            treatment_plan_id=test_risk_treatment_plan.id
        )

        assert linked_controls == []

    def test_get_linked_controls_with_details(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결 상세 정보 포함 조회"""
        control_item = test_control_items_for_linkage[0]

        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            effectiveness_rating=0.85,
            user_id=1,
        )

        # 상세 정보 포함 조회
        links_with_details = linkage_service.get_linked_controls_with_details(
            treatment_plan_id=test_risk_treatment_plan.id
        )

        assert len(links_with_details) == 1
        assert links_with_details[0]["control_item"]["id"] == control_item.id
        assert links_with_details[0]["link_type"] == "primary"
        assert links_with_details[0]["effectiveness_rating"] == 0.85


class TestGetTreatmentsByControl:
    """통제항목에 연결된 처리 계획 조회 테스트"""

    def test_get_treatments_by_control_success(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        multiple_treatment_plans: List[RiskTreatmentPlan],
        test_control_items_for_linkage: List[ControlItem],
    ):
        """통제항목으로 처리 계획 조회"""
        control_item = test_control_items_for_linkage[0]

        # 여러 처리 계획에 동일 통제항목 연결
        for plan in multiple_treatment_plans[:2]:
            linkage_service.link_treatment_to_controls(
                treatment_plan_id=plan.id,
                control_item_ids=[control_item.id],
                link_type="primary",
                user_id=1,
            )

        # 조회
        treatments = linkage_service.get_treatments_by_control(
            control_item_id=control_item.id
        )

        assert len(treatments) == 2

    def test_get_treatments_by_control_empty(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결된 처리 계획이 없는 경우 빈 목록 반환"""
        treatments = linkage_service.get_treatments_by_control(
            control_item_id=test_control_items_for_linkage[0].id
        )

        assert treatments == []


class TestUnlinkTreatmentFromControl:
    """연결 해제 테스트"""

    def test_unlink_success(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결 해제 성공"""
        control_item = test_control_items_for_linkage[0]

        # 연결 생성
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            user_id=1,
        )

        # 연결 해제
        result = linkage_service.unlink_treatment_from_control(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_id=control_item.id,
        )

        assert result is True

        # 확인
        linked = linkage_service.get_linked_controls(
            treatment_plan_id=test_risk_treatment_plan.id
        )
        assert len(linked) == 0

    def test_unlink_not_found(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """존재하지 않는 연결 해제 시도"""
        with pytest.raises(ValueError, match="연결을 찾을 수 없습니다"):
            linkage_service.unlink_treatment_from_control(
                treatment_plan_id=test_risk_treatment_plan.id,
                control_item_id=test_control_items_for_linkage[0].id,
            )


# ============================================================================
# 5.4.2 통제 이행 현황과 위험 수준 연계 분석 테스트
# ============================================================================


class TestAnalyzeControlEffectiveness:
    """통제 효과성 분석 테스트"""

    def test_analyze_control_effectiveness_basic(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """기본 통제 효과성 분석"""
        control_item = test_control_items_for_linkage[0]

        # 연결 생성
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            effectiveness_rating=0.8,
            user_id=1,
        )

        # 효과성 분석
        result = linkage_service.analyze_control_effectiveness(
            control_item_id=control_item.id
        )

        assert "control_item_id" in result
        assert "linked_treatment_count" in result
        assert "average_effectiveness" in result
        assert "implementation_rate" in result
        assert "residual_risk_summary" in result

        assert result["control_item_id"] == control_item.id
        assert result["linked_treatment_count"] == 1

    def test_analyze_effectiveness_with_completed_actions(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
        test_user,
    ):
        """조치 결과 포함 효과성 분석"""
        control_item = test_control_items_for_linkage[0]

        # 처리 계획 상태를 completed로 변경
        test_risk_treatment_plan.status = "completed"
        db.commit()

        # 연결 생성
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            effectiveness_rating=0.9,
            user_id=1,
        )

        # 조치 결과 추가
        action = RiskTreatmentAction(
            plan_id=test_risk_treatment_plan.id,
            action_description="통제 구현 완료",
            result="성공적으로 구현됨",
            residual_risk_score=4,  # 잔여 위험
            completed_by=test_user.id,
            completed_at=datetime.utcnow(),
        )
        db.add(action)
        db.commit()

        # 효과성 분석
        result = linkage_service.analyze_control_effectiveness(
            control_item_id=control_item.id
        )

        assert result["implementation_rate"] > 0
        assert "residual_risk_summary" in result
        assert result["residual_risk_summary"]["average"] == 4

    def test_analyze_effectiveness_no_links(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결이 없는 통제항목 분석"""
        control_item = test_control_items_for_linkage[0]

        result = linkage_service.analyze_control_effectiveness(
            control_item_id=control_item.id
        )

        assert result["linked_treatment_count"] == 0
        assert result["average_effectiveness"] == 0
        assert result["implementation_rate"] == 0


class TestGetRiskControlMatrix:
    """위험-통제 매트릭스 테스트"""

    def test_get_risk_control_matrix_basic(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        multiple_treatment_plans: List[RiskTreatmentPlan],
        test_control_items_for_linkage: List[ControlItem],
    ):
        """기본 위험-통제 매트릭스 생성"""
        # 다양한 연결 생성
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=multiple_treatment_plans[0].id,
            control_item_ids=[test_control_items_for_linkage[0].id],
            link_type="primary",
            user_id=1,
        )
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=multiple_treatment_plans[1].id,
            control_item_ids=[
                test_control_items_for_linkage[0].id,
                test_control_items_for_linkage[1].id,
            ],
            link_type="secondary",
            user_id=1,
        )

        # 매트릭스 생성
        matrix = linkage_service.get_risk_control_matrix()

        assert "matrix" in matrix
        assert "coverage_analysis" in matrix
        assert "uncontrolled_risks" in matrix
        assert "control_summary" in matrix

    def test_get_matrix_coverage_analysis(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        multiple_treatment_plans: List[RiskTreatmentPlan],
        test_control_items_for_linkage: List[ControlItem],
    ):
        """커버리지 분석 확인"""
        # 일부만 연결
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=multiple_treatment_plans[0].id,
            control_item_ids=[test_control_items_for_linkage[0].id],
            link_type="primary",
            user_id=1,
        )

        matrix = linkage_service.get_risk_control_matrix()

        coverage = matrix["coverage_analysis"]
        assert "total_risks" in coverage
        assert "controlled_risks" in coverage
        assert "coverage_percentage" in coverage

        # 통제되지 않은 위험 확인
        uncontrolled = matrix["uncontrolled_risks"]
        assert len(uncontrolled) >= 2  # 3개 중 1개만 연결됨

    def test_get_matrix_with_scenario_filter(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_scenario,
        multiple_treatment_plans: List[RiskTreatmentPlan],
        test_control_items_for_linkage: List[ControlItem],
    ):
        """시나리오별 필터링된 매트릭스"""
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=multiple_treatment_plans[0].id,
            control_item_ids=[test_control_items_for_linkage[0].id],
            link_type="primary",
            user_id=1,
        )

        matrix = linkage_service.get_risk_control_matrix(
            scenario_id=test_risk_scenario.id
        )

        assert "matrix" in matrix


class TestCalculateResidualRiskTrend:
    """잔여 위험 추이 분석 테스트"""

    def test_calculate_residual_risk_trend_basic(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_user,
    ):
        """기본 잔여 위험 추이 계산"""
        # 여러 조치 결과 추가 (시간 순서대로)
        for i, score in enumerate([8, 6, 4]):
            action = RiskTreatmentAction(
                plan_id=test_risk_treatment_plan.id,
                action_description=f"조치 {i + 1}",
                result="완료",
                residual_risk_score=score,
                completed_by=test_user.id,
                completed_at=datetime.utcnow() - timedelta(days=30 - i * 10),
            )
            db.add(action)
        db.commit()

        # 추이 계산
        trend = linkage_service.calculate_residual_risk_trend(
            treatment_plan_id=test_risk_treatment_plan.id
        )

        assert "treatment_plan_id" in trend
        assert "initial_risk_score" in trend
        assert "current_residual_score" in trend
        assert "trend_data" in trend
        assert "reduction_percentage" in trend

        # 위험이 감소했는지 확인
        assert trend["current_residual_score"] < trend["initial_risk_score"]

    def test_calculate_trend_no_actions(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
    ):
        """조치 결과가 없는 경우"""
        trend = linkage_service.calculate_residual_risk_trend(
            treatment_plan_id=test_risk_treatment_plan.id
        )

        assert trend["current_residual_score"] == trend["initial_risk_score"]
        assert trend["reduction_percentage"] == 0
        assert len(trend["trend_data"]) == 0

    def test_calculate_trend_not_found(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
    ):
        """존재하지 않는 처리 계획"""
        with pytest.raises(ValueError, match="위험 처리 계획을 찾을 수 없습니다"):
            linkage_service.calculate_residual_risk_trend(
                treatment_plan_id=99999
            )


class TestBulkOperations:
    """대량 작업 테스트"""

    def test_bulk_link_controls(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        multiple_treatment_plans: List[RiskTreatmentPlan],
        test_control_items_for_linkage: List[ControlItem],
    ):
        """대량 연결 작업"""
        links_data = [
            {
                "treatment_plan_id": multiple_treatment_plans[0].id,
                "control_item_ids": [test_control_items_for_linkage[0].id],
                "link_type": "primary",
            },
            {
                "treatment_plan_id": multiple_treatment_plans[1].id,
                "control_item_ids": [
                    test_control_items_for_linkage[0].id,
                    test_control_items_for_linkage[1].id,
                ],
                "link_type": "secondary",
            },
        ]

        result = linkage_service.bulk_link_controls(
            links_data=links_data,
            user_id=1,
        )

        assert result["success_count"] == 3  # 총 3개 연결
        assert result["failed_count"] == 0


# ============================================================================
# 통합 테스트
# ============================================================================


class TestIntegration:
    """통합 테스트"""

    def test_full_linkage_workflow(
        self,
        db: Session,
        linkage_service: RiskControlLinkageService,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
        test_user,
    ):
        """전체 연계 워크플로우 테스트"""
        control_ids = [item.id for item in test_control_items_for_linkage[:2]]

        # 1. 연결 생성
        links = linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=control_ids,
            link_type="primary",
            effectiveness_rating=0.8,
            user_id=test_user.id,
        )
        assert len(links) == 2

        # 2. 연결 조회
        linked = linkage_service.get_linked_controls(
            treatment_plan_id=test_risk_treatment_plan.id
        )
        assert len(linked) == 2

        # 3. 역방향 조회
        treatments = linkage_service.get_treatments_by_control(
            control_item_id=control_ids[0]
        )
        assert len(treatments) == 1

        # 4. 효과성 분석
        effectiveness = linkage_service.analyze_control_effectiveness(
            control_item_id=control_ids[0]
        )
        assert effectiveness["linked_treatment_count"] == 1

        # 5. 매트릭스 생성
        matrix = linkage_service.get_risk_control_matrix()
        assert matrix["coverage_analysis"]["controlled_risks"] >= 1

        # 6. 일부 연결 해제
        linkage_service.unlink_treatment_from_control(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_id=control_ids[0],
        )

        # 7. 해제 확인
        linked_after = linkage_service.get_linked_controls(
            treatment_plan_id=test_risk_treatment_plan.id
        )
        assert len(linked_after) == 1


# ============================================================================
# API 테스트
# ============================================================================


class TestRiskControlLinkageAPI:
    """위험-통제항목 연계 API 테스트"""

    def test_link_controls_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결 생성 API 테스트"""
        response = client.post(
            "/api/v1/risk-control-linkage/link",
            json={
                "treatment_plan_id": test_risk_treatment_plan.id,
                "control_item_ids": [test_control_items_for_linkage[0].id],
                "link_type": "primary",
                "effectiveness_rating": 0.8,
            },
            headers=admin_auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert len(data) == 1
        assert data[0]["link_type"] == "primary"
        assert data[0]["effectiveness_rating"] == 0.8

    def test_link_controls_api_invalid_treatment(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        test_control_items_for_linkage: List[ControlItem],
    ):
        """존재하지 않는 처리 계획에 연결 시 400 응답"""
        response = client.post(
            "/api/v1/risk-control-linkage/link",
            json={
                "treatment_plan_id": 99999,
                "control_item_ids": [test_control_items_for_linkage[0].id],
                "link_type": "primary",
            },
            headers=admin_auth_headers,
        )

        assert response.status_code == 400

    def test_get_linked_controls_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        db: Session,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결된 통제항목 조회 API 테스트"""
        # 먼저 연결 생성
        linkage_service = RiskControlLinkageService(db)
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[test_control_items_for_linkage[0].id],
            link_type="primary",
            user_id=1,
        )

        response = client.get(
            f"/api/v1/risk-control-linkage/treatment/{test_risk_treatment_plan.id}/controls",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "control_item" in data[0]

    def test_get_treatments_by_control_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        db: Session,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """통제항목에 연결된 처리 계획 조회 API 테스트"""
        control_item = test_control_items_for_linkage[0]

        # 연결 생성
        linkage_service = RiskControlLinkageService(db)
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            user_id=1,
        )

        response = client.get(
            f"/api/v1/risk-control-linkage/control/{control_item.id}/treatments",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_unlink_control_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        db: Session,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """연결 해제 API 테스트"""
        control_item = test_control_items_for_linkage[0]

        # 연결 생성
        linkage_service = RiskControlLinkageService(db)
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            user_id=1,
        )

        response = client.request(
            "DELETE",
            "/api/v1/risk-control-linkage/unlink",
            json={
                "treatment_plan_id": test_risk_treatment_plan.id,
                "control_item_id": control_item.id,
            },
            headers=admin_auth_headers,
        )

        assert response.status_code == 204

    def test_control_effectiveness_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        db: Session,
        test_risk_treatment_plan: RiskTreatmentPlan,
        test_control_items_for_linkage: List[ControlItem],
    ):
        """통제 효과성 분석 API 테스트"""
        control_item = test_control_items_for_linkage[0]

        # 연결 생성
        linkage_service = RiskControlLinkageService(db)
        linkage_service.link_treatment_to_controls(
            treatment_plan_id=test_risk_treatment_plan.id,
            control_item_ids=[control_item.id],
            link_type="primary",
            effectiveness_rating=0.85,
            user_id=1,
        )

        response = client.get(
            f"/api/v1/risk-control-linkage/control/{control_item.id}/effectiveness",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["control_item_id"] == control_item.id
        assert data["linked_treatment_count"] == 1
        assert data["average_effectiveness"] == 0.85

    def test_risk_control_matrix_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
    ):
        """위험-통제 매트릭스 API 테스트"""
        response = client.get(
            "/api/v1/risk-control-linkage/matrix",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "matrix" in data
        assert "coverage_analysis" in data
        assert "uncontrolled_risks" in data
        assert "control_summary" in data

    def test_residual_risk_trend_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        test_risk_treatment_plan: RiskTreatmentPlan,
    ):
        """잔여 위험 추이 API 테스트"""
        response = client.get(
            f"/api/v1/risk-control-linkage/treatment/{test_risk_treatment_plan.id}/residual-trend",
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "treatment_plan_id" in data
        assert "initial_risk_score" in data
        assert "current_residual_score" in data
        assert "trend_data" in data
        assert "reduction_percentage" in data

    def test_bulk_link_api(
        self,
        client: TestClient,
        admin_auth_headers: Dict[str, str],
        multiple_treatment_plans: List[RiskTreatmentPlan],
        test_control_items_for_linkage: List[ControlItem],
    ):
        """대량 연결 API 테스트"""
        response = client.post(
            "/api/v1/risk-control-linkage/bulk-link",
            json={
                "links": [
                    {
                        "treatment_plan_id": multiple_treatment_plans[0].id,
                        "control_item_ids": [test_control_items_for_linkage[0].id],
                        "link_type": "primary",
                    },
                    {
                        "treatment_plan_id": multiple_treatment_plans[1].id,
                        "control_item_ids": [test_control_items_for_linkage[1].id],
                        "link_type": "secondary",
                    },
                ]
            },
            headers=admin_auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 2
        assert data["failed_count"] == 0

    def test_unauthorized_access(
        self,
        client: TestClient,
        test_risk_treatment_plan: RiskTreatmentPlan,
    ):
        """인증되지 않은 접근 테스트"""
        response = client.get(
            f"/api/v1/risk-control-linkage/treatment/{test_risk_treatment_plan.id}/controls",
        )

        assert response.status_code == 401
