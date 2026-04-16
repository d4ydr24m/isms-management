"""
자산 변경 시 위험 영향 분석 서비스
Phase 2: 5.3 자산 변경 시 위험 영향 분석 구현

기능:
- 5.3.1 자산 가치 변경 시 관련 위험 재계산 트리거
- 5.3.2 자산 폐기 시 관련 위험 평가 상태 처리
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Dict, List, Optional, Any

from sqlalchemy.orm import Session

from app.models.asset import Asset, AssetValuation, AssetHistory, AssetDisposal
from app.models.risk import RiskAssessment, RiskScenario, RiskTreatmentPlan
from app.services.risk_calculation_service import RiskCalculationService


def utc_now() -> datetime:
    """UTC 현재 시간 반환"""
    return datetime.now(timezone.utc)


@dataclass
class AssessmentImpact:
    """개별 위험 평가 영향 정보"""
    assessment_id: int
    before_dor: int
    after_dor: int
    before_level: str
    after_level: str
    level_changed: bool


@dataclass
class ValuationChangeImpact:
    """자산 가치 변경 영향 분석 결과"""
    asset_id: int
    asset_name: str
    current_importance: int
    new_importance: int
    affected_assessments: List[Dict[str, Any]] = field(default_factory=list)
    grade_change_stats: Dict[str, int] = field(default_factory=dict)

    def __post_init__(self):
        if not self.grade_change_stats:
            self.grade_change_stats = {
                "upgraded": 0,
                "downgraded": 0,
                "unchanged": 0,
            }


@dataclass
class ScenarioImpact:
    """시나리오 영향 정보"""
    scenario_id: int
    scenario_name: str
    assessment_count: int


@dataclass
class DisposalImpact:
    """자산 폐기 영향 분석 결과"""
    asset_id: int
    asset_name: str
    affected_assessments: List[Dict[str, Any]] = field(default_factory=list)
    affected_scenarios: List[Dict[str, Any]] = field(default_factory=list)
    has_active_treatments: bool = False
    can_safely_dispose: bool = True
    warnings: List[str] = field(default_factory=list)


class AssetImpactService:
    """
    자산 변경 시 위험 영향 분석 서비스

    주요 기능:
    - 자산 가치 변경 영향 분석 및 적용
    - 자산 폐기 영향 분석 및 처리

    사용 예시:
        >>> service = AssetImpactService(db)
        >>> impact = service.analyze_valuation_change_impact(asset_id=1, new_valuation={...})
        >>> result = service.apply_valuation_change(asset_id=1, new_valuation={...}, user_id=1)
    """

    def __init__(self, db: Session):
        """
        서비스 초기화

        Args:
            db: SQLAlchemy 세션
        """
        self.db = db
        self.risk_calc_service = RiskCalculationService(db)

    # =========================================================================
    # 5.3.1 자산 가치 변경 영향 분석
    # =========================================================================

    def analyze_valuation_change_impact(
        self,
        asset_id: int,
        new_valuation: Dict[str, int]
    ) -> ValuationChangeImpact:
        """
        자산 가치 변경 영향 분석

        Args:
            asset_id: 자산 ID
            new_valuation: 새로운 CIA 평가 값
                - confidentiality: 기밀성 (1-3)
                - integrity: 무결성 (1-3)
                - availability: 가용성 (1-3)

        Returns:
            ValuationChangeImpact: 변경 영향 분석 결과

        Raises:
            ValueError: 자산을 찾을 수 없거나 CIA 값이 유효하지 않은 경우
        """
        asset = self._get_asset_or_raise(asset_id)
        self._validate_cia_values(new_valuation)

        # 새 중요도 계산 (C+I+A 합산 방식)
        score = (
            new_valuation.get("confidentiality", 1)
            + new_valuation.get("integrity", 1)
            + new_valuation.get("availability", 1)
        )
        new_importance = 3 if score >= 8 else (2 if score >= 6 else 1)

        # 현재 중요도 조회
        current_importance = self._get_current_importance(asset_id)

        # 관련 위험 평가 조회
        assessments = self._get_risk_assessments_for_asset(asset_id)

        # 영향 분석
        affected_assessments = []
        grade_stats = {"upgraded": 0, "downgraded": 0, "unchanged": 0}

        for assessment in assessments:
            impact = self._calculate_assessment_impact(
                assessment,
                current_importance,
                new_importance
            )
            affected_assessments.append(impact)

            # 등급 변화 통계
            if impact["after_level"] != impact["before_level"]:
                level_order = {"low": 1, "medium": 2, "high": 3}
                if level_order.get(impact["after_level"], 0) > level_order.get(impact["before_level"], 0):
                    grade_stats["upgraded"] += 1
                else:
                    grade_stats["downgraded"] += 1
            else:
                grade_stats["unchanged"] += 1

        return ValuationChangeImpact(
            asset_id=asset_id,
            asset_name=asset.name,
            current_importance=current_importance,
            new_importance=new_importance,
            affected_assessments=affected_assessments,
            grade_change_stats=grade_stats,
        )

    def apply_valuation_change(
        self,
        asset_id: int,
        new_valuation: Dict[str, int],
        user_id: int,
        auto_recalculate: bool = True
    ) -> Dict[str, Any]:
        """
        자산 가치 변경 적용

        Args:
            asset_id: 자산 ID
            new_valuation: 새로운 CIA 평가 값
            user_id: 변경자 ID
            auto_recalculate: 관련 위험 자동 재계산 여부 (기본: True)

        Returns:
            변경 적용 결과 딕셔너리

        Raises:
            ValueError: 자산을 찾을 수 없거나 CIA 값이 유효하지 않은 경우
        """
        asset = self._get_asset_or_raise(asset_id)
        self._validate_cia_values(new_valuation)

        # 새 중요도 계산 (C+I+A 합산 방식)
        score = (
            new_valuation.get("confidentiality", 1)
            + new_valuation.get("integrity", 1)
            + new_valuation.get("availability", 1)
        )
        new_importance = 3 if score >= 8 else (2 if score >= 6 else 1)

        # 기존 가치 평가 조회
        current_valuation = self._get_latest_valuation(asset_id)
        old_importance = self._get_current_importance(asset_id)

        # 가치 평가 업데이트 또는 생성
        if current_valuation:
            old_values = {
                "confidentiality": current_valuation.confidentiality,
                "integrity": current_valuation.integrity,
                "availability": current_valuation.availability,
            }
            current_valuation.confidentiality = new_valuation.get("confidentiality", 1)
            current_valuation.integrity = new_valuation.get("integrity", 1)
            current_valuation.availability = new_valuation.get("availability", 1)
            current_valuation.evaluated_by = user_id
            current_valuation.evaluated_at = utc_now()
        else:
            old_values = {"confidentiality": 1, "integrity": 1, "availability": 1}
            new_val = AssetValuation(
                asset_id=asset_id,
                confidentiality=new_valuation.get("confidentiality", 1),
                integrity=new_valuation.get("integrity", 1),
                availability=new_valuation.get("availability", 1),
                evaluated_by=user_id,
                evaluated_at=utc_now(),
            )
            self.db.add(new_val)

        # 변경 이력 기록
        self._create_valuation_history(
            asset_id=asset_id,
            old_values=old_values,
            new_values=new_valuation,
            user_id=user_id
        )

        self.db.flush()

        # 관련 위험 평가 재계산
        risks_recalculated = 0
        if auto_recalculate:
            risks_recalculated = self._recalculate_related_risks(
                asset_id=asset_id,
                new_importance=new_importance,
                user_id=user_id
            )

        self.db.commit()

        return {
            "success": True,
            "valuation_updated": True,
            "old_importance": old_importance,
            "new_importance": new_importance,
            "risks_recalculated": risks_recalculated,
        }

    # =========================================================================
    # 5.3.2 자산 폐기 영향 분석 및 처리
    # =========================================================================

    def analyze_disposal_impact(self, asset_id: int) -> DisposalImpact:
        """
        자산 폐기 영향 분석

        Args:
            asset_id: 자산 ID

        Returns:
            DisposalImpact: 폐기 영향 분석 결과

        Raises:
            ValueError: 자산을 찾을 수 없는 경우
        """
        asset = self._get_asset_or_raise(asset_id)

        # 관련 위험 평가 조회
        assessments = self._get_risk_assessments_for_asset(asset_id)

        # 영향 받는 평가 목록
        affected_assessments = [
            {
                "assessment_id": a.id,
                "scenario_id": a.scenario_id,
                "risk_score": a.risk_score,
                "risk_level": a.risk_level,
            }
            for a in assessments
        ]

        # 영향 받는 시나리오 집계
        scenario_counts: Dict[int, Dict] = {}
        for assessment in assessments:
            scenario_id = assessment.scenario_id
            if scenario_id not in scenario_counts:
                scenario = self.db.query(RiskScenario).filter(
                    RiskScenario.id == scenario_id
                ).first()
                scenario_counts[scenario_id] = {
                    "scenario_id": scenario_id,
                    "scenario_name": scenario.name if scenario else "Unknown",
                    "assessment_count": 0,
                }
            scenario_counts[scenario_id]["assessment_count"] += 1

        affected_scenarios = list(scenario_counts.values())

        # 진행 중인 처리 계획 확인
        has_active_treatments = self._has_active_treatment_plans(asset_id)

        # 경고 메시지 생성
        warnings = []
        can_safely_dispose = True

        if has_active_treatments:
            warnings.append("진행 중인 위험 처리 계획이 있습니다.")
            can_safely_dispose = False

        if len(affected_assessments) > 0:
            warnings.append(f"이 자산에 대해 {len(affected_assessments)}개의 위험 평가가 영향을 받습니다.")

        return DisposalImpact(
            asset_id=asset_id,
            asset_name=asset.name,
            affected_assessments=affected_assessments,
            affected_scenarios=affected_scenarios,
            has_active_treatments=has_active_treatments,
            can_safely_dispose=can_safely_dispose,
            warnings=warnings,
        )

    def process_asset_disposal(
        self,
        asset_id: int,
        disposal_reason: str,
        user_id: int
    ) -> Dict[str, Any]:
        """
        자산 폐기 처리

        Args:
            asset_id: 자산 ID
            disposal_reason: 폐기 사유
            user_id: 처리자 ID

        Returns:
            폐기 처리 결과 딕셔너리

        Raises:
            ValueError: 자산을 찾을 수 없거나 이미 폐기된 경우
        """
        asset = self._get_asset_or_raise(asset_id)

        # 이미 폐기된 자산 확인
        if asset.status == "폐기" or not asset.is_active:
            raise ValueError("이미 폐기된 자산입니다")

        # 자산 비활성화
        old_status = asset.status
        asset.status = "폐기"
        asset.is_active = False
        asset.disposal_date = date.today()

        # 폐기 기록 생성
        disposal_record = AssetDisposal(
            asset_id=asset_id,
            disposal_date=date.today(),
            disposal_reason=disposal_reason,
            approved_by=user_id,
            approved_at=utc_now(),
        )
        self.db.add(disposal_record)

        # 변경 이력 기록
        history = AssetHistory(
            asset_id=asset_id,
            change_type="delete",
            field_name="status",
            old_value=old_status,
            new_value=f"폐기 - {disposal_reason}",
            changed_by=user_id,
            changed_at=utc_now(),
            remarks=f"자산 폐기: {disposal_reason}",
        )
        self.db.add(history)

        # 관련 위험 평가 상태 업데이트
        # RiskAssessment에 status 필드가 없으므로 remarks에 폐기 표시
        assessments_updated = self._mark_assessments_as_obsolete(asset_id, user_id)

        self.db.commit()

        return {
            "success": True,
            "asset_deactivated": True,
            "assessments_updated": assessments_updated,
            "disposal_date": date.today().isoformat(),
        }

    # =========================================================================
    # 헬퍼 메서드
    # =========================================================================

    def _get_asset_or_raise(self, asset_id: int) -> Asset:
        """자산 조회 또는 예외 발생"""
        asset = self.db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다")
        return asset

    def _validate_cia_values(self, valuation: Dict[str, int]) -> None:
        """CIA 값 유효성 검증"""
        for key in ["confidentiality", "integrity", "availability"]:
            value = valuation.get(key)
            if value is not None and (value < 1 or value > 3):
                raise ValueError(f"CIA 값은 1-3 사이여야 합니다: {key}={value}")

    def _get_current_importance(self, asset_id: int) -> int:
        """현재 자산 중요도 조회"""
        valuation = self._get_latest_valuation(asset_id)
        if valuation and valuation.importance_level:
            return valuation.importance_level
        elif valuation:
            return max(
                valuation.confidentiality or 1,
                valuation.integrity or 1,
                valuation.availability or 1
            )
        return 1  # 기본값

    def _get_latest_valuation(self, asset_id: int) -> Optional[AssetValuation]:
        """최신 가치 평가 조회"""
        return (
            self.db.query(AssetValuation)
            .filter(AssetValuation.asset_id == asset_id)
            .order_by(AssetValuation.id.desc())
            .first()
        )

    def _get_risk_assessments_for_asset(self, asset_id: int) -> List[RiskAssessment]:
        """자산에 연결된 위험 평가 목록 조회"""
        return (
            self.db.query(RiskAssessment)
            .filter(RiskAssessment.asset_id == asset_id)
            .all()
        )

    def _calculate_assessment_impact(
        self,
        assessment: RiskAssessment,
        current_importance: int,
        new_importance: int
    ) -> Dict[str, Any]:
        """개별 위험 평가 영향 계산"""
        # 현재 DoR
        before_dor = assessment.risk_score or (
            assessment.asset_value * assessment.threat_level * assessment.vulnerability_level
        )
        before_level = assessment.risk_level or self.risk_calc_service.classify_risk_level(before_dor)

        # 새 DoR (자산 가치를 새 중요도로 대체)
        after_dor = new_importance * assessment.threat_level * assessment.vulnerability_level
        after_level = self.risk_calc_service.classify_risk_level(after_dor)

        return {
            "assessment_id": assessment.id,
            "scenario_id": assessment.scenario_id,
            "before_dor": before_dor,
            "after_dor": after_dor,
            "before_level": before_level,
            "after_level": after_level,
            "level_changed": before_level != after_level,
        }

    def _create_valuation_history(
        self,
        asset_id: int,
        old_values: Dict[str, int],
        new_values: Dict[str, int],
        user_id: int
    ) -> None:
        """가치 평가 변경 이력 생성"""
        history = AssetHistory(
            asset_id=asset_id,
            change_type="valuation",
            field_name="CIA",
            old_value=f"C:{old_values['confidentiality']}, I:{old_values['integrity']}, A:{old_values['availability']}",
            new_value=f"C:{new_values.get('confidentiality', 1)}, I:{new_values.get('integrity', 1)}, A:{new_values.get('availability', 1)}",
            changed_by=user_id,
            changed_at=utc_now(),
            remarks="자산 가치 평가 변경",
        )
        self.db.add(history)

    def _recalculate_related_risks(
        self,
        asset_id: int,
        new_importance: int,
        user_id: int
    ) -> int:
        """관련 위험 평가 재계산"""
        assessments = self._get_risk_assessments_for_asset(asset_id)
        count = 0

        for assessment in assessments:
            # 자산 가치 업데이트
            assessment.asset_value = new_importance
            # DoR 및 등급 재계산
            assessment.risk_score = (
                new_importance * assessment.threat_level * assessment.vulnerability_level
            )
            assessment.risk_level = self.risk_calc_service.classify_risk_level(
                assessment.risk_score
            )
            assessment.evaluated_at = utc_now()
            if user_id:
                assessment.evaluated_by = user_id
            count += 1

        self.db.flush()
        return count

    def _has_active_treatment_plans(self, asset_id: int) -> bool:
        """진행 중인 위험 처리 계획 존재 여부 확인"""
        # 자산에 연결된 위험 평가의 처리 계획 조회
        assessments = self._get_risk_assessments_for_asset(asset_id)
        assessment_ids = [a.id for a in assessments]

        if not assessment_ids:
            return False

        active_plans = (
            self.db.query(RiskTreatmentPlan)
            .filter(
                RiskTreatmentPlan.risk_assessment_id.in_(assessment_ids),
                RiskTreatmentPlan.status.in_(["planned", "in_progress"])
            )
            .count()
        )

        return active_plans > 0

    def _mark_assessments_as_obsolete(self, asset_id: int, user_id: int) -> int:
        """위험 평가를 폐기 상태로 표시"""
        assessments = self._get_risk_assessments_for_asset(asset_id)
        count = 0

        for assessment in assessments:
            # RiskAssessment에 status 필드가 없으므로 remarks에 폐기 표시
            current_remarks = assessment.remarks or ""
            assessment.remarks = f"[폐기됨 - {date.today().isoformat()}] {current_remarks}".strip()
            assessment.evaluated_at = utc_now()
            if user_id:
                assessment.evaluated_by = user_id
            count += 1

        self.db.flush()
        return count
