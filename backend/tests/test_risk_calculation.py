"""
위험도 자동 계산 엔진 테스트
Phase 2: 5.2 위험도 자동 계산 엔진 구현

TDD 기반 테스트:
- 5.2.1 DoR 계산 공식 구현
- 5.2.2 위험 등급 자동 분류
- 5.2.3 배치 계산 기능
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.services.risk_calculation_service import (
    RiskCalculationService,
    RiskLevelThresholds,
    ThreatLevel,
    VulnerabilityLevel,
)
from app.models.risk import RiskAssessment, RiskScenario, Threat, Vulnerability
from app.models.asset import Asset, AssetType, AssetValuation


# ========================================================================
# 5.2.1 DoR 계산 공식 테스트 (자산가치 x 위협등급 x 취약점등급)
# ========================================================================

class TestDoRCalculation:
    """DoR(위험도) 계산 테스트"""

    def test_calculate_dor_minimum_values(self, db: Session):
        """최소값 테스트: 1 x 1 x 1 = 1"""
        service = RiskCalculationService(db)

        result = service.calculate_dor(
            asset_value=1,
            threat_level=ThreatLevel.LOW,
            vulnerability_level=VulnerabilityLevel.LOW
        )

        assert result == 1

    def test_calculate_dor_maximum_values(self, db: Session):
        """최대값 테스트: 5 x 3 x 3 = 45"""
        service = RiskCalculationService(db)

        result = service.calculate_dor(
            asset_value=5,
            threat_level=ThreatLevel.HIGH,
            vulnerability_level=VulnerabilityLevel.HIGH
        )

        assert result == 45

    def test_calculate_dor_medium_values(self, db: Session):
        """중간값 테스트: 3 x 2 x 2 = 12"""
        service = RiskCalculationService(db)

        result = service.calculate_dor(
            asset_value=3,
            threat_level=ThreatLevel.MEDIUM,
            vulnerability_level=VulnerabilityLevel.MEDIUM
        )

        assert result == 12

    def test_calculate_dor_mixed_values(self, db: Session):
        """혼합 값 테스트: 4 x 3 x 2 = 24"""
        service = RiskCalculationService(db)

        result = service.calculate_dor(
            asset_value=4,
            threat_level=ThreatLevel.HIGH,
            vulnerability_level=VulnerabilityLevel.MEDIUM
        )

        assert result == 24

    def test_calculate_dor_with_integer_levels(self, db: Session):
        """정수로 전달된 등급 테스트"""
        service = RiskCalculationService(db)

        # 정수로도 계산 가능해야 함
        result = service.calculate_dor(
            asset_value=3,
            threat_level=2,
            vulnerability_level=3
        )

        assert result == 18

    def test_calculate_dor_invalid_asset_value_zero(self, db: Session):
        """유효하지 않은 자산 가치 (0) 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="자산 가치는 1-5 사이여야 합니다"):
            service.calculate_dor(
                asset_value=0,
                threat_level=ThreatLevel.MEDIUM,
                vulnerability_level=VulnerabilityLevel.MEDIUM
            )

    def test_calculate_dor_invalid_asset_value_negative(self, db: Session):
        """유효하지 않은 자산 가치 (음수) 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="자산 가치는 1-5 사이여야 합니다"):
            service.calculate_dor(
                asset_value=-1,
                threat_level=ThreatLevel.MEDIUM,
                vulnerability_level=VulnerabilityLevel.MEDIUM
            )

    def test_calculate_dor_invalid_asset_value_too_high(self, db: Session):
        """유효하지 않은 자산 가치 (6 이상) 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="자산 가치는 1-5 사이여야 합니다"):
            service.calculate_dor(
                asset_value=6,
                threat_level=ThreatLevel.MEDIUM,
                vulnerability_level=VulnerabilityLevel.MEDIUM
            )

    def test_calculate_dor_invalid_threat_level_zero(self, db: Session):
        """유효하지 않은 위협 등급 (0) 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="위협 등급은 1-3 사이여야 합니다"):
            service.calculate_dor(
                asset_value=3,
                threat_level=0,
                vulnerability_level=VulnerabilityLevel.MEDIUM
            )

    def test_calculate_dor_invalid_vulnerability_level_zero(self, db: Session):
        """유효하지 않은 취약점 등급 (0) 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="취약점 등급은 1-3 사이여야 합니다"):
            service.calculate_dor(
                asset_value=3,
                threat_level=ThreatLevel.MEDIUM,
                vulnerability_level=0
            )


# ========================================================================
# 5.2.2 위험 등급 자동 분류 테스트 (상/중/하 기준)
# ========================================================================

class TestRiskLevelClassification:
    """위험 등급 분류 테스트"""

    def test_classify_risk_level_high(self, db: Session):
        """고위험 분류 테스트: DoR >= 30"""
        service = RiskCalculationService(db)

        # 경계값 테스트
        assert service.classify_risk_level(30) == "high"
        assert service.classify_risk_level(45) == "high"
        assert service.classify_risk_level(35) == "high"

    def test_classify_risk_level_medium(self, db: Session):
        """중위험 분류 테스트: 15 <= DoR < 30"""
        service = RiskCalculationService(db)

        # 경계값 테스트
        assert service.classify_risk_level(15) == "medium"
        assert service.classify_risk_level(29) == "medium"
        assert service.classify_risk_level(20) == "medium"

    def test_classify_risk_level_low(self, db: Session):
        """저위험 분류 테스트: DoR < 15"""
        service = RiskCalculationService(db)

        # 경계값 테스트
        assert service.classify_risk_level(1) == "low"
        assert service.classify_risk_level(14) == "low"
        assert service.classify_risk_level(10) == "low"

    def test_classify_risk_level_boundary_15(self, db: Session):
        """경계값 15 테스트 (medium의 하한)"""
        service = RiskCalculationService(db)

        assert service.classify_risk_level(14) == "low"
        assert service.classify_risk_level(15) == "medium"

    def test_classify_risk_level_boundary_30(self, db: Session):
        """경계값 30 테스트 (high의 하한)"""
        service = RiskCalculationService(db)

        assert service.classify_risk_level(29) == "medium"
        assert service.classify_risk_level(30) == "high"

    def test_classify_risk_level_invalid_negative(self, db: Session):
        """유효하지 않은 DoR (음수) 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="DoR 점수는 0 이상이어야 합니다"):
            service.classify_risk_level(-1)

    def test_classify_risk_level_zero(self, db: Session):
        """DoR이 0인 경우 테스트"""
        service = RiskCalculationService(db)

        # 0은 유효하지만 최소 DoR은 1이므로 경고 또는 low 반환
        assert service.classify_risk_level(0) == "low"


# ========================================================================
# 5.2.2 위험 등급 기준 (Thresholds) 관리 테스트
# ========================================================================

class TestRiskLevelThresholds:
    """위험 등급 기준 관리 테스트"""

    def test_get_default_thresholds(self, db: Session):
        """기본 위험 등급 기준 조회 테스트"""
        service = RiskCalculationService(db)

        thresholds = service.get_risk_level_thresholds()

        assert thresholds.high_threshold == 30
        assert thresholds.medium_threshold == 15
        assert thresholds.low_max == 14

    def test_set_custom_thresholds(self, db: Session):
        """커스텀 위험 등급 기준 설정 테스트"""
        service = RiskCalculationService(db)

        new_thresholds = RiskLevelThresholds(
            high_threshold=25,
            medium_threshold=12
        )

        service.set_risk_level_thresholds(new_thresholds)

        # 새로운 기준으로 분류
        assert service.classify_risk_level(25) == "high"
        assert service.classify_risk_level(24) == "medium"
        assert service.classify_risk_level(12) == "medium"
        assert service.classify_risk_level(11) == "low"

    def test_set_invalid_thresholds_medium_higher_than_high(self, db: Session):
        """유효하지 않은 기준: medium >= high"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="high_threshold는 medium_threshold보다 커야 합니다"):
            service.set_risk_level_thresholds(
                RiskLevelThresholds(high_threshold=20, medium_threshold=25)
            )

    def test_set_invalid_thresholds_negative(self, db: Session):
        """유효하지 않은 기준: 음수"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="임계값은 양수여야 합니다"):
            service.set_risk_level_thresholds(
                RiskLevelThresholds(high_threshold=-1, medium_threshold=15)
            )


# ========================================================================
# 5.2.3 단일 위험 평가 재계산 테스트
# ========================================================================

class TestRecalculateRiskAssessment:
    """단일 위험 평가 재계산 테스트"""

    def test_recalculate_risk_assessment_success(
        self,
        db: Session,
        test_risk_assessment: RiskAssessment
    ):
        """위험 평가 재계산 성공 테스트"""
        service = RiskCalculationService(db)

        # 초기값 확인 (2 x 2 x 2 = 8)
        # 모델 이벤트로 이미 계산되어 있을 수 있음

        # asset_value를 변경하고 DB에 반영
        test_risk_assessment.asset_value = 3  # 3 x 2 x 2 = 12
        db.flush()  # 변경사항을 DB에 반영

        result = service.recalculate_risk_assessment(test_risk_assessment.id)

        assert result.risk_score == 12
        # 서비스 기준 (기본: high>=30, medium>=15)
        # 12 < 15 이므로 low
        assert result.risk_level == "low"

    def test_recalculate_risk_assessment_high_risk(
        self,
        db: Session,
        test_risk_assessment: RiskAssessment
    ):
        """고위험 평가 재계산 테스트"""
        service = RiskCalculationService(db)

        # 5 x 3 x 3 = 45 (high, >= 30)
        test_risk_assessment.asset_value = 5
        test_risk_assessment.threat_level = 3
        test_risk_assessment.vulnerability_level = 3
        db.flush()  # 변경사항을 DB에 반영

        result = service.recalculate_risk_assessment(test_risk_assessment.id)

        assert result.risk_score == 45
        assert result.risk_level == "high"

    def test_recalculate_risk_assessment_medium_risk(
        self,
        db: Session,
        test_risk_assessment: RiskAssessment
    ):
        """중위험 평가 재계산 테스트"""
        service = RiskCalculationService(db)

        # 5 x 3 x 2 = 30 은 high 경계값이므로 중위험 테스트를 위해
        # 5 x 2 x 3 = 30 -> high (경계값이므로 high)
        # 5 x 2 x 2 = 20 -> medium (15 <= 20 < 30)
        test_risk_assessment.asset_value = 5
        test_risk_assessment.threat_level = 2
        test_risk_assessment.vulnerability_level = 2
        db.flush()  # 변경사항을 DB에 반영

        result = service.recalculate_risk_assessment(test_risk_assessment.id)

        assert result.risk_score == 20
        # 서비스 기준: 15 <= 20 < 30 이므로 medium
        assert result.risk_level == "medium"

    def test_recalculate_risk_assessment_not_found(self, db: Session):
        """존재하지 않는 위험 평가 재계산 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="위험 평가를 찾을 수 없습니다"):
            service.recalculate_risk_assessment(99999)

    def test_recalculate_risk_assessment_returns_updated_time(
        self,
        db: Session,
        test_risk_assessment: RiskAssessment,
        test_user
    ):
        """재계산 시 업데이트 시간이 갱신되는지 테스트"""
        service = RiskCalculationService(db)

        original_evaluated_at = test_risk_assessment.evaluated_at

        result = service.recalculate_risk_assessment(
            test_risk_assessment.id,
            user_id=test_user.id
        )

        # 평가 시간이 갱신되어야 함
        assert result.evaluated_at is not None
        if original_evaluated_at:
            assert result.evaluated_at >= original_evaluated_at


# ========================================================================
# 5.2.3 배치 계산 기능 테스트 (시나리오 전체 재계산)
# ========================================================================

class TestBatchRecalculateScenario:
    """시나리오 전체 재계산 테스트"""

    @pytest.fixture
    def multiple_risk_assessments(
        self,
        db: Session,
        test_risk_scenario: RiskScenario,
        test_asset: Asset,
        test_threat: Threat,
        test_vulnerability: Vulnerability
    ):
        """여러 위험 평가 생성"""
        assessments = []

        # 다양한 조합의 위험 평가 생성
        # 서비스 기준: high >= 30, medium >= 15, low < 15
        test_cases = [
            (1, 1, 1),  # DoR: 1 (low)
            (2, 2, 2),  # DoR: 8 (low)
            (3, 2, 3),  # DoR: 18 (medium: 15 <= 18 < 30)
            (4, 3, 2),  # DoR: 24 (medium: 15 <= 24 < 30)
            (5, 3, 3),  # DoR: 45 (high: >= 30)
        ]

        for asset_val, threat_lvl, vuln_lvl in test_cases:
            assessment = RiskAssessment(
                scenario_id=test_risk_scenario.id,
                asset_id=test_asset.id,
                threat_id=test_threat.id,
                vulnerability_id=test_vulnerability.id,
                asset_value=asset_val,
                threat_level=threat_lvl,
                vulnerability_level=vuln_lvl,
            )
            db.add(assessment)
            assessments.append(assessment)

        db.commit()
        for a in assessments:
            db.refresh(a)

        return assessments

    def test_batch_recalculate_scenario_success(
        self,
        db: Session,
        test_risk_scenario: RiskScenario,
        multiple_risk_assessments: list
    ):
        """시나리오 전체 재계산 성공 테스트"""
        service = RiskCalculationService(db)

        result = service.batch_recalculate_scenario(test_risk_scenario.id)

        assert result["scenario_id"] == test_risk_scenario.id
        assert result["total_recalculated"] == 5
        assert result["success"] is True

    def test_batch_recalculate_scenario_verify_scores(
        self,
        db: Session,
        test_risk_scenario: RiskScenario,
        multiple_risk_assessments: list
    ):
        """시나리오 재계산 후 점수 검증 테스트"""
        service = RiskCalculationService(db)

        service.batch_recalculate_scenario(test_risk_scenario.id)

        # DB에서 다시 조회
        assessments = (
            db.query(RiskAssessment)
            .filter(RiskAssessment.scenario_id == test_risk_scenario.id)
            .order_by(RiskAssessment.asset_value)
            .all()
        )

        expected_scores = [1, 8, 18, 24, 45]
        # 서비스 기준: high >= 30, medium >= 15, low < 15
        expected_levels = ["low", "low", "medium", "medium", "high"]

        for i, assessment in enumerate(assessments):
            assert assessment.risk_score == expected_scores[i]
            assert assessment.risk_level == expected_levels[i]

    def test_batch_recalculate_scenario_summary(
        self,
        db: Session,
        test_risk_scenario: RiskScenario,
        multiple_risk_assessments: list
    ):
        """시나리오 재계산 결과 요약 테스트"""
        service = RiskCalculationService(db)

        result = service.batch_recalculate_scenario(test_risk_scenario.id)

        # 요약 통계 확인
        assert result["summary"]["high_count"] == 1
        assert result["summary"]["medium_count"] == 2
        assert result["summary"]["low_count"] == 2
        assert result["summary"]["total"] == 5

    def test_batch_recalculate_scenario_not_found(self, db: Session):
        """존재하지 않는 시나리오 재계산 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError, match="시나리오를 찾을 수 없습니다"):
            service.batch_recalculate_scenario(99999)

    def test_batch_recalculate_scenario_empty(
        self,
        db: Session,
        test_risk_scenario: RiskScenario
    ):
        """빈 시나리오 재계산 테스트"""
        service = RiskCalculationService(db)

        result = service.batch_recalculate_scenario(test_risk_scenario.id)

        assert result["total_recalculated"] == 0
        assert result["summary"]["total"] == 0

    def test_batch_recalculate_scenario_with_custom_thresholds(
        self,
        db: Session,
        test_risk_scenario: RiskScenario,
        multiple_risk_assessments: list
    ):
        """커스텀 기준으로 시나리오 재계산 테스트"""
        service = RiskCalculationService(db)

        # 커스텀 기준 설정: high >= 20, medium >= 10
        custom_thresholds = RiskLevelThresholds(
            high_threshold=20,
            medium_threshold=10
        )
        service.set_risk_level_thresholds(custom_thresholds)

        result = service.batch_recalculate_scenario(test_risk_scenario.id)

        # 새 기준으로 분류
        # DoR: 1 (low), 8 (low), 18 (medium), 24 (high), 45 (high)
        assert result["summary"]["high_count"] == 2
        assert result["summary"]["medium_count"] == 1
        assert result["summary"]["low_count"] == 2


# ========================================================================
# 통합 테스트: DoR 계산 + 등급 분류 + 배치 처리
# ========================================================================

class TestRiskCalculationIntegration:
    """위험 계산 통합 테스트"""

    def test_calculate_and_classify_flow(self, db: Session):
        """DoR 계산 -> 등급 분류 전체 흐름 테스트"""
        service = RiskCalculationService(db)

        # 1. DoR 계산
        dor = service.calculate_dor(
            asset_value=4,
            threat_level=ThreatLevel.HIGH,
            vulnerability_level=ThreatLevel.HIGH
        )

        # 2. 등급 분류
        level = service.classify_risk_level(dor)

        assert dor == 36  # 4 x 3 x 3
        assert level == "high"

    def test_full_assessment_workflow(
        self,
        db: Session,
        test_risk_scenario: RiskScenario,
        test_asset: Asset,
        test_threat: Threat,
        test_vulnerability: Vulnerability,
        test_user
    ):
        """전체 위험 평가 워크플로우 테스트"""
        service = RiskCalculationService(db)

        # 1. 새 위험 평가 생성 (점수 계산 포함)
        assessment = service.create_risk_assessment_with_calculation(
            scenario_id=test_risk_scenario.id,
            asset_id=test_asset.id,
            threat_id=test_threat.id,
            vulnerability_id=test_vulnerability.id,
            asset_value=4,
            threat_level=ThreatLevel.HIGH,
            vulnerability_level=VulnerabilityLevel.MEDIUM,
            user_id=test_user.id
        )

        # 2. 계산된 점수 및 등급 확인
        # 4 x 3 x 2 = 24 (medium: 15 <= 24 < 30)
        assert assessment.risk_score == 24
        assert assessment.risk_level == "medium"

        # 3. 값 변경 후 재계산
        assessment.asset_value = 5
        db.flush()  # 변경사항을 DB에 반영
        updated = service.recalculate_risk_assessment(assessment.id)

        # 5 x 3 x 2 = 30 (high: >= 30)
        assert updated.risk_score == 30
        assert updated.risk_level == "high"


# ========================================================================
# 엣지 케이스 테스트
# ========================================================================

class TestEdgeCases:
    """엣지 케이스 테스트"""

    def test_none_values_handling(self, db: Session):
        """None 값 처리 테스트"""
        service = RiskCalculationService(db)

        with pytest.raises(ValueError):
            service.calculate_dor(
                asset_value=None,
                threat_level=ThreatLevel.MEDIUM,
                vulnerability_level=VulnerabilityLevel.MEDIUM
            )

    def test_float_asset_value(self, db: Session):
        """소수점 자산 가치 처리 테스트"""
        service = RiskCalculationService(db)

        # 정수로 변환되어야 함
        result = service.calculate_dor(
            asset_value=3.7,  # 4로 반올림
            threat_level=ThreatLevel.MEDIUM,
            vulnerability_level=VulnerabilityLevel.MEDIUM
        )

        assert result == 16  # 4 x 2 x 2

    def test_string_level_conversion(self, db: Session):
        """문자열 등급 변환 테스트"""
        service = RiskCalculationService(db)

        result = service.calculate_dor(
            asset_value=3,
            threat_level="high",  # 문자열로 전달
            vulnerability_level="low"
        )

        assert result == 9  # 3 x 3 x 1

    def test_concurrent_batch_recalculation(
        self,
        db: Session,
        test_risk_scenario: RiskScenario
    ):
        """동시 배치 재계산 시 데이터 무결성 테스트"""
        service = RiskCalculationService(db)

        # 첫 번째 재계산
        result1 = service.batch_recalculate_scenario(test_risk_scenario.id)

        # 두 번째 재계산 (동일한 결과여야 함)
        result2 = service.batch_recalculate_scenario(test_risk_scenario.id)

        assert result1["total_recalculated"] == result2["total_recalculated"]
