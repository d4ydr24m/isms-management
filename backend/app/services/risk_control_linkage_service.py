"""
위험-통제항목 연계 서비스
Phase 2: 섹션 5.4 위험-통제항목 연계 구현

기능:
- 5.4.1 위험 처리 계획과 통제항목 연결
- 5.4.2 통제 이행 현황과 위험 수준 연계 분석
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.models.control import ControlItem
from app.models.risk import (
    RiskAssessment,
    RiskTreatmentAction,
    RiskTreatmentControlLink,
    RiskTreatmentPlan,
)


def utc_now() -> datetime:
    """UTC 현재 시간 반환"""
    return datetime.now(timezone.utc)


# 유효한 연결 유형
VALID_LINK_TYPES = ("primary", "secondary", "related")


@dataclass
class LinkData:
    """연결 데이터 클래스"""
    treatment_plan_id: int
    control_item_ids: List[int]
    link_type: str
    effectiveness_rating: Optional[float] = None


class RiskControlLinkageService:
    """
    위험-통제항목 연계 서비스

    위험 처리 계획과 통제항목 간의 연결을 관리하고,
    통제 이행 현황과 위험 수준의 연계 분석을 제공합니다.

    사용 예시:
        >>> service = RiskControlLinkageService(db)
        >>> links = service.link_treatment_to_controls(
        ...     treatment_plan_id=1,
        ...     control_item_ids=[1, 2, 3],
        ...     link_type="primary",
        ...     user_id=1
        ... )
    """

    def __init__(self, db: Session):
        """
        서비스 초기화

        Args:
            db: SQLAlchemy 세션
        """
        self.db = db

    # =========================================================================
    # 5.4.1 위험 처리 계획과 통제항목 연결
    # =========================================================================

    def link_treatment_to_controls(
        self,
        treatment_plan_id: int,
        control_item_ids: List[int],
        link_type: str = "primary",
        effectiveness_rating: Optional[float] = None,
        user_id: Optional[int] = None,
        remarks: Optional[str] = None,
    ) -> List[RiskTreatmentControlLink]:
        """
        위험 처리 계획에 통제항목 연결

        Args:
            treatment_plan_id: 위험 처리 계획 ID
            control_item_ids: 연결할 통제항목 ID 목록
            link_type: 연결 유형 (primary, secondary, related)
            effectiveness_rating: 효과성 등급 (0.0 ~ 1.0)
            user_id: 생성자 ID
            remarks: 비고

        Returns:
            생성된 RiskTreatmentControlLink 목록

        Raises:
            ValueError: 유효하지 않은 입력인 경우
        """
        # 입력값 검증
        self._validate_treatment_plan_exists(treatment_plan_id)
        self._validate_link_type(link_type)
        self._validate_effectiveness_rating(effectiveness_rating)

        created_links = []

        for control_item_id in control_item_ids:
            # 통제항목 존재 확인
            self._validate_control_item_exists(control_item_id)

            # 중복 연결 확인
            self._validate_no_duplicate_link(treatment_plan_id, control_item_id)

            # 연결 생성
            link = RiskTreatmentControlLink(
                treatment_plan_id=treatment_plan_id,
                control_item_id=control_item_id,
                link_type=link_type,
                effectiveness_rating=effectiveness_rating,
                created_by=user_id,
                remarks=remarks,
            )
            self.db.add(link)
            created_links.append(link)

        self.db.commit()

        for link in created_links:
            self.db.refresh(link)

        return created_links

    def get_linked_controls(
        self,
        treatment_plan_id: int,
    ) -> List[ControlItem]:
        """
        처리 계획에 연결된 통제항목 목록 조회

        Args:
            treatment_plan_id: 위험 처리 계획 ID

        Returns:
            연결된 ControlItem 목록
        """
        links = self.db.query(RiskTreatmentControlLink).filter(
            RiskTreatmentControlLink.treatment_plan_id == treatment_plan_id
        ).all()

        control_ids = [link.control_item_id for link in links]

        if not control_ids:
            return []

        return self.db.query(ControlItem).filter(
            ControlItem.id.in_(control_ids)
        ).all()

    def get_linked_controls_with_details(
        self,
        treatment_plan_id: int,
    ) -> List[Dict[str, Any]]:
        """
        처리 계획에 연결된 통제항목 상세 정보 조회

        Args:
            treatment_plan_id: 위험 처리 계획 ID

        Returns:
            연결 상세 정보가 포함된 딕셔너리 목록
        """
        links = (
            self.db.query(RiskTreatmentControlLink)
            .options(joinedload(RiskTreatmentControlLink.control_item))
            .filter(RiskTreatmentControlLink.treatment_plan_id == treatment_plan_id)
            .all()
        )

        result = []
        for link in links:
            result.append({
                "id": link.id,
                "control_item": {
                    "id": link.control_item.id,
                    "code": link.control_item.code,
                    "title": link.control_item.title,
                },
                "link_type": link.link_type,
                "effectiveness_rating": link.effectiveness_rating,
                "created_at": link.created_at,
                "remarks": link.remarks,
            })

        return result

    def get_treatments_by_control(
        self,
        control_item_id: int,
    ) -> List[RiskTreatmentPlan]:
        """
        통제항목에 연결된 위험 처리 계획 조회

        Args:
            control_item_id: 통제항목 ID

        Returns:
            연결된 RiskTreatmentPlan 목록
        """
        links = self.db.query(RiskTreatmentControlLink).filter(
            RiskTreatmentControlLink.control_item_id == control_item_id
        ).all()

        plan_ids = [link.treatment_plan_id for link in links]

        if not plan_ids:
            return []

        return self.db.query(RiskTreatmentPlan).filter(
            RiskTreatmentPlan.id.in_(plan_ids)
        ).all()

    def unlink_treatment_from_control(
        self,
        treatment_plan_id: int,
        control_item_id: int,
    ) -> bool:
        """
        처리 계획과 통제항목 연결 해제

        Args:
            treatment_plan_id: 위험 처리 계획 ID
            control_item_id: 통제항목 ID

        Returns:
            성공 여부

        Raises:
            ValueError: 연결을 찾을 수 없는 경우
        """
        link = self.db.query(RiskTreatmentControlLink).filter(
            and_(
                RiskTreatmentControlLink.treatment_plan_id == treatment_plan_id,
                RiskTreatmentControlLink.control_item_id == control_item_id,
            )
        ).first()

        if not link:
            raise ValueError("연결을 찾을 수 없습니다")

        self.db.delete(link)
        self.db.commit()

        return True

    # =========================================================================
    # 5.4.2 통제 이행 현황과 위험 수준 연계 분석
    # =========================================================================

    def analyze_control_effectiveness(
        self,
        control_item_id: int,
    ) -> Dict[str, Any]:
        """
        통제항목 효과성 분석

        통제항목의 이행률과 연결된 위험들의 잔여 위험을 분석합니다.

        Args:
            control_item_id: 통제항목 ID

        Returns:
            효과성 분석 결과 딕셔너리
        """
        # 연결된 처리 계획 조회
        links = (
            self.db.query(RiskTreatmentControlLink)
            .options(
                joinedload(RiskTreatmentControlLink.treatment_plan)
                .joinedload(RiskTreatmentPlan.actions)
            )
            .filter(RiskTreatmentControlLink.control_item_id == control_item_id)
            .all()
        )

        if not links:
            return {
                "control_item_id": control_item_id,
                "linked_treatment_count": 0,
                "average_effectiveness": 0,
                "implementation_rate": 0,
                "residual_risk_summary": {},
            }

        # 통계 계산
        total_plans = len(links)
        completed_plans = 0
        total_effectiveness = 0
        effectiveness_count = 0
        residual_scores = []

        for link in links:
            plan = link.treatment_plan

            # 완료된 계획 수
            if plan.status == "completed":
                completed_plans += 1

            # 효과성 합산
            if link.effectiveness_rating is not None:
                total_effectiveness += link.effectiveness_rating
                effectiveness_count += 1

            # 잔여 위험 수집
            for action in plan.actions:
                if action.residual_risk_score is not None:
                    residual_scores.append(action.residual_risk_score)

        average_effectiveness = (
            total_effectiveness / effectiveness_count
            if effectiveness_count > 0
            else 0
        )

        implementation_rate = completed_plans / total_plans if total_plans > 0 else 0

        # 잔여 위험 요약
        residual_summary = {}
        if residual_scores:
            residual_summary = {
                "min": min(residual_scores),
                "max": max(residual_scores),
                "average": sum(residual_scores) / len(residual_scores),
                "count": len(residual_scores),
            }

        return {
            "control_item_id": control_item_id,
            "linked_treatment_count": total_plans,
            "average_effectiveness": round(average_effectiveness, 2),
            "implementation_rate": round(implementation_rate, 2),
            "residual_risk_summary": residual_summary,
        }

    def get_risk_control_matrix(
        self,
        scenario_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        위험-통제 매핑 매트릭스 생성

        위험과 통제항목 간의 연결 관계를 매트릭스 형태로 반환합니다.
        통제되지 않은 위험을 식별합니다.

        Args:
            scenario_id: 시나리오 ID (선택, 필터링용)

        Returns:
            매트릭스 및 커버리지 분석 결과
        """
        # 모든 위험 평가 조회
        risk_query = self.db.query(RiskAssessment)
        if scenario_id:
            risk_query = risk_query.filter(RiskAssessment.scenario_id == scenario_id)
        all_risks = risk_query.all()

        # 모든 처리 계획과 연결 조회
        treatment_plans = (
            self.db.query(RiskTreatmentPlan)
            .options(joinedload(RiskTreatmentPlan.control_links))
            .all()
        )

        # 연결 매트릭스 구성
        matrix = []
        controlled_risk_ids = set()

        for plan in treatment_plans:
            # 시나리오 필터링
            if scenario_id and plan.risk_assessment.scenario_id != scenario_id:
                continue

            if plan.control_links:
                controlled_risk_ids.add(plan.risk_assessment_id)

            for link in plan.control_links:
                matrix.append({
                    "risk_assessment_id": plan.risk_assessment_id,
                    "treatment_plan_id": plan.id,
                    "control_item_id": link.control_item_id,
                    "link_type": link.link_type,
                    "effectiveness_rating": link.effectiveness_rating,
                    "plan_status": plan.status,
                })

        # 통제되지 않은 위험 식별
        all_risk_ids = {risk.id for risk in all_risks}
        uncontrolled_ids = all_risk_ids - controlled_risk_ids

        uncontrolled_risks = [
            {
                "id": risk.id,
                "asset_id": risk.asset_id,
                "threat_id": risk.threat_id,
                "vulnerability_id": risk.vulnerability_id,
                "risk_score": risk.risk_score,
                "risk_level": risk.risk_level,
            }
            for risk in all_risks
            if risk.id in uncontrolled_ids
        ]

        # 커버리지 분석
        total_risks = len(all_risks)
        controlled_risks = len(controlled_risk_ids)
        coverage_percentage = (
            controlled_risks / total_risks * 100 if total_risks > 0 else 0
        )

        # 통제항목별 요약
        control_summary = {}
        for entry in matrix:
            cid = entry["control_item_id"]
            if cid not in control_summary:
                control_summary[cid] = {
                    "linked_risk_count": 0,
                    "primary_count": 0,
                    "secondary_count": 0,
                }
            control_summary[cid]["linked_risk_count"] += 1
            if entry["link_type"] == "primary":
                control_summary[cid]["primary_count"] += 1
            elif entry["link_type"] == "secondary":
                control_summary[cid]["secondary_count"] += 1

        return {
            "matrix": matrix,
            "coverage_analysis": {
                "total_risks": total_risks,
                "controlled_risks": controlled_risks,
                "coverage_percentage": round(coverage_percentage, 2),
            },
            "uncontrolled_risks": uncontrolled_risks,
            "control_summary": control_summary,
        }

    def calculate_residual_risk_trend(
        self,
        treatment_plan_id: int,
    ) -> Dict[str, Any]:
        """
        통제 이행에 따른 잔여 위험 추이 분석

        Args:
            treatment_plan_id: 위험 처리 계획 ID

        Returns:
            잔여 위험 추이 분석 결과

        Raises:
            ValueError: 처리 계획을 찾을 수 없는 경우
        """
        # 처리 계획 조회
        plan = (
            self.db.query(RiskTreatmentPlan)
            .options(
                joinedload(RiskTreatmentPlan.risk_assessment),
                joinedload(RiskTreatmentPlan.actions),
            )
            .filter(RiskTreatmentPlan.id == treatment_plan_id)
            .first()
        )

        if not plan:
            raise ValueError("위험 처리 계획을 찾을 수 없습니다")

        # 초기 위험 점수
        initial_score = plan.risk_assessment.risk_score or 0

        # 조치 결과에서 잔여 위험 추이 추출
        actions_with_residual = [
            action for action in plan.actions
            if action.residual_risk_score is not None and action.completed_at
        ]

        # 시간순 정렬
        actions_with_residual.sort(key=lambda a: a.completed_at)

        # 추이 데이터 구성
        trend_data = []
        for action in actions_with_residual:
            trend_data.append({
                "action_id": action.id,
                "completed_at": action.completed_at.isoformat()
                    if action.completed_at else None,
                "residual_risk_score": action.residual_risk_score,
            })

        # 현재 잔여 위험 (가장 최근 조치 결과)
        current_residual = (
            actions_with_residual[-1].residual_risk_score
            if actions_with_residual
            else initial_score
        )

        # 감소율 계산
        reduction_percentage = (
            ((initial_score - current_residual) / initial_score * 100)
            if initial_score > 0
            else 0
        )

        return {
            "treatment_plan_id": treatment_plan_id,
            "initial_risk_score": initial_score,
            "current_residual_score": current_residual,
            "trend_data": trend_data,
            "reduction_percentage": round(reduction_percentage, 2),
        }

    # =========================================================================
    # 대량 작업
    # =========================================================================

    def bulk_link_controls(
        self,
        links_data: List[Dict[str, Any]],
        user_id: int,
    ) -> Dict[str, int]:
        """
        대량 연결 작업

        Args:
            links_data: 연결 데이터 목록
                [{"treatment_plan_id": 1, "control_item_ids": [1, 2], "link_type": "primary"}, ...]
            user_id: 생성자 ID

        Returns:
            성공/실패 카운트
        """
        success_count = 0
        failed_count = 0

        for data in links_data:
            try:
                links = self.link_treatment_to_controls(
                    treatment_plan_id=data["treatment_plan_id"],
                    control_item_ids=data["control_item_ids"],
                    link_type=data.get("link_type", "primary"),
                    effectiveness_rating=data.get("effectiveness_rating"),
                    user_id=user_id,
                )
                success_count += len(links)
            except ValueError:
                failed_count += len(data.get("control_item_ids", []))

        return {
            "success_count": success_count,
            "failed_count": failed_count,
        }

    # =========================================================================
    # 검증 헬퍼 메서드
    # =========================================================================

    def _validate_treatment_plan_exists(self, treatment_plan_id: int) -> None:
        """위험 처리 계획 존재 확인"""
        plan = self.db.query(RiskTreatmentPlan).filter(
            RiskTreatmentPlan.id == treatment_plan_id
        ).first()

        if not plan:
            raise ValueError("위험 처리 계획을 찾을 수 없습니다")

    def _validate_control_item_exists(self, control_item_id: int) -> None:
        """통제항목 존재 확인"""
        item = self.db.query(ControlItem).filter(
            ControlItem.id == control_item_id
        ).first()

        if not item:
            raise ValueError("통제항목을 찾을 수 없습니다")

    def _validate_link_type(self, link_type: str) -> None:
        """연결 유형 유효성 검사"""
        if link_type not in VALID_LINK_TYPES:
            raise ValueError(
                f"유효하지 않은 연결 유형입니다. "
                f"허용된 유형: {', '.join(VALID_LINK_TYPES)}"
            )

    def _validate_effectiveness_rating(
        self, rating: Optional[float]
    ) -> None:
        """효과성 등급 범위 검사"""
        if rating is not None:
            if not isinstance(rating, (int, float)):
                raise ValueError("효과성 등급은 숫자여야 합니다")
            if rating < 0.0 or rating > 1.0:
                raise ValueError("효과성 등급은 0.0 ~ 1.0 사이여야 합니다")

    def _validate_no_duplicate_link(
        self,
        treatment_plan_id: int,
        control_item_id: int,
    ) -> None:
        """중복 연결 확인"""
        existing = self.db.query(RiskTreatmentControlLink).filter(
            and_(
                RiskTreatmentControlLink.treatment_plan_id == treatment_plan_id,
                RiskTreatmentControlLink.control_item_id == control_item_id,
            )
        ).first()

        if existing:
            raise ValueError(
                f"이미 연결되어 있습니다 (treatment_plan_id={treatment_plan_id}, "
                f"control_item_id={control_item_id})"
            )
