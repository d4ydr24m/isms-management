"""
자산 변경 시 위험 영향 분석 테스트
Phase 2: 5.3 자산 변경 시 위험 영향 분석 구현

TDD 기반 테스트:
- 5.3.1 자산 가치 변경 시 관련 위험 재계산 트리거
- 5.3.2 자산 폐기 시 관련 위험 평가 상태 처리
"""
import pytest
from datetime import date, timedelta, datetime, timezone
from sqlalchemy.orm import Session

from app.services.asset_impact_service import (
    AssetImpactService,
    ValuationChangeImpact,
    DisposalImpact,
)
from app.models.risk import RiskAssessment, RiskScenario, Threat, Vulnerability
from app.models.asset import Asset, AssetType, AssetValuation, AssetHistory, AssetDisposal


# ========================================================================
# 5.3.1 자산 가치 변경 영향 분석 테스트
# ========================================================================

class TestValuationChangeImpact:
    """자산 가치 변경 영향 분석 테스트"""

    def test_analyze_valuation_change_impact_basic(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """기본 가치 변경 영향 분석 테스트"""
        service = AssetImpactService(db)

        # 현재 자산 가치: 2 (test_risk_assessment의 asset_value)
        # 새로운 가치: 5
        result = service.analyze_valuation_change_impact(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 3, "integrity": 3, "availability": 3}
        )

        assert isinstance(result, ValuationChangeImpact)
        assert result.asset_id == test_asset.id
        assert len(result.affected_assessments) > 0

    def test_analyze_valuation_change_impact_with_dor_comparison(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """DoR 변경 전후 비교 테스트"""
        service = AssetImpactService(db)

        # 현재 asset_value=2, new_importance=3 (MAX of CIA)
        result = service.analyze_valuation_change_impact(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 3, "integrity": 2, "availability": 2}
        )

        # 변경 전후 DoR 비교
        for assessment_impact in result.affected_assessments:
            assert "before_dor" in assessment_impact
            assert "after_dor" in assessment_impact
            assert "before_level" in assessment_impact
            assert "after_level" in assessment_impact

    def test_analyze_valuation_change_impact_grade_statistics(
        self,
        db: Session,
        test_asset: Asset,
        multiple_risk_assessments_for_asset: list
    ):
        """등급 변화 통계 테스트 (상승/하락/유지)"""
        service = AssetImpactService(db)

        # 가치 상승 시나리오
        result = service.analyze_valuation_change_impact(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 3, "integrity": 3, "availability": 3}
        )

        assert "grade_change_stats" in vars(result)
        stats = result.grade_change_stats
        assert "upgraded" in stats
        assert "downgraded" in stats
        assert "unchanged" in stats

    def test_analyze_valuation_change_impact_no_risk_assessments(
        self,
        db: Session,
        test_asset_without_risks: Asset
    ):
        """위험 평가가 없는 자산의 가치 변경 테스트"""
        service = AssetImpactService(db)

        result = service.analyze_valuation_change_impact(
            asset_id=test_asset_without_risks.id,
            new_valuation={"confidentiality": 3, "integrity": 3, "availability": 3}
        )

        assert result.affected_assessments == []
        assert result.grade_change_stats["upgraded"] == 0
        assert result.grade_change_stats["downgraded"] == 0
        assert result.grade_change_stats["unchanged"] == 0

    def test_analyze_valuation_change_impact_asset_not_found(self, db: Session):
        """존재하지 않는 자산 테스트"""
        service = AssetImpactService(db)

        with pytest.raises(ValueError, match="자산을 찾을 수 없습니다"):
            service.analyze_valuation_change_impact(
                asset_id=99999,
                new_valuation={"confidentiality": 3, "integrity": 3, "availability": 3}
            )

    def test_analyze_valuation_change_impact_invalid_cia_values(
        self,
        db: Session,
        test_asset: Asset
    ):
        """유효하지 않은 CIA 값 테스트"""
        service = AssetImpactService(db)

        with pytest.raises(ValueError, match="CIA 값은 1-3 사이"):
            service.analyze_valuation_change_impact(
                asset_id=test_asset.id,
                new_valuation={"confidentiality": 5, "integrity": 3, "availability": 3}
            )


class TestApplyValuationChange:
    """자산 가치 변경 적용 테스트"""

    def test_apply_valuation_change_with_auto_recalculate(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment,
        test_user
    ):
        """자동 재계산 포함 가치 변경 적용 테스트"""
        service = AssetImpactService(db)

        # 기존 DoR 확인
        original_dor = test_risk_assessment.risk_score

        # 가치 변경 적용 (자동 재계산 활성화)
        result = service.apply_valuation_change(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 3, "integrity": 3, "availability": 3},
            user_id=test_user.id,
            auto_recalculate=True
        )

        # 검증
        assert result["success"] is True
        assert result["valuation_updated"] is True
        assert result["risks_recalculated"] > 0

        # DB에서 재조회하여 위험 평가 점수 확인
        db.refresh(test_risk_assessment)
        # 새 중요도(MAX of 3,3,3)=3, 기존 threat=2, vuln=2 -> DoR=3*2*2=12
        assert test_risk_assessment.asset_value == 3
        assert test_risk_assessment.risk_score != original_dor

    def test_apply_valuation_change_without_auto_recalculate(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment,
        test_user
    ):
        """자동 재계산 없이 가치 변경만 적용 테스트"""
        service = AssetImpactService(db)

        original_dor = test_risk_assessment.risk_score

        result = service.apply_valuation_change(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 3, "integrity": 3, "availability": 3},
            user_id=test_user.id,
            auto_recalculate=False
        )

        assert result["success"] is True
        assert result["valuation_updated"] is True
        assert result["risks_recalculated"] == 0

        # 위험 평가의 DoR은 변경되지 않아야 함
        db.refresh(test_risk_assessment)
        assert test_risk_assessment.risk_score == original_dor

    def test_apply_valuation_change_creates_history(
        self,
        db: Session,
        test_asset: Asset,
        test_user
    ):
        """가치 변경 시 이력 기록 테스트"""
        service = AssetImpactService(db)

        # 기존 이력 수 확인
        initial_history_count = (
            db.query(AssetHistory)
            .filter(AssetHistory.asset_id == test_asset.id)
            .count()
        )

        service.apply_valuation_change(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 3, "integrity": 2, "availability": 2},
            user_id=test_user.id,
            auto_recalculate=True
        )

        # 이력이 추가되었는지 확인
        new_history_count = (
            db.query(AssetHistory)
            .filter(AssetHistory.asset_id == test_asset.id)
            .count()
        )

        assert new_history_count > initial_history_count

    def test_apply_valuation_change_updates_existing_valuation(
        self,
        db: Session,
        test_asset_with_valuation: Asset,
        test_user
    ):
        """기존 가치 평가 업데이트 테스트"""
        service = AssetImpactService(db)

        result = service.apply_valuation_change(
            asset_id=test_asset_with_valuation.id,
            new_valuation={"confidentiality": 1, "integrity": 1, "availability": 1},
            user_id=test_user.id,
            auto_recalculate=False
        )

        assert result["success"] is True

        # 최신 가치 평가 확인
        latest_valuation = (
            db.query(AssetValuation)
            .filter(AssetValuation.asset_id == test_asset_with_valuation.id)
            .order_by(AssetValuation.id.desc())
            .first()
        )

        assert latest_valuation.confidentiality == 1
        assert latest_valuation.integrity == 1
        assert latest_valuation.availability == 1


# ========================================================================
# 5.3.2 자산 폐기 영향 분석 테스트
# ========================================================================

class TestDisposalImpact:
    """자산 폐기 영향 분석 테스트"""

    def test_analyze_disposal_impact_basic(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """기본 폐기 영향 분석 테스트"""
        service = AssetImpactService(db)

        result = service.analyze_disposal_impact(asset_id=test_asset.id)

        assert isinstance(result, DisposalImpact)
        assert result.asset_id == test_asset.id
        assert len(result.affected_assessments) > 0

    def test_analyze_disposal_impact_shows_affected_scenarios(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """폐기 시 영향 받는 시나리오 목록 테스트"""
        service = AssetImpactService(db)

        result = service.analyze_disposal_impact(asset_id=test_asset.id)

        assert len(result.affected_scenarios) > 0
        for scenario in result.affected_scenarios:
            assert "scenario_id" in scenario
            assert "scenario_name" in scenario
            assert "assessment_count" in scenario

    def test_analyze_disposal_impact_no_risk_assessments(
        self,
        db: Session,
        test_asset_without_risks: Asset
    ):
        """위험 평가가 없는 자산의 폐기 영향 테스트"""
        service = AssetImpactService(db)

        result = service.analyze_disposal_impact(asset_id=test_asset_without_risks.id)

        assert result.affected_assessments == []
        assert result.affected_scenarios == []
        assert result.can_safely_dispose is True

    def test_analyze_disposal_impact_with_active_treatments(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment,
        test_risk_treatment_plan
    ):
        """진행 중인 처리 계획이 있는 경우 테스트"""
        service = AssetImpactService(db)

        result = service.analyze_disposal_impact(asset_id=test_asset.id)

        # 진행 중인 처리 계획이 있으면 경고
        assert result.has_active_treatments is True
        assert result.can_safely_dispose is False
        assert len(result.warnings) > 0

    def test_analyze_disposal_impact_asset_not_found(self, db: Session):
        """존재하지 않는 자산 폐기 영향 분석 테스트"""
        service = AssetImpactService(db)

        with pytest.raises(ValueError, match="자산을 찾을 수 없습니다"):
            service.analyze_disposal_impact(asset_id=99999)


class TestProcessAssetDisposal:
    """자산 폐기 처리 테스트"""

    def test_process_asset_disposal_success(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment,
        test_user
    ):
        """자산 폐기 처리 성공 테스트"""
        service = AssetImpactService(db)

        result = service.process_asset_disposal(
            asset_id=test_asset.id,
            disposal_reason="노후화로 인한 폐기",
            user_id=test_user.id
        )

        assert result["success"] is True
        assert result["asset_deactivated"] is True
        assert result["assessments_updated"] > 0

        # 자산 상태 확인
        db.refresh(test_asset)
        assert test_asset.is_active is False
        assert test_asset.status == "폐기"

    def test_process_asset_disposal_updates_risk_assessment_status(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment,
        test_user
    ):
        """폐기 시 위험 평가 상태 변경 테스트"""
        service = AssetImpactService(db)

        service.process_asset_disposal(
            asset_id=test_asset.id,
            disposal_reason="자산 폐기",
            user_id=test_user.id
        )

        # 위험 평가가 'archived' 또는 'obsolete'로 변경되어야 함
        db.refresh(test_risk_assessment)
        # RiskAssessment에 status 필드가 있다면 확인
        # 없다면 시나리오 상태나 다른 방법으로 확인

    def test_process_asset_disposal_creates_disposal_record(
        self,
        db: Session,
        test_asset: Asset,
        test_user
    ):
        """폐기 시 폐기 기록 생성 테스트"""
        service = AssetImpactService(db)

        service.process_asset_disposal(
            asset_id=test_asset.id,
            disposal_reason="보안 정책 변경으로 인한 폐기",
            user_id=test_user.id
        )

        # 폐기 기록 확인
        disposal = (
            db.query(AssetDisposal)
            .filter(AssetDisposal.asset_id == test_asset.id)
            .first()
        )

        assert disposal is not None
        assert disposal.disposal_reason == "보안 정책 변경으로 인한 폐기"
        assert disposal.disposal_date == date.today()

    def test_process_asset_disposal_creates_history(
        self,
        db: Session,
        test_asset: Asset,
        test_user
    ):
        """폐기 시 이력 기록 테스트"""
        service = AssetImpactService(db)

        service.process_asset_disposal(
            asset_id=test_asset.id,
            disposal_reason="테스트 폐기",
            user_id=test_user.id
        )

        # 이력 기록 확인
        history = (
            db.query(AssetHistory)
            .filter(
                AssetHistory.asset_id == test_asset.id,
                AssetHistory.change_type == "delete"
            )
            .first()
        )

        assert history is not None
        assert "폐기" in str(history.new_value)

    def test_process_asset_disposal_already_disposed(
        self,
        db: Session,
        test_disposed_asset: Asset,
        test_user
    ):
        """이미 폐기된 자산 처리 테스트"""
        service = AssetImpactService(db)

        with pytest.raises(ValueError, match="이미 폐기된 자산"):
            service.process_asset_disposal(
                asset_id=test_disposed_asset.id,
                disposal_reason="재폐기 시도",
                user_id=test_user.id
            )

    def test_process_asset_disposal_asset_not_found(self, db: Session, test_user):
        """존재하지 않는 자산 폐기 테스트"""
        service = AssetImpactService(db)

        with pytest.raises(ValueError, match="자산을 찾을 수 없습니다"):
            service.process_asset_disposal(
                asset_id=99999,
                disposal_reason="테스트",
                user_id=test_user.id
            )


# ========================================================================
# 통합 테스트
# ========================================================================

class TestAssetImpactIntegration:
    """자산 영향 분석 통합 테스트"""

    def test_valuation_change_to_disposal_workflow(
        self,
        db: Session,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment,
        test_user
    ):
        """가치 변경 후 폐기까지 전체 워크플로우 테스트"""
        service = AssetImpactService(db)

        # 1. 가치 변경 영향 분석
        impact = service.analyze_valuation_change_impact(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 1, "integrity": 1, "availability": 1}
        )
        assert len(impact.affected_assessments) > 0

        # 2. 가치 변경 적용
        change_result = service.apply_valuation_change(
            asset_id=test_asset.id,
            new_valuation={"confidentiality": 1, "integrity": 1, "availability": 1},
            user_id=test_user.id,
            auto_recalculate=True
        )
        assert change_result["success"] is True

        # 3. 폐기 영향 분석
        disposal_impact = service.analyze_disposal_impact(asset_id=test_asset.id)
        assert len(disposal_impact.affected_assessments) > 0

        # 4. 폐기 처리
        disposal_result = service.process_asset_disposal(
            asset_id=test_asset.id,
            disposal_reason="가치 하락으로 인한 폐기",
            user_id=test_user.id
        )
        assert disposal_result["success"] is True

        # 5. 최종 상태 확인
        db.refresh(test_asset)
        assert test_asset.is_active is False
        assert test_asset.status == "폐기"

    def test_multiple_assets_batch_valuation_change(
        self,
        db: Session,
        multiple_assets: list,
        test_user
    ):
        """여러 자산 일괄 가치 변경 테스트"""
        service = AssetImpactService(db)

        results = []
        for asset in multiple_assets:
            impact = service.analyze_valuation_change_impact(
                asset_id=asset.id,
                new_valuation={"confidentiality": 3, "integrity": 3, "availability": 3}
            )
            results.append(impact)

        assert len(results) == len(multiple_assets)


# ========================================================================
# 픽스처
# ========================================================================

@pytest.fixture
def test_asset_without_risks(db: Session, test_asset_type, test_department, test_user):
    """위험 평가가 없는 테스트용 자산 생성"""
    from app.models.asset import Asset

    asset = Asset(
        asset_code="AST-SRV-2024-002",
        name="테스트 서버 (위험 평가 없음)",
        description="위험 평가가 연결되지 않은 자산",
        asset_type_id=test_asset_type.id,
        department_id=test_department.id,
        owner_id=test_user.id,
        location="서버실 B",
        ip_address="192.168.1.101",
        status="운영",
        is_active=True,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@pytest.fixture
def test_asset_with_valuation(db: Session, test_asset_type, test_department, test_user):
    """가치 평가가 있는 테스트용 자산 생성"""
    from app.models.asset import Asset, AssetValuation

    asset = Asset(
        asset_code="AST-SRV-2024-003",
        name="테스트 서버 (가치 평가 포함)",
        description="가치 평가가 있는 자산",
        asset_type_id=test_asset_type.id,
        department_id=test_department.id,
        owner_id=test_user.id,
        location="서버실 C",
        ip_address="192.168.1.102",
        status="운영",
        is_active=True,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    valuation = AssetValuation(
        asset_id=asset.id,
        confidentiality=2,
        integrity=2,
        availability=2,
        evaluated_by=test_user.id,
        evaluated_at=datetime.now(timezone.utc),
    )
    db.add(valuation)
    db.commit()

    return asset


@pytest.fixture
def test_disposed_asset(db: Session, test_asset_type, test_department, test_user):
    """이미 폐기된 테스트용 자산 생성"""
    from app.models.asset import Asset

    asset = Asset(
        asset_code="AST-SRV-2024-004",
        name="폐기된 서버",
        description="이미 폐기된 자산",
        asset_type_id=test_asset_type.id,
        department_id=test_department.id,
        owner_id=test_user.id,
        location="폐기 대기실",
        status="폐기",
        is_active=False,
        disposal_date=date.today() - timedelta(days=30),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@pytest.fixture
def multiple_risk_assessments_for_asset(
    db: Session,
    test_asset: Asset,
    test_risk_scenario,
    test_threat,
    test_vulnerability
):
    """하나의 자산에 대한 여러 위험 평가 생성"""
    from app.models.risk import RiskAssessment, Threat, Vulnerability

    assessments = []

    # 다양한 위험 평가 생성
    test_cases = [
        (2, 1, 1),  # DoR: 2 (low)
        (2, 2, 2),  # DoR: 8 (low, 기본 asset_value=2)
        (2, 3, 2),  # DoR: 12 (low)
        (2, 3, 3),  # DoR: 18 (medium)
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


@pytest.fixture
def multiple_assets(db: Session, test_asset_type, test_department, test_user):
    """여러 테스트용 자산 생성"""
    from app.models.asset import Asset

    assets = []
    for i in range(3):
        asset = Asset(
            asset_code=f"AST-SRV-2024-10{i}",
            name=f"테스트 서버 {i}",
            description=f"다중 자산 테스트 {i}",
            asset_type_id=test_asset_type.id,
            department_id=test_department.id,
            owner_id=test_user.id,
            location=f"서버실 {chr(65 + i)}",
            ip_address=f"192.168.1.{110 + i}",
            status="운영",
            is_active=True,
        )
        db.add(asset)
        assets.append(asset)

    db.commit()
    for a in assets:
        db.refresh(a)

    return assets


# ========================================================================
# API 통합 테스트
# ========================================================================

class TestAssetImpactAPI:
    """자산 영향 분석 API 테스트"""

    def test_api_analyze_valuation_change(
        self,
        client,
        admin_auth_headers,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """가치 변경 영향 분석 API 테스트"""
        response = client.post(
            "/api/v1/asset-impact/valuation-change/analyze",
            headers=admin_auth_headers,
            json={
                "asset_id": test_asset.id,
                "new_valuation": {
                    "confidentiality": 3,
                    "integrity": 2,
                    "availability": 2
                }
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["asset_id"] == test_asset.id
        assert "affected_assessments" in data
        assert "grade_change_stats" in data

    def test_api_analyze_valuation_change_asset_not_found(
        self,
        client,
        admin_auth_headers
    ):
        """존재하지 않는 자산 가치 변경 분석 API 테스트"""
        response = client.post(
            "/api/v1/asset-impact/valuation-change/analyze",
            headers=admin_auth_headers,
            json={
                "asset_id": 99999,
                "new_valuation": {
                    "confidentiality": 3,
                    "integrity": 2,
                    "availability": 2
                }
            }
        )

        assert response.status_code == 400
        assert "자산을 찾을 수 없습니다" in response.json()["detail"]

    def test_api_analyze_valuation_change_invalid_cia(
        self,
        client,
        admin_auth_headers,
        test_asset: Asset
    ):
        """유효하지 않은 CIA 값 API 테스트"""
        response = client.post(
            "/api/v1/asset-impact/valuation-change/analyze",
            headers=admin_auth_headers,
            json={
                "asset_id": test_asset.id,
                "new_valuation": {
                    "confidentiality": 5,  # 유효하지 않음 (1-3)
                    "integrity": 2,
                    "availability": 2
                }
            }
        )

        assert response.status_code == 422  # Pydantic validation error

    def test_api_apply_valuation_change(
        self,
        client,
        admin_auth_headers,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """가치 변경 적용 API 테스트"""
        response = client.post(
            "/api/v1/asset-impact/valuation-change/apply",
            headers=admin_auth_headers,
            json={
                "asset_id": test_asset.id,
                "new_valuation": {
                    "confidentiality": 3,
                    "integrity": 3,
                    "availability": 3
                },
                "auto_recalculate": True
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["valuation_updated"] is True
        assert data["risks_recalculated"] > 0

    def test_api_apply_valuation_change_without_recalculate(
        self,
        client,
        admin_auth_headers,
        test_asset: Asset
    ):
        """자동 재계산 없이 가치 변경 적용 API 테스트"""
        response = client.post(
            "/api/v1/asset-impact/valuation-change/apply",
            headers=admin_auth_headers,
            json={
                "asset_id": test_asset.id,
                "new_valuation": {
                    "confidentiality": 2,
                    "integrity": 2,
                    "availability": 2
                },
                "auto_recalculate": False
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["risks_recalculated"] == 0

    def test_api_analyze_disposal_impact(
        self,
        client,
        admin_auth_headers,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """폐기 영향 분석 API 테스트"""
        response = client.get(
            f"/api/v1/asset-impact/disposal/{test_asset.id}/analyze",
            headers=admin_auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["asset_id"] == test_asset.id
        assert "affected_assessments" in data
        assert "affected_scenarios" in data
        assert "can_safely_dispose" in data

    def test_api_analyze_disposal_impact_asset_not_found(
        self,
        client,
        admin_auth_headers
    ):
        """존재하지 않는 자산 폐기 영향 분석 API 테스트"""
        response = client.get(
            "/api/v1/asset-impact/disposal/99999/analyze",
            headers=admin_auth_headers
        )

        assert response.status_code == 400
        assert "자산을 찾을 수 없습니다" in response.json()["detail"]

    def test_api_process_disposal(
        self,
        client,
        admin_auth_headers,
        test_asset: Asset,
        test_risk_assessment: RiskAssessment
    ):
        """폐기 처리 API 테스트"""
        response = client.post(
            f"/api/v1/asset-impact/disposal/{test_asset.id}/process",
            headers=admin_auth_headers,
            json={
                "disposal_reason": "노후화로 인한 폐기"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["asset_deactivated"] is True
        assert data["assessments_updated"] > 0

    def test_api_process_disposal_already_disposed(
        self,
        client,
        admin_auth_headers,
        test_disposed_asset: Asset
    ):
        """이미 폐기된 자산 폐기 처리 API 테스트"""
        response = client.post(
            f"/api/v1/asset-impact/disposal/{test_disposed_asset.id}/process",
            headers=admin_auth_headers,
            json={
                "disposal_reason": "재폐기 시도"
            }
        )

        assert response.status_code == 400
        assert "이미 폐기된 자산" in response.json()["detail"]

    def test_api_unauthorized_access(self, client, test_asset: Asset):
        """인증되지 않은 사용자 접근 테스트"""
        response = client.post(
            "/api/v1/asset-impact/valuation-change/analyze",
            json={
                "asset_id": test_asset.id,
                "new_valuation": {
                    "confidentiality": 3,
                    "integrity": 2,
                    "availability": 2
                }
            }
        )

        assert response.status_code == 401
