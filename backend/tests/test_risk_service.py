"""
위험 관리 서비스 테스트 (TDD)
Phase 2: FR-601 ~ FR-607
"""
import pytest
from datetime import date, datetime, timedelta
from typing import Dict
from sqlalchemy.orm import Session

from app.models.risk import (
    ThreatCategory, Threat, VulnerabilityCategory, Vulnerability,
    RiskScenario, RiskAssessment, DoAConfig, RiskTreatmentPlan,
    RiskTreatmentAction,
)
from app.services.risk_service import RiskService


# =============================================================================
# 4.2.1: 위협/취약점 CRUD 테스트
# =============================================================================

class TestThreatCRUD:
    """위협 CRUD 테스트"""

    def test_create_threat(self, db: Session, test_threat_category):
        """위협 생성"""
        service = RiskService(db)
        threat = service.create_threat(
            code="T-NEW-001",
            name="새로운 위협",
            description="테스트 위협",
            category_id=test_threat_category.id,
            threat_level=3,
        )
        assert threat.id is not None
        assert threat.code == "T-NEW-001"
        assert threat.threat_level == 3
        assert threat.is_custom is True

    def test_create_threat_duplicate_code(self, db: Session, test_threat):
        """위협 생성 - 중복 코드"""
        service = RiskService(db)
        with pytest.raises(ValueError, match="이미 존재하는"):
            service.create_threat(
                code=test_threat.code,  # 이미 존재
                name="중복 위협",
            )

    def test_get_threat_by_id(self, db: Session, test_threat):
        """위협 ID로 조회"""
        service = RiskService(db)
        threat = service.get_threat_by_id(test_threat.id)
        assert threat is not None
        assert threat.code == test_threat.code

    def test_get_threats_list(self, db: Session, test_threat, test_threat_category):
        """위협 목록 조회"""
        service = RiskService(db)
        items, total = service.get_threats()
        assert total >= 1
        assert any(t.code == test_threat.code for t in items)

    def test_get_threats_by_category(self, db: Session, test_threat, test_threat_category):
        """위협 분류별 조회"""
        service = RiskService(db)
        items, total = service.get_threats(category_id=test_threat_category.id)
        assert total >= 1

    def test_update_threat(self, db: Session, test_threat):
        """위협 수정"""
        service = RiskService(db)
        updated = service.update_threat(
            threat_id=test_threat.id,
            name="수정된 위협명",
            threat_level=1,
        )
        assert updated.name == "수정된 위협명"
        assert updated.threat_level == 1

    def test_delete_threat_custom(self, db: Session):
        """커스텀 위협 삭제"""
        service = RiskService(db)
        # 커스텀 위협 생성
        threat = service.create_threat(
            code="T-DEL-001",
            name="삭제할 위협",
        )
        # 삭제
        service.delete_threat(threat.id)
        # 조회 시 비활성화 확인
        deleted = service.get_threat_by_id(threat.id)
        assert deleted.is_active is False


class TestVulnerabilityCRUD:
    """취약점 CRUD 테스트"""

    def test_create_vulnerability(self, db: Session, test_vulnerability_category):
        """취약점 생성"""
        service = RiskService(db)
        vuln = service.create_vulnerability(
            code="V-NEW-001",
            name="새로운 취약점",
            description="테스트 취약점",
            category_id=test_vulnerability_category.id,
            vulnerability_level=3,
        )
        assert vuln.id is not None
        assert vuln.code == "V-NEW-001"
        assert vuln.vulnerability_level == 3
        assert vuln.is_custom is True

    def test_get_vulnerabilities_list(self, db: Session, test_vulnerability):
        """취약점 목록 조회"""
        service = RiskService(db)
        items, total = service.get_vulnerabilities()
        assert total >= 1


# =============================================================================
# 4.2.2: 위험 평가 시나리오 관리 테스트
# =============================================================================

class TestRiskScenarioManagement:
    """위험 시나리오 관리 테스트"""

    def test_create_scenario(self, db: Session, test_admin_user):
        """위험 시나리오 생성"""
        service = RiskService(db)
        scenario = service.create_risk_scenario(
            name="2024년 위험 평가",
            description="연간 위험 평가",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
            user_id=test_admin_user.id,
        )
        assert scenario.id is not None
        assert scenario.name == "2024년 위험 평가"
        assert scenario.status == "draft"

    def test_get_scenario_by_id(self, db: Session, test_risk_scenario):
        """시나리오 ID로 조회"""
        service = RiskService(db)
        scenario = service.get_risk_scenario_by_id(test_risk_scenario.id)
        assert scenario is not None
        assert scenario.name == test_risk_scenario.name

    def test_update_scenario_status(self, db: Session, test_risk_scenario):
        """시나리오 상태 변경"""
        service = RiskService(db)
        updated = service.update_risk_scenario(
            scenario_id=test_risk_scenario.id,
            status="completed",
        )
        assert updated.status == "completed"
        assert updated.completed_at is not None

    def test_get_scenarios_list(self, db: Session, test_risk_scenario):
        """시나리오 목록 조회"""
        service = RiskService(db)
        result = service.get_risk_scenarios()
        assert result["total"] >= 1

    def test_delete_scenario(self, db: Session, test_admin_user):
        """시나리오 삭제"""
        service = RiskService(db)
        # 새 시나리오 생성
        scenario = service.create_risk_scenario(
            name="삭제 테스트",
            start_date=date.today(),
            user_id=test_admin_user.id,
        )
        # 삭제
        service.delete_risk_scenario(scenario.id)
        # 조회 시 None
        deleted = service.get_risk_scenario_by_id(scenario.id)
        assert deleted is None


# =============================================================================
# 4.2.3: 자산-위협-취약점 3-way 매핑 테스트
# =============================================================================

class TestThreeWayMapping:
    """자산-위협-취약점 3-way 매핑 테스트"""

    def test_create_risk_assessment(
        self, db: Session, test_risk_scenario, test_asset, test_threat, test_vulnerability, test_admin_user
    ):
        """위험 평가 생성 (3-way 매핑)"""
        service = RiskService(db)
        assessment = service.create_risk_assessment(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=3,
            threat_level=2,
            vulnerability_level=3,
            user_id=test_admin_user.id,
        )
        assert assessment.id is not None
        assert assessment.asset_id == test_asset.id
        assert assessment.threat_id == test_threat.id
        assert assessment.vulnerability_id == test_vulnerability.id

    def test_get_assessments_by_scenario(self, db: Session, test_risk_assessment, test_risk_scenario):
        """시나리오별 위험 평가 목록 조회"""
        service = RiskService(db)
        result = service.get_risk_assessments(scenario_id=test_risk_scenario.id)
        assert result["total"] >= 1


# =============================================================================
# 4.2.4: 위험도(DoR) 자동 계산 테스트
# =============================================================================

class TestDoRCalculation:
    """위험도(DoR) 자동 계산 테스트"""

    def test_risk_score_calculation(
        self, db: Session, test_risk_scenario, test_asset, test_threat, test_vulnerability, test_admin_user
    ):
        """위험도 자동 계산: DoR = 자산가치 x 위협 x 취약점"""
        service = RiskService(db)
        assessment = service.create_risk_assessment(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=3,  # 상
            threat_level=3,  # 상
            vulnerability_level=3,  # 상
            user_id=test_admin_user.id,
        )
        # 3 * 3 * 3 = 27
        assert assessment.risk_score == 27
        assert assessment.risk_level == "high"

    def test_risk_level_high(
        self, db: Session, test_risk_scenario, test_asset, test_threat, test_vulnerability, test_admin_user
    ):
        """위험 등급 - 고위험 (DoR >= 18)"""
        service = RiskService(db)
        assessment = service.create_risk_assessment(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=3, threat_level=3, vulnerability_level=2,
            user_id=test_admin_user.id,
        )
        # 3 * 3 * 2 = 18
        assert assessment.risk_score == 18
        assert assessment.risk_level == "high"

    def test_risk_level_medium(
        self, db: Session, test_risk_scenario, test_asset, test_threat, test_vulnerability, test_admin_user
    ):
        """위험 등급 - 중위험 (8 <= DoR < 18)"""
        service = RiskService(db)
        assessment = service.create_risk_assessment(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=2, threat_level=2, vulnerability_level=2,
            user_id=test_admin_user.id,
        )
        # 2 * 2 * 2 = 8
        assert assessment.risk_score == 8
        assert assessment.risk_level == "medium"

    def test_risk_level_low(
        self, db: Session, test_risk_scenario, test_asset, test_threat, test_vulnerability, test_admin_user
    ):
        """위험 등급 - 저위험 (DoR < 8)"""
        service = RiskService(db)
        assessment = service.create_risk_assessment(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=1, threat_level=1, vulnerability_level=1,
            user_id=test_admin_user.id,
        )
        # 1 * 1 * 1 = 1
        assert assessment.risk_score == 1
        assert assessment.risk_level == "low"

    def test_recalculate_all_risks(self, db: Session, test_risk_scenario, test_risk_assessment):
        """시나리오 전체 위험도 재계산"""
        service = RiskService(db)
        count = service.recalculate_scenario_risks(test_risk_scenario.id)
        assert count >= 1


# =============================================================================
# 4.2.5: DoA 초과 위험 자동 식별 테스트
# =============================================================================

class TestDoAExceedingRisks:
    """DoA 초과 위험 식별 테스트"""

    def test_get_current_doa(self, db: Session, test_doa_config):
        """현재 DoA 설정 조회"""
        service = RiskService(db)
        doa = service.get_current_doa()
        assert doa is not None
        assert doa.threshold_value == test_doa_config.threshold_value

    def test_identify_exceeding_doa_risks(
        self, db: Session, test_risk_scenario, test_asset, test_threat, test_vulnerability,
        test_doa_config, test_admin_user
    ):
        """DoA 초과 위험 식별"""
        service = RiskService(db)
        # DoA = 12, 위험도 > 12인 경우 초과
        high_risk = service.create_risk_assessment(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=3, threat_level=3, vulnerability_level=2,  # 18 > 12
            user_id=test_admin_user.id,
        )

        exceeding_risks = service.get_risks_exceeding_doa(test_risk_scenario.id)
        assert len(exceeding_risks) >= 1
        assert any(r.id == high_risk.id for r in exceeding_risks)

    def test_check_risk_exceeds_doa(self, db: Session, test_risk_assessment, test_doa_config):
        """개별 위험의 DoA 초과 여부 확인"""
        service = RiskService(db)
        # test_risk_assessment의 risk_score = 2*2*2 = 8
        # DoA = 12이므로 초과하지 않음
        exceeds = service.check_risk_exceeds_doa(test_risk_assessment.id)
        assert exceeds is False


# =============================================================================
# 4.2.6: 위험 처리 계획 관리 테스트
# =============================================================================

class TestRiskTreatmentManagement:
    """위험 처리 계획 관리 테스트"""

    def test_create_treatment_plan(self, db: Session, test_risk_assessment, test_user):
        """위험 처리 계획 생성"""
        service = RiskService(db)
        plan = service.create_treatment_plan(
            risk_assessment_id=test_risk_assessment.id,
            strategy="reduce",
            description="보안 솔루션 도입",
            assignee_id=test_user.id,
            due_date=date.today() + timedelta(days=90),
            budget=10000000,
        )
        assert plan.id is not None
        assert plan.strategy == "reduce"
        assert plan.status == "planned"

    def test_get_treatment_plans(self, db: Session, test_risk_treatment_plan):
        """위험 처리 계획 목록 조회"""
        service = RiskService(db)
        result = service.get_treatment_plans()
        assert result["total"] >= 1

    def test_update_treatment_plan_status(self, db: Session, test_risk_treatment_plan):
        """위험 처리 계획 상태 변경"""
        service = RiskService(db)
        updated = service.update_treatment_plan(
            plan_id=test_risk_treatment_plan.id,
            status="completed",
        )
        assert updated.status == "completed"
        assert updated.completed_at is not None

    def test_create_treatment_action(self, db: Session, test_risk_treatment_plan, test_user):
        """위험 처리 조치 결과 등록"""
        service = RiskService(db)
        action = service.create_treatment_action(
            plan_id=test_risk_treatment_plan.id,
            action_description="보안 패치 적용",
            result="패치 완료",
            residual_risk_score=6,
            user_id=test_user.id,
        )
        assert action.id is not None
        assert action.residual_risk_score == 6

    def test_get_treatment_progress(self, db: Session, test_risk_treatment_plan):
        """위험 처리 진행률 조회"""
        service = RiskService(db)
        progress = service.get_treatment_progress()
        assert progress["total"] >= 1


# =============================================================================
# 4.2.7: 잔여 위험 재계산 테스트
# =============================================================================

class TestResidualRiskCalculation:
    """잔여 위험 재계산 테스트"""

    def test_get_latest_residual_risk(self, db: Session, test_risk_treatment_plan, test_user):
        """최신 잔여 위험 점수 조회"""
        service = RiskService(db)
        # 조치 결과 등록
        service.create_treatment_action(
            plan_id=test_risk_treatment_plan.id,
            action_description="1차 조치",
            residual_risk_score=10,
            user_id=test_user.id,
        )
        service.create_treatment_action(
            plan_id=test_risk_treatment_plan.id,
            action_description="2차 조치",
            residual_risk_score=5,  # 최신
            user_id=test_user.id,
        )

        latest = service.get_latest_residual_risk(test_risk_treatment_plan.id)
        assert latest == 5


# =============================================================================
# 4.2.8: 시나리오 비교 분석 테스트
# =============================================================================

class TestScenarioComparison:
    """시나리오 비교 분석 테스트"""

    def test_compare_scenarios(self, db: Session, test_admin_user, test_asset, test_threat, test_vulnerability):
        """두 시나리오 비교"""
        service = RiskService(db)

        # 시나리오 1 생성
        scenario1 = service.create_risk_scenario(
            name="시나리오 1",
            start_date=date.today(),
            user_id=test_admin_user.id,
        )
        service.create_risk_assessment(
            scenario_id=scenario1.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=2, threat_level=2, vulnerability_level=2,
            user_id=test_admin_user.id,
        )

        # 시나리오 2 생성
        scenario2 = service.create_risk_scenario(
            name="시나리오 2",
            start_date=date.today(),
            user_id=test_admin_user.id,
        )
        service.create_risk_assessment(
            scenario_id=scenario2.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=3, threat_level=3, vulnerability_level=3,
            user_id=test_admin_user.id,
        )

        comparison = service.compare_scenarios(scenario1.id, scenario2.id)
        assert comparison["scenario1_name"] == "시나리오 1"
        assert comparison["scenario2_name"] == "시나리오 2"
        assert "avg_risk_score_diff" in comparison
