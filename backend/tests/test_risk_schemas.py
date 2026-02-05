"""
위험 관리 스키마 테스트 (TDD)
Phase 2: FR-601 ~ FR-607
"""
import pytest
from datetime import date, datetime
from pydantic import ValidationError


# =============================================================================
# 4.1.1: 위협 스키마 테스트
# =============================================================================

class TestThreatSchemas:
    """위협 스키마 테스트"""

    def test_threat_create_valid(self):
        """위협 생성 스키마 - 유효한 데이터"""
        from app.schemas.risk import ThreatCreate

        data = ThreatCreate(
            code="T-NEW-001",
            name="새로운 위협",
            description="테스트 위협 설명",
            category_id=1,
            threat_level=2,
        )
        assert data.code == "T-NEW-001"
        assert data.name == "새로운 위협"
        assert data.threat_level == 2

    def test_threat_create_minimal(self):
        """위협 생성 스키마 - 최소 필드만"""
        from app.schemas.risk import ThreatCreate

        data = ThreatCreate(
            code="T-MIN",
            name="최소 위협",
        )
        assert data.code == "T-MIN"
        assert data.threat_level == 2  # 기본값

    def test_threat_create_invalid_level(self):
        """위협 생성 스키마 - 잘못된 등급"""
        from app.schemas.risk import ThreatCreate

        with pytest.raises(ValidationError):
            ThreatCreate(
                code="T-INVALID",
                name="잘못된 위협",
                threat_level=5,  # 1-3 범위 초과
            )

    def test_threat_response_schema(self):
        """위협 응답 스키마"""
        from app.schemas.risk import ThreatResponse

        data = ThreatResponse(
            id=1,
            code="T-001",
            name="위협",
            description="설명",
            category_id=1,
            category_name="위협 분류",
            threat_level=2,
            is_custom=False,
            is_active=True,
            created_at=datetime.now(),
        )
        assert data.id == 1
        assert data.category_name == "위협 분류"


# =============================================================================
# 4.1.2: 취약점 스키마 테스트
# =============================================================================

class TestVulnerabilitySchemas:
    """취약점 스키마 테스트"""

    def test_vulnerability_create_valid(self):
        """취약점 생성 스키마 - 유효한 데이터"""
        from app.schemas.risk import VulnerabilityCreate

        data = VulnerabilityCreate(
            code="V-NEW-001",
            name="새로운 취약점",
            description="테스트 취약점 설명",
            category_id=1,
            vulnerability_level=3,
        )
        assert data.code == "V-NEW-001"
        assert data.vulnerability_level == 3

    def test_vulnerability_create_invalid_level(self):
        """취약점 생성 스키마 - 잘못된 등급"""
        from app.schemas.risk import VulnerabilityCreate

        with pytest.raises(ValidationError):
            VulnerabilityCreate(
                code="V-INVALID",
                name="잘못된 취약점",
                vulnerability_level=0,  # 1-3 범위 미만
            )

    def test_vulnerability_assessment_create(self):
        """취약점 점검 결과 생성 스키마"""
        from app.schemas.risk import VulnerabilityAssessmentCreate

        data = VulnerabilityAssessmentCreate(
            asset_id=1,
            vulnerability_id=1,
            is_vulnerable=True,
            assessment_date=date.today(),
            findings="취약점 발견됨",
        )
        assert data.is_vulnerable is True


# =============================================================================
# 4.1.3: 위험 시나리오 스키마 테스트
# =============================================================================

class TestRiskScenarioSchemas:
    """위험 시나리오 스키마 테스트"""

    def test_risk_scenario_create_valid(self):
        """위험 시나리오 생성 스키마 - 유효한 데이터"""
        from app.schemas.risk import RiskScenarioCreate

        data = RiskScenarioCreate(
            name="2024년 위험 평가",
            description="연간 위험 평가 시나리오",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )
        assert data.name == "2024년 위험 평가"

    def test_risk_scenario_create_minimal(self):
        """위험 시나리오 생성 스키마 - 최소 필드"""
        from app.schemas.risk import RiskScenarioCreate

        data = RiskScenarioCreate(
            name="최소 시나리오",
            start_date=date.today(),
        )
        assert data.name == "최소 시나리오"
        assert data.end_date is None

    def test_risk_scenario_response(self):
        """위험 시나리오 응답 스키마"""
        from app.schemas.risk import RiskScenarioResponse

        data = RiskScenarioResponse(
            id=1,
            name="테스트 시나리오",
            description="설명",
            start_date=date.today(),
            end_date=None,
            status="draft",
            created_by=1,
            creator_name="관리자",
            completed_at=None,
            created_at=datetime.now(),
            assessment_count=0,
            high_risk_count=0,
            exceeding_doa_count=0,
        )
        assert data.status == "draft"


# =============================================================================
# 4.1.4: 위험 평가 스키마 테스트
# =============================================================================

class TestRiskAssessmentSchemas:
    """위험 평가 스키마 테스트"""

    def test_risk_assessment_create_valid(self):
        """위험 평가 생성 스키마 - 유효한 데이터"""
        from app.schemas.risk import RiskAssessmentCreate

        data = RiskAssessmentCreate(
            asset_id=1,
            threat_id=1,
            vulnerability_id=1,
            asset_value=3,
            threat_level=2,
            vulnerability_level=3,
        )
        assert data.asset_value == 3
        assert data.threat_level == 2
        assert data.vulnerability_level == 3

    def test_risk_assessment_create_invalid_values(self):
        """위험 평가 생성 스키마 - 잘못된 값"""
        from app.schemas.risk import RiskAssessmentCreate

        with pytest.raises(ValidationError):
            RiskAssessmentCreate(
                asset_id=1,
                threat_id=1,
                vulnerability_id=1,
                asset_value=4,  # 1-3 범위 초과
                threat_level=2,
                vulnerability_level=2,
            )

    def test_risk_assessment_response(self):
        """위험 평가 응답 스키마"""
        from app.schemas.risk import RiskAssessmentResponse

        data = RiskAssessmentResponse(
            id=1,
            scenario_id=1,
            asset_id=1,
            asset_name="서버",
            asset_code="AST-001",
            threat_id=1,
            threat_name="해킹 공격",
            vulnerability_id=1,
            vulnerability_name="취약한 암호화",
            asset_value=3,
            threat_level=3,
            vulnerability_level=3,
            risk_score=27,
            risk_level="high",
            exceeds_doa=True,
            evaluated_by=1,
            evaluator_name="평가자",
            evaluated_at=datetime.now(),
            remarks="고위험",
            created_at=datetime.now(),
        )
        assert data.risk_score == 27
        assert data.risk_level == "high"
        assert data.exceeds_doa is True


# =============================================================================
# 4.1.5: DoA 설정 스키마 테스트
# =============================================================================

class TestDoASchemas:
    """DoA 설정 스키마 테스트"""

    def test_doa_config_create_valid(self):
        """DoA 설정 생성 스키마 - 유효한 데이터"""
        from app.schemas.risk import DoAConfigCreate

        data = DoAConfigCreate(
            threshold_value=12,
            effective_date=date.today(),
            remarks="위험 수용 기준",
        )
        assert data.threshold_value == 12

    def test_doa_config_create_invalid_threshold(self):
        """DoA 설정 생성 스키마 - 잘못된 임계값"""
        from app.schemas.risk import DoAConfigCreate

        with pytest.raises(ValidationError):
            DoAConfigCreate(
                threshold_value=0,  # 최소 1
                effective_date=date.today(),
            )

    def test_doa_config_response(self):
        """DoA 설정 응답 스키마"""
        from app.schemas.risk import DoAConfigResponse

        data = DoAConfigResponse(
            id=1,
            threshold_value=12,
            effective_date=date.today(),
            expiry_date=None,
            approved_by=1,
            approver_name="관리자",
            approval_date=date.today(),
            remarks="기준",
            is_active=True,
            created_at=datetime.now(),
        )
        assert data.is_active is True


# =============================================================================
# 4.1.6: 위험 처리 계획 스키마 테스트
# =============================================================================

class TestRiskTreatmentSchemas:
    """위험 처리 계획 스키마 테스트"""

    def test_risk_treatment_plan_create_valid(self):
        """위험 처리 계획 생성 스키마 - 유효한 데이터"""
        from app.schemas.risk import RiskTreatmentPlanCreate

        data = RiskTreatmentPlanCreate(
            strategy="reduce",
            description="보안 솔루션 도입",
            assignee_id=1,
            due_date=date(2024, 12, 31),
            budget=10000000,
        )
        assert data.strategy == "reduce"
        assert data.budget == 10000000

    def test_risk_treatment_plan_create_invalid_strategy(self):
        """위험 처리 계획 생성 스키마 - 잘못된 전략"""
        from app.schemas.risk import RiskTreatmentPlanCreate

        with pytest.raises(ValidationError):
            RiskTreatmentPlanCreate(
                strategy="invalid_strategy",  # reduce/avoid/transfer/accept만 허용
                description="설명",
            )

    def test_risk_treatment_action_create(self):
        """위험 처리 조치 생성 스키마"""
        from app.schemas.risk import RiskTreatmentActionCreate

        data = RiskTreatmentActionCreate(
            action_description="보안 패치 적용",
            result="완료",
            residual_risk_score=8,
        )
        assert data.residual_risk_score == 8

    def test_risk_treatment_progress(self):
        """위험 처리 진행률 스키마"""
        from app.schemas.risk import RiskTreatmentProgress

        data = RiskTreatmentProgress(
            total=10,
            completed=5,
            in_progress=3,
            planned=2,
            cancelled=0,
            completion_rate=50.0,
        )
        assert data.completion_rate == 50.0


# =============================================================================
# 4.1.7: SOA 스키마 테스트
# =============================================================================

class TestSOASchemas:
    """SOA 스키마 테스트"""

    def test_soa_record_response(self):
        """SOA 레코드 응답 스키마"""
        from app.schemas.risk import SOARecordResponse

        data = SOARecordResponse(
            id=1,
            control_item_id=1,
            control_code="1.1.1",
            control_title="정보보호 정책",
            is_applicable=True,
            exclusion_reason=None,
            implementation_status="fully_implemented",
            implementation_evidence="정보보호 정책서 v1.0",
            related_assets="서버 A, 서버 B",
            related_risks="위험 1, 위험 2",
            remarks="이상 없음",
            created_at=datetime.now(),
        )
        assert data.is_applicable is True
        assert data.implementation_status == "fully_implemented"

    def test_soa_update_schema(self):
        """SOA 업데이트 스키마"""
        from app.schemas.risk import SOARecordUpdate

        data = SOARecordUpdate(
            is_applicable=False,
            exclusion_reason="해당 사항 없음",
            implementation_status="not_applicable",
        )
        assert data.is_applicable is False

    def test_soa_export_request(self):
        """SOA 내보내기 요청 스키마"""
        from app.schemas.risk import SOAExportRequest

        data = SOAExportRequest(
            format="excel",
            template_type="isms_p",
        )
        assert data.format == "excel"
        assert data.template_type == "isms_p"


# =============================================================================
# 위험 통계 스키마 테스트
# =============================================================================

class TestRiskStatisticsSchemas:
    """위험 통계 스키마 테스트"""

    def test_risk_distribution_schema(self):
        """위험 분포 스키마"""
        from app.schemas.risk import RiskDistribution

        data = RiskDistribution(
            high=5,
            medium=10,
            low=20,
            total=35,
        )
        assert data.total == 35

    def test_risk_matrix_data_schema(self):
        """위험 매트릭스 데이터 스키마"""
        from app.schemas.risk import RiskMatrixData

        data = RiskMatrixData(
            matrix=[
                [1, 2, 3],
                [2, 4, 6],
                [3, 6, 9],
            ],
            labels={
                "impact": ["하", "중", "상"],
                "likelihood": ["하", "중", "상"],
            },
        )
        assert len(data.matrix) == 3

    def test_scenario_comparison_schema(self):
        """시나리오 비교 스키마"""
        from app.schemas.risk import ScenarioComparison

        data = ScenarioComparison(
            scenario1_id=1,
            scenario1_name="시나리오 1",
            scenario2_id=2,
            scenario2_name="시나리오 2",
            risk_count_diff=5,
            high_risk_diff=2,
            avg_risk_score_diff=1.5,
        )
        assert data.risk_count_diff == 5
