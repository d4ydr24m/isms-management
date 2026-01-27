"""
위험도 자동 계산 엔진 서비스
Phase 2: 5.2 위험도 자동 계산 엔진 구현

기능:
- 5.2.1 DoR 계산 공식 구현 (자산가치 x 위협등급 x 취약점등급)
- 5.2.2 위험 등급 자동 분류 (상/중/하 기준 설정)
- 5.2.3 배치 계산 기능 (시나리오 전체 재계산)
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import IntEnum
from typing import Dict, List, Optional, Union

from sqlalchemy import insert, update
from sqlalchemy.orm import Session

from app.models.risk import RiskAssessment, RiskScenario


def utc_now() -> datetime:
    """UTC 현재 시간 반환"""
    return datetime.now(timezone.utc)


class ThreatLevel(IntEnum):
    """
    위협 등급

    ISMS-P 위협 평가 기준:
    - LOW(1): 위협 발생 가능성 낮음
    - MEDIUM(2): 위협 발생 가능성 보통
    - HIGH(3): 위협 발생 가능성 높음
    """
    LOW = 1
    MEDIUM = 2
    HIGH = 3


class VulnerabilityLevel(IntEnum):
    """
    취약점 등급

    ISMS-P 취약점 평가 기준:
    - LOW(1): 취약점 심각도 낮음
    - MEDIUM(2): 취약점 심각도 보통
    - HIGH(3): 취약점 심각도 높음
    """
    LOW = 1
    MEDIUM = 2
    HIGH = 3


# 위험 등급 문자열 상수
RISK_LEVEL_HIGH = "high"
RISK_LEVEL_MEDIUM = "medium"
RISK_LEVEL_LOW = "low"

# 입력 값 범위 상수
ASSET_VALUE_MIN = 1
ASSET_VALUE_MAX = 5
LEVEL_MIN = 1
LEVEL_MAX = 3


@dataclass
class RiskLevelThresholds:
    """
    위험 등급 분류 기준

    ISMS-P 위험 평가 기준에 따른 DoR 임계값 설정

    Attributes:
        high_threshold: 고위험 하한선 (이 값 이상이면 high)
        medium_threshold: 중위험 하한선 (이 값 이상이면 medium, high_threshold 미만)
    """
    high_threshold: int = 30
    medium_threshold: int = 15

    @property
    def low_max(self) -> int:
        """저위험 최대값 (medium_threshold - 1)"""
        return self.medium_threshold - 1

    def validate(self) -> None:
        """
        임계값 유효성 검증

        Raises:
            ValueError: 임계값이 유효하지 않은 경우
        """
        if self.high_threshold <= 0 or self.medium_threshold <= 0:
            raise ValueError("임계값은 양수여야 합니다")

        if self.high_threshold <= self.medium_threshold:
            raise ValueError("high_threshold는 medium_threshold보다 커야 합니다")


class RiskCalculationService:
    """
    위험도 자동 계산 엔진 서비스

    DoR (Degree of Risk) 계산 공식:
        DoR = 자산 중요도(1~5) x 위협 등급(1~3) x 취약점 등급(1~3)

    위험 등급 분류 (기본 기준):
        - 상(high): DoR >= 30
        - 중(medium): 15 <= DoR < 30
        - 하(low): DoR < 15

    사용 예시:
        >>> service = RiskCalculationService(db)
        >>> dor = service.calculate_dor(asset_value=4, threat_level=3, vulnerability_level=2)
        >>> level = service.classify_risk_level(dor)
    """

    # 기본 위험 등급 기준 (클래스 변수)
    _default_thresholds = RiskLevelThresholds()

    def __init__(self, db: Session):
        """
        서비스 초기화

        Args:
            db: SQLAlchemy 세션
        """
        self.db = db
        self._thresholds = RiskLevelThresholds(
            high_threshold=self._default_thresholds.high_threshold,
            medium_threshold=self._default_thresholds.medium_threshold
        )

    # =========================================================================
    # 5.2.1 DoR 계산 공식 구현
    # =========================================================================

    def calculate_dor(
        self,
        asset_value: Union[int, float],
        threat_level: Union[int, ThreatLevel, str],
        vulnerability_level: Union[int, VulnerabilityLevel, str]
    ) -> int:
        """
        DoR (위험도) 계산

        공식: DoR = 자산가치 x 위협등급 x 취약점등급

        Args:
            asset_value: 자산 중요도 (1-5)
            threat_level: 위협 등급 (1-3 또는 ThreatLevel 또는 "low"/"medium"/"high")
            vulnerability_level: 취약점 등급 (1-3 또는 VulnerabilityLevel 또는 "low"/"medium"/"high")

        Returns:
            DoR 점수 (최소 1, 최대 45)

        Raises:
            ValueError: 입력값이 유효하지 않은 경우
        """
        asset_val = self._validate_and_convert_asset_value(asset_value)
        threat_lvl = self._validate_and_convert_level(threat_level, "위협")
        vuln_lvl = self._validate_and_convert_level(vulnerability_level, "취약점")

        return asset_val * threat_lvl * vuln_lvl

    def _validate_and_convert_asset_value(self, value: Union[int, float, None]) -> int:
        """
        자산 가치 검증 및 변환

        Args:
            value: 자산 가치 (1-5)

        Returns:
            정수로 변환된 자산 가치

        Raises:
            ValueError: 유효하지 않은 값인 경우
        """
        if value is None:
            raise ValueError("자산 가치는 필수입니다")

        # 소수점인 경우 반올림
        if isinstance(value, float):
            value = round(value)

        if not isinstance(value, int):
            raise ValueError("자산 가치는 정수여야 합니다")

        if value < ASSET_VALUE_MIN or value > ASSET_VALUE_MAX:
            raise ValueError(f"자산 가치는 {ASSET_VALUE_MIN}-{ASSET_VALUE_MAX} 사이여야 합니다")

        return value

    def _validate_and_convert_level(
        self,
        value: Union[int, ThreatLevel, VulnerabilityLevel, str, None],
        level_type: str
    ) -> int:
        """
        등급 검증 및 변환

        Args:
            value: 등급 값
            level_type: 등급 유형 ("위협" 또는 "취약점")

        Returns:
            정수로 변환된 등급 (1-3)

        Raises:
            ValueError: 유효하지 않은 값인 경우
        """
        if value is None:
            raise ValueError(f"{level_type} 등급은 필수입니다")

        # 문자열인 경우 변환
        if isinstance(value, str):
            level_map = {
                RISK_LEVEL_LOW: LEVEL_MIN,
                RISK_LEVEL_MEDIUM: 2,
                RISK_LEVEL_HIGH: LEVEL_MAX
            }
            converted = level_map.get(value.lower())
            if converted is None:
                raise ValueError(
                    f"{level_type} 등급은 '{RISK_LEVEL_LOW}', "
                    f"'{RISK_LEVEL_MEDIUM}', '{RISK_LEVEL_HIGH}' 중 하나여야 합니다"
                )
            value = converted

        # IntEnum인 경우 int로 변환
        if isinstance(value, (ThreatLevel, VulnerabilityLevel)):
            value = int(value)

        if not isinstance(value, int):
            raise ValueError(f"{level_type} 등급은 정수여야 합니다")

        if value < LEVEL_MIN or value > LEVEL_MAX:
            raise ValueError(f"{level_type} 등급은 {LEVEL_MIN}-{LEVEL_MAX} 사이여야 합니다")

        return value

    # =========================================================================
    # 5.2.2 위험 등급 자동 분류
    # =========================================================================

    def classify_risk_level(self, dor_score: int) -> str:
        """
        DoR 점수에 따른 위험 등급 분류

        기본 기준:
            - 상(high): DoR >= 30
            - 중(medium): 15 <= DoR < 30
            - 하(low): DoR < 15

        Args:
            dor_score: DoR 점수

        Returns:
            위험 등급 ("high", "medium", "low")

        Raises:
            ValueError: DoR 점수가 음수인 경우
        """
        if dor_score < 0:
            raise ValueError("DoR 점수는 0 이상이어야 합니다")

        if dor_score >= self._thresholds.high_threshold:
            return RISK_LEVEL_HIGH
        elif dor_score >= self._thresholds.medium_threshold:
            return RISK_LEVEL_MEDIUM
        else:
            return RISK_LEVEL_LOW

    def get_risk_level_thresholds(self) -> RiskLevelThresholds:
        """
        현재 위험 등급 기준 조회

        Returns:
            RiskLevelThresholds 객체
        """
        return RiskLevelThresholds(
            high_threshold=self._thresholds.high_threshold,
            medium_threshold=self._thresholds.medium_threshold
        )

    def set_risk_level_thresholds(self, thresholds: RiskLevelThresholds) -> None:
        """
        위험 등급 기준 설정

        Args:
            thresholds: 새로운 기준값

        Raises:
            ValueError: 유효하지 않은 기준인 경우
        """
        thresholds.validate()
        self._thresholds = RiskLevelThresholds(
            high_threshold=thresholds.high_threshold,
            medium_threshold=thresholds.medium_threshold
        )

    # =========================================================================
    # 5.2.3 단일 위험 평가 재계산
    # =========================================================================

    def recalculate_risk_assessment(
        self,
        assessment_id: int,
        user_id: Optional[int] = None
    ) -> RiskAssessment:
        """
        단일 위험 평가 재계산

        모델 이벤트를 우회하여 서비스의 threshold 기준으로 계산합니다.

        Args:
            assessment_id: 위험 평가 ID
            user_id: 평가자 ID (선택)

        Returns:
            업데이트된 RiskAssessment 객체

        Raises:
            ValueError: 위험 평가를 찾을 수 없는 경우
        """
        assessment = self._get_assessment_or_raise(assessment_id)

        dor, risk_level = self._calculate_dor_and_level(
            assessment.asset_value,
            assessment.threat_level,
            assessment.vulnerability_level
        )

        self._update_assessment_directly(
            assessment_id=assessment_id,
            risk_score=dor,
            risk_level=risk_level,
            evaluated_by=user_id if user_id else assessment.evaluated_by
        )

        # 업데이트된 객체 다시 조회
        self.db.expire(assessment)
        self.db.refresh(assessment)

        return assessment

    def _get_assessment_or_raise(self, assessment_id: int) -> RiskAssessment:
        """위험 평가 조회 또는 예외 발생"""
        assessment = self.db.query(RiskAssessment).filter(
            RiskAssessment.id == assessment_id
        ).first()

        if not assessment:
            raise ValueError("위험 평가를 찾을 수 없습니다")

        return assessment

    def _calculate_dor_and_level(
        self,
        asset_value: int,
        threat_level: int,
        vulnerability_level: int
    ) -> tuple:
        """DoR 및 위험 등급 계산"""
        dor = self.calculate_dor(
            asset_value=asset_value,
            threat_level=threat_level,
            vulnerability_level=vulnerability_level
        )
        risk_level = self.classify_risk_level(dor)
        return dor, risk_level

    def _update_assessment_directly(
        self,
        assessment_id: int,
        risk_score: int,
        risk_level: str,
        evaluated_by: Optional[int] = None,
        evaluated_at: Optional[datetime] = None
    ) -> None:
        """
        위험 평가 직접 업데이트 (모델 이벤트 우회)

        모델 이벤트는 ORM 방식 업데이트 시에만 트리거되므로,
        직접 SQL UPDATE를 사용하여 서비스의 threshold 기준을 적용합니다.
        """
        if evaluated_at is None:
            evaluated_at = utc_now()

        stmt = (
            update(RiskAssessment)
            .where(RiskAssessment.id == assessment_id)
            .values(
                risk_score=risk_score,
                risk_level=risk_level,
                evaluated_at=evaluated_at,
                evaluated_by=evaluated_by
            )
        )
        self.db.execute(stmt)

    # =========================================================================
    # 5.2.3 배치 계산 기능 (시나리오 전체 재계산)
    # =========================================================================

    def batch_recalculate_scenario(self, scenario_id: int) -> Dict:
        """
        시나리오 전체 위험 평가 재계산

        Args:
            scenario_id: 시나리오 ID

        Returns:
            재계산 결과 요약 딕셔너리:
                - scenario_id: 시나리오 ID
                - total_recalculated: 재계산된 평가 수
                - success: 성공 여부
                - summary: 등급별 통계

        Raises:
            ValueError: 시나리오를 찾을 수 없는 경우
        """
        self._validate_scenario_exists(scenario_id)

        assessments = self._get_assessments_by_scenario(scenario_id)

        stats = self._initialize_stats()
        recalculated_count = 0
        evaluated_time = utc_now()

        for assessment in assessments:
            try:
                dor, risk_level = self._calculate_dor_and_level(
                    assessment.asset_value,
                    assessment.threat_level,
                    assessment.vulnerability_level
                )

                self._update_assessment_directly(
                    assessment_id=assessment.id,
                    risk_score=dor,
                    risk_level=risk_level,
                    evaluated_at=evaluated_time
                )

                self._update_stats(stats, risk_level)
                recalculated_count += 1

            except ValueError:
                # 개별 평가 계산 실패 시 건너뜀
                continue

        self.db.commit()

        return {
            "scenario_id": scenario_id,
            "total_recalculated": recalculated_count,
            "success": True,
            "summary": stats
        }

    def _validate_scenario_exists(self, scenario_id: int) -> None:
        """시나리오 존재 확인"""
        scenario = self.db.query(RiskScenario).filter(
            RiskScenario.id == scenario_id
        ).first()

        if not scenario:
            raise ValueError("시나리오를 찾을 수 없습니다")

    def _get_assessments_by_scenario(self, scenario_id: int) -> List[RiskAssessment]:
        """시나리오별 위험 평가 목록 조회"""
        return self.db.query(RiskAssessment).filter(
            RiskAssessment.scenario_id == scenario_id
        ).all()

    def _initialize_stats(self) -> Dict[str, int]:
        """통계 딕셔너리 초기화"""
        return {
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
            "total": 0
        }

    def _update_stats(self, stats: Dict[str, int], risk_level: str) -> None:
        """통계 업데이트"""
        if risk_level == RISK_LEVEL_HIGH:
            stats["high_count"] += 1
        elif risk_level == RISK_LEVEL_MEDIUM:
            stats["medium_count"] += 1
        else:
            stats["low_count"] += 1
        stats["total"] += 1

    # =========================================================================
    # 헬퍼 메서드: 위험 평가 생성 (계산 포함)
    # =========================================================================

    def create_risk_assessment_with_calculation(
        self,
        scenario_id: int,
        asset_id: int,
        threat_id: int,
        vulnerability_id: int,
        asset_value: int,
        threat_level: Union[int, ThreatLevel],
        vulnerability_level: Union[int, VulnerabilityLevel],
        user_id: int,
        remarks: Optional[str] = None
    ) -> RiskAssessment:
        """
        위험 평가 생성 및 DoR/등급 자동 계산

        모델 이벤트를 우회하여 서비스의 threshold 기준으로 계산합니다.

        Args:
            scenario_id: 시나리오 ID
            asset_id: 자산 ID
            threat_id: 위협 ID
            vulnerability_id: 취약점 ID
            asset_value: 자산 가치 (1-5)
            threat_level: 위협 등급 (1-3)
            vulnerability_level: 취약점 등급 (1-3)
            user_id: 평가자 ID
            remarks: 평가 의견 (선택)

        Returns:
            생성된 RiskAssessment 객체
        """
        threat_lvl = self._convert_to_int(threat_level)
        vuln_lvl = self._convert_to_int(vulnerability_level)

        dor, risk_level = self._calculate_dor_and_level(
            asset_value, threat_lvl, vuln_lvl
        )

        evaluated_time = utc_now()

        # 직접 SQL INSERT로 모델 이벤트 우회
        stmt = (
            insert(RiskAssessment)
            .values(
                scenario_id=scenario_id,
                asset_id=asset_id,
                threat_id=threat_id,
                vulnerability_id=vulnerability_id,
                asset_value=asset_value,
                threat_level=threat_lvl,
                vulnerability_level=vuln_lvl,
                risk_score=dor,
                risk_level=risk_level,
                evaluated_by=user_id,
                evaluated_at=evaluated_time,
                remarks=remarks
            )
        )
        self.db.execute(stmt)
        self.db.commit()

        # 생성된 객체 조회하여 반환
        return self.db.query(RiskAssessment).filter(
            RiskAssessment.scenario_id == scenario_id,
            RiskAssessment.asset_id == asset_id,
            RiskAssessment.threat_id == threat_id,
            RiskAssessment.vulnerability_id == vulnerability_id,
            RiskAssessment.evaluated_at == evaluated_time
        ).first()

    def _convert_to_int(self, value: Union[int, IntEnum]) -> int:
        """IntEnum을 int로 변환"""
        return int(value) if isinstance(value, IntEnum) else value
