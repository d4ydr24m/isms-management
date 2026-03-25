"""
위험 관리 서비스
Phase 2: FR-601 ~ FR-607

위협/취약점 관리, 위험 평가, DoA 관리, 위험 처리 계획, SOA 생성
"""
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from app.models.risk import (
    ThreatCategory, Threat, AssetTypeThreat,
    VulnerabilityCategory, Vulnerability, VulnerabilityAssessment,
    RiskScenario, RiskAssessment, DoAConfig, DoAHistory,
    RiskTreatmentPlan, RiskTreatmentAction, SOARecord,
)
from app.models.asset import Asset
from app.models.control import ControlItem


def utc_now():
    """UTC 현재 시간 반환"""
    return datetime.now(timezone.utc)


def sanitize_search_term(search: str) -> str:
    """
    LIKE 패턴 특수문자 이스케이프 (SQL 인젝션 방지)

    Args:
        search: 검색어

    Returns:
        이스케이프된 검색어
    """
    if not search:
        return search

    # LIKE 패턴 특수문자 이스케이프
    search = search.replace("\\", "\\\\")
    search = search.replace("%", "\\%")
    search = search.replace("_", "\\_")

    return search


class RiskService:
    """
    위험 관리 서비스

    기능:
    - 위협/취약점 CRUD
    - 위험 평가 시나리오 관리
    - 자산-위협-취약점 3-way 매핑
    - 위험도(DoR) 자동 계산
    - DoA 초과 위험 식별
    - 위험 처리 계획 관리
    - 잔여 위험 재계산
    - 시나리오 비교 분석
    - SOA 생성
    """

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # 4.2.1: 위협/취약점 CRUD (FR-601, FR-602)
    # =========================================================================

    # ----- 위협 분류 -----
    def get_threat_categories(
        self,
        parent_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[ThreatCategory], int]:
        """위협 분류 목록 조회"""
        query = self.db.query(ThreatCategory)
        if parent_id is not None:
            query = query.filter(ThreatCategory.parent_id == parent_id)
        if is_active is not None:
            query = query.filter(ThreatCategory.is_active == is_active)
        query = query.order_by(ThreatCategory.sort_order, ThreatCategory.code)
        items = query.all()
        return items, len(items)

    def create_threat_category(
        self,
        code: str,
        name: str,
        description: Optional[str] = None,
        parent_id: Optional[int] = None,
        sort_order: int = 0,
    ) -> ThreatCategory:
        """위협 분류 생성"""
        existing = self.db.query(ThreatCategory).filter(ThreatCategory.code == code).first()
        if existing:
            raise ValueError(f"이미 존재하는 위협 분류 코드입니다: {code}")

        category = ThreatCategory(
            code=code,
            name=name,
            description=description,
            parent_id=parent_id,
            sort_order=sort_order,
            is_active=True,
        )
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    # ----- 위협 -----
    def get_threats(
        self,
        category_id: Optional[int] = None,
        asset_type_id: Optional[int] = None,
        is_active: Optional[bool] = True,
        search: Optional[str] = None,
    ) -> Tuple[List[Threat], int]:
        """위협 목록 조회"""
        query = self.db.query(Threat)

        if category_id is not None:
            query = query.filter(Threat.category_id == category_id)

        if asset_type_id is not None:
            # 자산 유형과 연결된 위협만 조회
            query = query.join(AssetTypeThreat).filter(
                AssetTypeThreat.asset_type_id == asset_type_id,
                AssetTypeThreat.is_active == True,
            )

        if is_active is not None:
            query = query.filter(Threat.is_active == is_active)

        if search:
            sanitized = sanitize_search_term(search)
            search_term = f"%{sanitized}%"
            query = query.filter(
                or_(
                    Threat.name.ilike(search_term),
                    Threat.code.ilike(search_term),
                    Threat.description.ilike(search_term),
                )
            )

        query = query.order_by(Threat.code)
        items = query.all()
        return items, len(items)

    def get_threat_by_id(self, threat_id: int) -> Optional[Threat]:
        """위협 ID로 조회"""
        return self.db.query(Threat).filter(Threat.id == threat_id).first()

    def get_threat_by_code(self, code: str) -> Optional[Threat]:
        """위협 코드로 조회"""
        return self.db.query(Threat).filter(Threat.code == code).first()

    def create_threat(
        self,
        code: str,
        name: str,
        description: Optional[str] = None,
        category_id: Optional[int] = None,
        threat_level: int = 2,
    ) -> Threat:
        """위협 생성 (커스텀)"""
        existing = self.get_threat_by_code(code)
        if existing:
            raise ValueError(f"이미 존재하는 위협 코드입니다: {code}")

        threat = Threat(
            code=code,
            name=name,
            description=description,
            category_id=category_id,
            threat_level=threat_level,
            is_custom=True,
            is_active=True,
        )
        self.db.add(threat)
        self.db.commit()
        self.db.refresh(threat)
        return threat

    def update_threat(self, threat_id: int, **kwargs) -> Threat:
        """위협 수정"""
        threat = self.get_threat_by_id(threat_id)
        if not threat:
            raise ValueError("위협을 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if value is not None and hasattr(threat, key):
                setattr(threat, key, value)

        self.db.commit()
        self.db.refresh(threat)
        return threat

    def delete_threat(self, threat_id: int) -> None:
        """위협 삭제 (비활성화)"""
        threat = self.get_threat_by_id(threat_id)
        if not threat:
            raise ValueError("위협을 찾을 수 없습니다.")

        if not threat.is_custom:
            raise ValueError("기본 제공 위협은 삭제할 수 없습니다.")

        threat.is_active = False
        self.db.commit()

    def get_threats_by_asset_type(self, asset_type_id: int) -> List[Threat]:
        """자산 유형별 위협 조회"""
        items, _ = self.get_threats(asset_type_id=asset_type_id)
        return items

    # ----- 취약점 분류 -----
    def get_vulnerability_categories(
        self,
        parent_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[VulnerabilityCategory], int]:
        """취약점 분류 목록 조회"""
        query = self.db.query(VulnerabilityCategory)
        if parent_id is not None:
            query = query.filter(VulnerabilityCategory.parent_id == parent_id)
        if is_active is not None:
            query = query.filter(VulnerabilityCategory.is_active == is_active)
        query = query.order_by(VulnerabilityCategory.sort_order, VulnerabilityCategory.code)
        items = query.all()
        return items, len(items)

    # ----- 취약점 -----
    def get_vulnerabilities(
        self,
        category_id: Optional[int] = None,
        is_active: Optional[bool] = True,
        search: Optional[str] = None,
    ) -> Tuple[List[Vulnerability], int]:
        """취약점 목록 조회"""
        query = self.db.query(Vulnerability)

        if category_id is not None:
            query = query.filter(Vulnerability.category_id == category_id)

        if is_active is not None:
            query = query.filter(Vulnerability.is_active == is_active)

        if search:
            sanitized = sanitize_search_term(search)
            search_term = f"%{sanitized}%"
            query = query.filter(
                or_(
                    Vulnerability.name.ilike(search_term),
                    Vulnerability.code.ilike(search_term),
                    Vulnerability.description.ilike(search_term),
                )
            )

        query = query.order_by(Vulnerability.code)
        items = query.all()
        return items, len(items)

    def get_vulnerability_by_id(self, vulnerability_id: int) -> Optional[Vulnerability]:
        """취약점 ID로 조회"""
        return self.db.query(Vulnerability).filter(Vulnerability.id == vulnerability_id).first()

    def get_vulnerability_by_code(self, code: str) -> Optional[Vulnerability]:
        """취약점 코드로 조회"""
        return self.db.query(Vulnerability).filter(Vulnerability.code == code).first()

    def create_vulnerability(
        self,
        code: str,
        name: str,
        description: Optional[str] = None,
        category_id: Optional[int] = None,
        vulnerability_level: int = 2,
    ) -> Vulnerability:
        """취약점 생성 (커스텀)"""
        existing = self.get_vulnerability_by_code(code)
        if existing:
            raise ValueError(f"이미 존재하는 취약점 코드입니다: {code}")

        vuln = Vulnerability(
            code=code,
            name=name,
            description=description,
            category_id=category_id,
            vulnerability_level=vulnerability_level,
            is_custom=True,
            is_active=True,
        )
        self.db.add(vuln)
        self.db.commit()
        self.db.refresh(vuln)
        return vuln

    def update_vulnerability(self, vulnerability_id: int, **kwargs) -> Vulnerability:
        """취약점 수정"""
        vuln = self.get_vulnerability_by_id(vulnerability_id)
        if not vuln:
            raise ValueError("취약점을 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if value is not None and hasattr(vuln, key):
                setattr(vuln, key, value)

        self.db.commit()
        self.db.refresh(vuln)
        return vuln

    def delete_vulnerability(self, vulnerability_id: int) -> None:
        """취약점 삭제 (비활성화)"""
        vuln = self.get_vulnerability_by_id(vulnerability_id)
        if not vuln:
            raise ValueError("취약점을 찾을 수 없습니다.")

        if not vuln.is_custom:
            raise ValueError("기본 제공 취약점은 삭제할 수 없습니다.")

        vuln.is_active = False
        self.db.commit()

    # ----- 취약점 점검 결과 -----
    def create_vulnerability_assessment(
        self,
        asset_id: int,
        vulnerability_id: int,
        is_vulnerable: bool,
        assessment_date: date,
        user_id: int,
        findings: Optional[str] = None,
        remediation_status: str = "open",
        remarks: Optional[str] = None,
    ) -> VulnerabilityAssessment:
        """취약점 점검 결과 등록"""
        assessment = VulnerabilityAssessment(
            asset_id=asset_id,
            vulnerability_id=vulnerability_id,
            is_vulnerable=is_vulnerable,
            assessment_date=assessment_date,
            assessed_by=user_id,
            findings=findings,
            remediation_status=remediation_status,
            remarks=remarks,
        )
        self.db.add(assessment)
        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def get_vulnerability_assessments(
        self,
        asset_id: Optional[int] = None,
        vulnerability_id: Optional[int] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict:
        """취약점 점검 결과 조회"""
        query = self.db.query(VulnerabilityAssessment)

        if asset_id is not None:
            query = query.filter(VulnerabilityAssessment.asset_id == asset_id)
        if vulnerability_id is not None:
            query = query.filter(VulnerabilityAssessment.vulnerability_id == vulnerability_id)

        total = query.count()
        offset = (page - 1) * size
        items = query.order_by(VulnerabilityAssessment.assessment_date.desc()).offset(offset).limit(size).all()
        pages = (total + size - 1) // size

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    # =========================================================================
    # 4.2.2: 위험 평가 시나리오 관리 (FR-603)
    # =========================================================================

    def create_risk_scenario(
        self,
        name: str,
        start_date: date,
        user_id: int,
        description: Optional[str] = None,
        end_date: Optional[date] = None,
    ) -> RiskScenario:
        """위험 평가 시나리오 생성"""
        scenario = RiskScenario(
            name=name,
            description=description,
            start_date=start_date,
            end_date=end_date,
            status="draft",
            created_by=user_id,
        )
        self.db.add(scenario)
        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def get_risk_scenario_by_id(self, scenario_id: int) -> Optional[RiskScenario]:
        """시나리오 ID로 조회"""
        return self.db.query(RiskScenario).filter(RiskScenario.id == scenario_id).first()

    def get_risk_scenarios(
        self,
        status: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict:
        """시나리오 목록 조회"""
        query = self.db.query(RiskScenario)

        if status is not None:
            query = query.filter(RiskScenario.status == status)

        total = query.count()
        offset = (page - 1) * size
        items = query.order_by(RiskScenario.created_at.desc()).offset(offset).limit(size).all()
        pages = (total + size - 1) // size

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    def get_scenario_stats_batch(self, scenario_ids: List[int]) -> Dict[int, Dict[str, int]]:
        """
        시나리오 통계 일괄 조회 (N+1 쿼리 방지)

        Returns:
            Dict[scenario_id, {"total": int, "high_count": int}]
        """
        from sqlalchemy import case

        if not scenario_ids:
            return {}

        stats = (
            self.db.query(
                RiskAssessment.scenario_id,
                func.count(RiskAssessment.id).label("total"),
                func.sum(case((RiskAssessment.risk_level == "high", 1), else_=0)).label("high_count"),
            )
            .filter(RiskAssessment.scenario_id.in_(scenario_ids))
            .group_by(RiskAssessment.scenario_id)
            .all()
        )

        return {
            s.scenario_id: {"total": int(s.total), "high_count": int(s.high_count or 0)}
            for s in stats
        }

    def update_risk_scenario(self, scenario_id: int, **kwargs) -> RiskScenario:
        """시나리오 수정"""
        scenario = self.get_risk_scenario_by_id(scenario_id)
        if not scenario:
            raise ValueError("시나리오를 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if value is not None and hasattr(scenario, key):
                setattr(scenario, key, value)

        # 완료 상태로 변경 시 완료 일시 기록
        if kwargs.get("status") == "completed" and not scenario.completed_at:
            scenario.completed_at = utc_now()

        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def delete_risk_scenario(self, scenario_id: int) -> None:
        """시나리오 삭제"""
        scenario = self.get_risk_scenario_by_id(scenario_id)
        if not scenario:
            raise ValueError("시나리오를 찾을 수 없습니다.")

        # CASCADE로 연관 평가도 삭제됨
        self.db.delete(scenario)
        self.db.commit()

    # =========================================================================
    # 4.2.3: 자산-위협-취약점 3-way 매핑 (FR-603)
    # =========================================================================

    def create_risk_assessment(
        self,
        scenario_id: int,
        asset_id: int,
        threat_id: int,
        vulnerability_id: int,
        asset_value: int,
        threat_level: int,
        vulnerability_level: int,
        user_id: int,
        remarks: Optional[str] = None,
    ) -> RiskAssessment:
        """위험 평가 생성 (3-way 매핑)"""
        assessment = RiskAssessment(
            scenario_id=scenario_id,
            asset_id=asset_id,
            threat_id=threat_id,
            vulnerability_id=vulnerability_id,
            asset_value=asset_value,
            threat_level=threat_level,
            vulnerability_level=vulnerability_level,
            evaluated_by=user_id,
            evaluated_at=utc_now(),
            remarks=remarks,
        )
        self.db.add(assessment)
        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def get_risk_assessment_by_id(self, assessment_id: int) -> Optional[RiskAssessment]:
        """위험 평가 ID로 조회"""
        return self.db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()

    def get_risk_assessments(
        self,
        scenario_id: Optional[int] = None,
        asset_id: Optional[int] = None,
        risk_level: Optional[str] = None,
        exceeds_doa: Optional[bool] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict:
        """위험 평가 목록 조회"""
        query = self.db.query(RiskAssessment)

        if scenario_id is not None:
            query = query.filter(RiskAssessment.scenario_id == scenario_id)
        if asset_id is not None:
            query = query.filter(RiskAssessment.asset_id == asset_id)
        if risk_level is not None:
            query = query.filter(RiskAssessment.risk_level == risk_level)

        # DoA 초과 필터
        if exceeds_doa is not None:
            doa = self.get_current_doa()
            if doa:
                if exceeds_doa:
                    query = query.filter(RiskAssessment.risk_score >= doa.threshold_value)
                else:
                    query = query.filter(RiskAssessment.risk_score < doa.threshold_value)

        total = query.count()
        offset = (page - 1) * size
        items = query.order_by(RiskAssessment.risk_score.desc()).offset(offset).limit(size).all()
        pages = (total + size - 1) // size

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    def update_risk_assessment(self, assessment_id: int, user_id: int, **kwargs) -> RiskAssessment:
        """위험 평가 수정"""
        assessment = self.get_risk_assessment_by_id(assessment_id)
        if not assessment:
            raise ValueError("위험 평가를 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if value is not None and hasattr(assessment, key):
                setattr(assessment, key, value)

        assessment.evaluated_by = user_id
        assessment.evaluated_at = utc_now()

        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def delete_risk_assessment(self, assessment_id: int) -> None:
        """위험 평가 삭제"""
        assessment = self.get_risk_assessment_by_id(assessment_id)
        if not assessment:
            raise ValueError("위험 평가를 찾을 수 없습니다.")

        self.db.delete(assessment)
        self.db.commit()

    # =========================================================================
    # 4.2.4: 위험도(DoR) 자동 계산 (FR-603)
    # =========================================================================

    def recalculate_scenario_risks(self, scenario_id: int) -> int:
        """시나리오 전체 위험도 재계산"""
        assessments = (
            self.db.query(RiskAssessment)
            .filter(RiskAssessment.scenario_id == scenario_id)
            .all()
        )

        count = 0
        for assessment in assessments:
            # 모델의 before_insert/before_update 이벤트가 자동 계산
            # 명시적으로 변경을 트리거
            assessment.risk_score = (
                assessment.asset_value * assessment.threat_level * assessment.vulnerability_level
            )
            if assessment.risk_score >= 18:
                assessment.risk_level = "high"
            elif assessment.risk_score >= 8:
                assessment.risk_level = "medium"
            else:
                assessment.risk_level = "low"
            count += 1

        self.db.commit()
        return count

    # =========================================================================
    # 4.2.5: DoA 초과 위험 자동 식별 (FR-604)
    # =========================================================================

    def get_current_doa(self) -> Optional[DoAConfig]:
        """현재 활성화된 DoA 설정 조회"""
        today = date.today()
        return (
            self.db.query(DoAConfig)
            .filter(
                DoAConfig.is_active == True,
                DoAConfig.effective_date <= today,
                or_(
                    DoAConfig.expiry_date.is_(None),
                    DoAConfig.expiry_date >= today,
                ),
            )
            .order_by(DoAConfig.effective_date.desc())
            .first()
        )

    def create_doa_config(
        self,
        threshold_value: int,
        effective_date: date,
        user_id: int,
        expiry_date: Optional[date] = None,
        remarks: Optional[str] = None,
    ) -> DoAConfig:
        """DoA 설정 생성 (트랜잭션 안전)"""
        try:
            # 이전 DoA 비활성화
            self.db.query(DoAConfig).filter(DoAConfig.is_active == True).update(
                {"is_active": False}
            )

            config = DoAConfig(
                threshold_value=threshold_value,
                effective_date=effective_date,
                expiry_date=expiry_date,
                approved_by=user_id,
                approval_date=date.today(),
                remarks=remarks,
                is_active=True,
            )
            self.db.add(config)
            self.db.flush()

            # 변경 이력 기록
            history = DoAHistory(
                doa_config_id=config.id,
                new_threshold=threshold_value,
                change_reason=remarks,
                changed_by=user_id,
                changed_at=utc_now(),
            )
            self.db.add(history)
            self.db.commit()
            self.db.refresh(config)
            return config
        except Exception:
            self.db.rollback()
            raise

    def get_doa_history(self, config_id: Optional[int] = None) -> List[DoAHistory]:
        """DoA 변경 이력 조회"""
        query = self.db.query(DoAHistory)
        if config_id is not None:
            query = query.filter(DoAHistory.doa_config_id == config_id)
        return query.order_by(DoAHistory.changed_at.desc()).all()

    def get_risks_exceeding_doa(self, scenario_id: Optional[int] = None) -> List[RiskAssessment]:
        """DoA 초과 위험 목록 조회"""
        doa = self.get_current_doa()
        if not doa:
            return []

        query = self.db.query(RiskAssessment).filter(
            RiskAssessment.risk_score >= doa.threshold_value
        )

        if scenario_id is not None:
            query = query.filter(RiskAssessment.scenario_id == scenario_id)

        return query.order_by(RiskAssessment.risk_score.desc()).all()

    def check_risk_exceeds_doa(self, assessment_id: int) -> bool:
        """개별 위험의 DoA 초과 여부 확인"""
        assessment = self.get_risk_assessment_by_id(assessment_id)
        if not assessment or assessment.risk_score is None:
            return False

        doa = self.get_current_doa()
        if not doa:
            return False

        return assessment.risk_score >= doa.threshold_value

    # =========================================================================
    # 4.2.6: 위험 처리 계획 관리 (FR-605)
    # =========================================================================

    def create_treatment_plan(
        self,
        risk_assessment_id: int,
        strategy: str,
        description: Optional[str] = None,
        assignee_id: Optional[int] = None,
        due_date: Optional[date] = None,
        budget: Optional[int] = None,
    ) -> RiskTreatmentPlan:
        """위험 처리 계획 생성"""
        plan = RiskTreatmentPlan(
            risk_assessment_id=risk_assessment_id,
            strategy=strategy,
            description=description,
            assignee_id=assignee_id,
            due_date=due_date,
            budget=budget,
            status="planned",
        )
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_treatment_plan_by_id(self, plan_id: int) -> Optional[RiskTreatmentPlan]:
        """위험 처리 계획 ID로 조회"""
        return self.db.query(RiskTreatmentPlan).filter(RiskTreatmentPlan.id == plan_id).first()

    def get_treatment_plans(
        self,
        risk_assessment_id: Optional[int] = None,
        status: Optional[str] = None,
        assignee_id: Optional[int] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict:
        """위험 처리 계획 목록 조회"""
        query = self.db.query(RiskTreatmentPlan)

        if risk_assessment_id is not None:
            query = query.filter(RiskTreatmentPlan.risk_assessment_id == risk_assessment_id)
        if status is not None:
            query = query.filter(RiskTreatmentPlan.status == status)
        if assignee_id is not None:
            query = query.filter(RiskTreatmentPlan.assignee_id == assignee_id)

        total = query.count()
        offset = (page - 1) * size
        items = query.order_by(RiskTreatmentPlan.due_date).offset(offset).limit(size).all()
        pages = (total + size - 1) // size

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    def update_treatment_plan(self, plan_id: int, **kwargs) -> RiskTreatmentPlan:
        """위험 처리 계획 수정"""
        plan = self.get_treatment_plan_by_id(plan_id)
        if not plan:
            raise ValueError("처리 계획을 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if value is not None and hasattr(plan, key):
                setattr(plan, key, value)

        # 완료 상태로 변경 시 완료 일시 기록
        if kwargs.get("status") == "completed" and not plan.completed_at:
            plan.completed_at = utc_now()

        self.db.commit()
        self.db.refresh(plan)
        return plan

    def create_treatment_action(
        self,
        plan_id: int,
        action_description: str,
        user_id: int,
        result: Optional[str] = None,
        residual_risk_score: Optional[int] = None,
        evidence_file_path: Optional[str] = None,
    ) -> RiskTreatmentAction:
        """위험 처리 조치 결과 등록"""
        action = RiskTreatmentAction(
            plan_id=plan_id,
            action_description=action_description,
            result=result,
            residual_risk_score=residual_risk_score,
            completed_by=user_id,
            completed_at=utc_now(),
            evidence_file_path=evidence_file_path,
        )
        self.db.add(action)
        self.db.commit()
        self.db.refresh(action)
        return action

    def get_treatment_progress(self, scenario_id: Optional[int] = None) -> Dict:
        """위험 처리 진행률 조회"""
        query = self.db.query(RiskTreatmentPlan)

        if scenario_id is not None:
            query = query.join(RiskAssessment).filter(
                RiskAssessment.scenario_id == scenario_id
            )

        total = query.count()
        completed = query.filter(RiskTreatmentPlan.status == "completed").count()
        in_progress = query.filter(RiskTreatmentPlan.status == "in_progress").count()
        planned = query.filter(RiskTreatmentPlan.status == "planned").count()
        cancelled = query.filter(RiskTreatmentPlan.status == "cancelled").count()

        completion_rate = (completed / total * 100) if total > 0 else 0.0

        return {
            "total": total,
            "completed": completed,
            "in_progress": in_progress,
            "planned": planned,
            "cancelled": cancelled,
            "completion_rate": round(completion_rate, 1),
        }

    # =========================================================================
    # 4.2.7: 잔여 위험 재계산 (FR-605)
    # =========================================================================

    def get_latest_residual_risk(self, plan_id: int) -> Optional[int]:
        """처리 계획의 최신 잔여 위험 점수 조회"""
        action = (
            self.db.query(RiskTreatmentAction)
            .filter(
                RiskTreatmentAction.plan_id == plan_id,
                RiskTreatmentAction.residual_risk_score.isnot(None),
            )
            .order_by(RiskTreatmentAction.completed_at.desc())
            .first()
        )
        return action.residual_risk_score if action else None

    # =========================================================================
    # 4.2.8: 시나리오 비교 분석 (FR-603)
    # =========================================================================

    def compare_scenarios(self, scenario1_id: int, scenario2_id: int) -> Dict:
        """두 시나리오 비교"""
        scenario1 = self.get_risk_scenario_by_id(scenario1_id)
        scenario2 = self.get_risk_scenario_by_id(scenario2_id)

        if not scenario1 or not scenario2:
            raise ValueError("시나리오를 찾을 수 없습니다.")

        # 시나리오 1 통계
        s1_stats = self._get_scenario_stats(scenario1_id)
        # 시나리오 2 통계
        s2_stats = self._get_scenario_stats(scenario2_id)

        return {
            "scenario1_id": scenario1_id,
            "scenario1_name": scenario1.name,
            "scenario1_stats": s1_stats,
            "scenario2_id": scenario2_id,
            "scenario2_name": scenario2.name,
            "scenario2_stats": s2_stats,
            "risk_count_diff": s2_stats["total"] - s1_stats["total"],
            "high_risk_diff": s2_stats["high_count"] - s1_stats["high_count"],
            "avg_risk_score_diff": round(s2_stats["avg_score"] - s1_stats["avg_score"], 2),
        }

    def _get_scenario_stats(self, scenario_id: int) -> Dict:
        """시나리오 통계 계산"""
        assessments = (
            self.db.query(RiskAssessment)
            .filter(RiskAssessment.scenario_id == scenario_id)
            .all()
        )

        total = len(assessments)
        high_count = sum(1 for a in assessments if a.risk_level == "high")
        medium_count = sum(1 for a in assessments if a.risk_level == "medium")
        low_count = sum(1 for a in assessments if a.risk_level == "low")
        scores = [a.risk_score for a in assessments if a.risk_score]
        avg_score = sum(scores) / len(scores) if scores else 0

        return {
            "total": total,
            "high_count": high_count,
            "medium_count": medium_count,
            "low_count": low_count,
            "avg_score": avg_score,
        }

    # =========================================================================
    # SOA 관리 (FR-606)
    # =========================================================================

    def get_soa_records(self) -> Tuple[List[SOARecord], int]:
        """SOA 레코드 목록 조회"""
        from sqlalchemy.orm import joinedload
        items = self.db.query(SOARecord).options(joinedload(SOARecord.control_item)).all()
        return items, len(items)

    def get_soa_record_by_control(self, control_item_id: int) -> Optional[SOARecord]:
        """통제항목 ID로 SOA 레코드 조회"""
        return (
            self.db.query(SOARecord)
            .filter(SOARecord.control_item_id == control_item_id)
            .first()
        )

    def update_soa_record(self, control_item_id: int, **kwargs) -> SOARecord:
        """SOA 레코드 수정"""
        record = self.get_soa_record_by_control(control_item_id)
        if not record:
            # 없으면 생성
            record = SOARecord(control_item_id=control_item_id)
            self.db.add(record)

        for key, value in kwargs.items():
            if hasattr(record, key):
                setattr(record, key, value)

        self.db.commit()
        self.db.refresh(record)
        return record

    def generate_soa(self) -> int:
        """SOA 자동 생성"""
        # 모든 통제항목 조회 (ControlItem 모델에는 is_active가 없음)
        control_items = self.db.query(ControlItem).all()

        count = 0
        for item in control_items:
            existing = self.get_soa_record_by_control(item.id)
            if not existing:
                record = SOARecord(
                    control_item_id=item.id,
                    is_applicable=True,
                    implementation_status="not_implemented",
                )
                self.db.add(record)
                count += 1

        self.db.commit()
        return count

    # =========================================================================
    # 위험 통계 및 보고서 (FR-607)
    # =========================================================================

    def get_risk_distribution(self, scenario_id: int) -> Dict:
        """위험 분포 조회"""
        stats = self._get_scenario_stats(scenario_id)
        return {
            "high": stats["high_count"],
            "medium": stats["medium_count"],
            "low": stats["low_count"],
            "total": stats["total"],
        }

    def get_risk_matrix_data(self, scenario_id: int) -> Dict:
        """위험 매트릭스 데이터 조회"""
        assessments = (
            self.db.query(RiskAssessment)
            .filter(RiskAssessment.scenario_id == scenario_id)
            .all()
        )

        # 3x3 매트릭스 (자산가치 x (위협x취약점의 평균))
        # 간단히 위협 등급 x 취약점 등급 매트릭스
        matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]

        for a in assessments:
            if a.threat_level and a.vulnerability_level:
                row = a.threat_level - 1
                col = a.vulnerability_level - 1
                if 0 <= row < 3 and 0 <= col < 3:
                    matrix[row][col] += 1

        return {
            "matrix": matrix,
            "labels": {
                "impact": ["하", "중", "상"],
                "likelihood": ["하", "중", "상"],
            },
        }

    def get_report_summary(self, scenario_id: int) -> Dict:
        """위험 평가 보고서 요약"""
        scenario = self.get_risk_scenario_by_id(scenario_id)
        if not scenario:
            raise ValueError("시나리오를 찾을 수 없습니다.")

        distribution = self.get_risk_distribution(scenario_id)
        doa = self.get_current_doa()
        exceeding_doa_count = len(self.get_risks_exceeding_doa(scenario_id)) if doa else 0
        progress = self.get_treatment_progress(scenario_id)

        # 상위 위험
        result = self.get_risk_assessments(scenario_id=scenario_id, page=1, size=5)
        top_risks = result["items"]

        # 관련 자산 수
        total_assets = (
            self.db.query(func.count(func.distinct(RiskAssessment.asset_id)))
            .filter(RiskAssessment.scenario_id == scenario_id)
            .scalar() or 0
        )

        return {
            "scenario_id": scenario_id,
            "scenario_name": scenario.name,
            "assessment_period": f"{scenario.start_date} ~ {scenario.end_date or '진행중'}",
            "total_assets": total_assets,
            "total_risks": distribution["total"],
            "risk_distribution": distribution,
            "exceeding_doa_count": exceeding_doa_count,
            "treatment_progress": progress,
            "top_risks": top_risks,
        }
