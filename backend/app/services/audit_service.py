"""
감사 서비스

5.2 감사 서비스 구현 (FR-201 ~ FR-206)
- 감사 계획 관리
- 체크리스트 자동 생성 (통제항목 기반)
- 부적합 사항 관리
- 시정조치 워크플로우
- 부적합 이력 분석 (동일 항목 반복 지적)
"""
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any

from sqlalchemy import func, desc, or_
from sqlalchemy.orm import Session, joinedload

from app.models.audit import (
    AuditPlan,
    AuditChecklist,
    AuditChecklistResult,
    NonConformity,
    CorrectiveAction,
    nc_assignees,
    ca_assignees,
)
from app.models.control import ControlItem, ControlDomain
from app.models.personnel import Personnel
from app.models.user import User
from app.schemas.audit import (
    AuditPlanCreate,
    AuditPlanUpdate,
    AuditTeamUpdate,
    ChecklistResultCreate,
    NonConformityCreate,
    NonConformityUpdate,
    NonConformityHistory,
    CorrectiveActionCreate,
    CorrectiveActionUpdate,
    CorrectiveActionVerify,
)


class AuditService:
    """
    감사 관련 비즈니스 로직 서비스
    """

    def __init__(self, db: Session):
        self.db = db

    # ========== 감사 계획 관리 ==========

    def create_audit_plan(self, plan_data: AuditPlanCreate, current_user_id: int = None) -> AuditPlan:
        """
        감사 계획 생성

        Args:
            plan_data: 감사 계획 생성 데이터
            current_user_id: 현재 사용자 ID (감사원 미지정 시 수석감사원으로 사용)

        Returns:
            AuditPlan: 생성된 감사 계획
        """
        # auditor_ids에서 첫 번째를 수석감사원, 나머지를 팀원으로 분리
        auditor_ids = plan_data.auditor_ids or []
        lead_auditor_id = auditor_ids[0] if auditor_ids else current_user_id
        team_member_ids = auditor_ids[1:] if len(auditor_ids) > 1 else []
        team_members = ",".join(str(mid) for mid in team_member_ids) if team_member_ids else None

        plan = AuditPlan(
            title=plan_data.title,
            description=plan_data.description,
            audit_type=plan_data.audit_type.value,
            start_date=plan_data.start_date,
            end_date=plan_data.end_date,
            scope=plan_data.scope,
            control_domains=plan_data.control_domains,
            lead_auditor_id=lead_auditor_id,
            team_members=team_members,
            status="planning",
        )
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)

        # control_item_ids가 있으면 체크리스트 자동 생성
        if plan_data.control_item_ids:
            self._create_checklists_from_items(plan.id, plan_data.control_item_ids)

        return plan

    def _create_checklists_from_items(self, plan_id: int, control_item_ids: List[int]) -> None:
        """통제항목 ID 목록으로 체크리스트 생성"""
        from app.models.control import ControlItem

        items = (
            self.db.query(ControlItem)
            .filter(ControlItem.id.in_(control_item_ids))
            .order_by(ControlItem.sort_order)
            .all()
        )

        for idx, item in enumerate(items):
            checklist = AuditChecklist(
                audit_plan_id=plan_id,
                control_item_id=item.id,
                question=f"[{item.code}] {item.title}에 대한 이행 여부를 점검합니다.",
                sort_order=idx + 1,
            )
            self.db.add(checklist)

        self.db.commit()

    def get_audit_plan(self, plan_id: int) -> Optional[AuditPlan]:
        """
        감사 계획 조회

        Args:
            plan_id: 감사 계획 ID

        Returns:
            AuditPlan: 감사 계획 또는 None
        """
        return (
            self.db.query(AuditPlan)
            .options(joinedload(AuditPlan.lead_auditor))
            .filter(AuditPlan.id == plan_id)
            .first()
        )

    def update_audit_plan(
        self, plan_id: int, update_data: AuditPlanUpdate
    ) -> Optional[AuditPlan]:
        """
        감사 계획 수정

        Args:
            plan_id: 감사 계획 ID
            update_data: 수정 데이터

        Returns:
            AuditPlan: 수정된 감사 계획
        """
        plan = self.get_audit_plan(plan_id)
        if not plan:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                # Enum 값은 문자열로 변환
                if hasattr(value, "value"):
                    value = value.value
                setattr(plan, key, value)

        self.db.commit()
        self.db.refresh(plan)
        return plan

    def delete_audit_plan(self, plan_id: int) -> bool:
        """
        감사 계획 삭제

        Args:
            plan_id: 감사 계획 ID

        Returns:
            bool: 삭제 성공 여부
        """
        plan = self.get_audit_plan(plan_id)
        if not plan:
            return False

        self.db.delete(plan)
        self.db.commit()
        return True

    def update_audit_team(
        self, plan_id: int, team_data: AuditTeamUpdate
    ) -> Optional[AuditPlan]:
        """
        감사팀 구성 수정

        Args:
            plan_id: 감사 계획 ID
            team_data: 팀 구성 데이터

        Returns:
            AuditPlan: 수정된 감사 계획
        """
        plan = self.get_audit_plan(plan_id)
        if not plan:
            return None

        plan.lead_auditor_id = team_data.lead_auditor_id
        plan.team_members = ",".join(str(id) for id in team_data.team_member_ids)

        self.db.commit()
        self.db.refresh(plan)
        return plan

    def list_audit_plans(
        self,
        page: int = 1,
        size: int = 10,
        audit_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[AuditPlan], int]:
        """
        감사 계획 목록 조회

        Args:
            page: 페이지 번호
            size: 페이지 크기
            audit_type: 감사 유형 필터
            status: 상태 필터
            search: 검색어

        Returns:
            Tuple[List[AuditPlan], int]: 감사 계획 목록, 전체 개수
        """
        query = self.db.query(AuditPlan).options(joinedload(AuditPlan.lead_auditor))

        # 필터 적용
        if audit_type:
            query = query.filter(AuditPlan.audit_type == audit_type)
        if status:
            query = query.filter(AuditPlan.status == status)
        if search:
            query = query.filter(
                AuditPlan.title.ilike(f"%{search}%")
                | AuditPlan.scope.ilike(f"%{search}%")
            )

        # 전체 개수
        total = query.count()

        # 페이지네이션
        plans = (
            query.order_by(desc(AuditPlan.created_at))
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        return plans, total

    # ========== 체크리스트 관리 ==========

    def generate_checklist(self, plan_id: int) -> List[AuditChecklist]:
        """
        체크리스트 자동 생성 (통제항목 기반)

        Args:
            plan_id: 감사 계획 ID

        Returns:
            List[AuditChecklist]: 생성된 체크리스트 목록
        """
        plan = self.get_audit_plan(plan_id)
        if not plan:
            return []

        # 기존 체크리스트 삭제
        self.db.query(AuditChecklist).filter(
            AuditChecklist.audit_plan_id == plan_id
        ).delete()

        # 통제항목 조회 (필터링된 영역)
        query = self.db.query(ControlItem)

        # 감사 범위에 해당하는 통제영역 필터
        if plan.control_domains:
            domain_codes = [d.strip() for d in plan.control_domains.split(",")]
            # 도메인 -> 카테고리 -> 항목 조인 필요
            from app.models.control import ControlCategory, ControlDomain

            domain_ids = (
                self.db.query(ControlDomain.id)
                .filter(ControlDomain.code.in_(domain_codes))
                .all()
            )
            domain_ids = [d.id for d in domain_ids]

            if domain_ids:
                category_ids = (
                    self.db.query(ControlCategory.id)
                    .filter(ControlCategory.domain_id.in_(domain_ids))
                    .all()
                )
                category_ids = [c.id for c in category_ids]

                if category_ids:
                    query = query.filter(ControlItem.category_id.in_(category_ids))

        control_items = query.order_by(ControlItem.sort_order).all()

        # 체크리스트 항목 생성
        checklists = []
        for idx, item in enumerate(control_items):
            checklist = AuditChecklist(
                audit_plan_id=plan_id,
                control_item_id=item.id,
                question=f"[{item.code}] {item.title}에 대한 이행 여부를 점검합니다.",
                sort_order=idx + 1,
            )
            self.db.add(checklist)
            checklists.append(checklist)

        self.db.commit()
        for checklist in checklists:
            self.db.refresh(checklist)

        return checklists

    def get_checklists(self, plan_id: int) -> List[AuditChecklist]:
        """
        체크리스트 조회

        Args:
            plan_id: 감사 계획 ID

        Returns:
            List[AuditChecklist]: 체크리스트 목록
        """
        return (
            self.db.query(AuditChecklist)
            .options(
                joinedload(AuditChecklist.control_item),
                joinedload(AuditChecklist.results),
            )
            .filter(AuditChecklist.audit_plan_id == plan_id)
            .order_by(AuditChecklist.sort_order)
            .all()
        )

    def submit_checklist_result(
        self,
        checklist_id: int,
        result_data: ChecklistResultCreate,
        auditor_id: int,
    ) -> AuditChecklistResult:
        """
        점검 결과 입력

        Args:
            checklist_id: 체크리스트 ID
            result_data: 점검 결과 데이터
            auditor_id: 점검자 ID

        Returns:
            AuditChecklistResult: 생성된 점검 결과
        """
        result = AuditChecklistResult(
            checklist_id=checklist_id,
            result=result_data.result.value,
            finding=result_data.finding,
            evidence_reference=result_data.evidence_reference,
            auditor_id=auditor_id,
            checked_at=datetime.utcnow(),
        )
        self.db.add(result)
        self.db.commit()
        self.db.refresh(result)
        return result

    def link_evidence_to_checklist(
        self, checklist_id: int, evidence_ids: List[int]
    ) -> bool:
        """
        체크리스트에 증적 연결

        Args:
            checklist_id: 체크리스트 ID
            evidence_ids: 증적 ID 목록

        Returns:
            bool: 연결 성공 여부
        """
        # 최신 결과에 증적 참조 업데이트
        result = (
            self.db.query(AuditChecklistResult)
            .filter(AuditChecklistResult.checklist_id == checklist_id)
            .order_by(desc(AuditChecklistResult.checked_at))
            .first()
        )

        if result:
            result.evidence_reference = ",".join(str(id) for id in evidence_ids)
            self.db.commit()
            return True

        return False

    # ========== 부적합 관리 ==========

    def create_non_conformity(self, nc_data: NonConformityCreate) -> NonConformity:
        """
        부적합 등록

        Args:
            nc_data: 부적합 생성 데이터

        Returns:
            NonConformity: 생성된 부적합
        """
        personnel_list = (
            self.db.query(Personnel)
            .filter(Personnel.id.in_(nc_data.responsible_person_ids))
            .all()
        )
        nc = NonConformity(
            audit_plan_id=nc_data.audit_plan_id,
            control_item_id=nc_data.control_item_id,
            nc_type=nc_data.nc_type.value,
            severity=nc_data.severity.value,
            title=nc_data.title,
            description=nc_data.description,
            requirement=nc_data.requirement,
            ai_hint=nc_data.ai_hint,
            responsible_person_id=nc_data.responsible_person_ids[0],
            department_id=nc_data.department_id,
            detected_at=nc_data.detected_at,
            due_date=nc_data.due_date,
            status="open",
        )
        nc.assignees = personnel_list
        self.db.add(nc)
        self.db.commit()
        self.db.refresh(nc)
        return nc

    def get_non_conformity(self, nc_id: int) -> Optional[NonConformity]:
        """
        부적합 조회

        Args:
            nc_id: 부적합 ID

        Returns:
            NonConformity: 부적합 또는 None
        """
        return (
            self.db.query(NonConformity)
            .options(
                joinedload(NonConformity.audit_plan),
                joinedload(NonConformity.control_item),
                joinedload(NonConformity.responsible_person),
                joinedload(NonConformity.assignees),
                joinedload(NonConformity.corrective_actions),
            )
            .filter(NonConformity.id == nc_id)
            .first()
        )

    def update_non_conformity(
        self, nc_id: int, update_data: NonConformityUpdate
    ) -> Optional[NonConformity]:
        """
        부적합 수정

        Args:
            nc_id: 부적합 ID
            update_data: 수정 데이터

        Returns:
            NonConformity: 수정된 부적합
        """
        nc = self.get_non_conformity(nc_id)
        if not nc:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        person_ids = update_dict.pop("responsible_person_ids", None)
        for key, value in update_dict.items():
            if value is not None:
                if hasattr(value, "value"):
                    value = value.value
                setattr(nc, key, value)

        if person_ids is not None:
            personnel_list = (
                self.db.query(Personnel)
                .filter(Personnel.id.in_(person_ids))
                .all()
            )
            nc.assignees = personnel_list
            nc.responsible_person_id = person_ids[0] if person_ids else None

        self.db.commit()
        self.db.refresh(nc)
        return nc

    def list_non_conformities(
        self,
        page: int = 1,
        size: int = 10,
        audit_plan_id: Optional[int] = None,
        status: Optional[List[str]] = None,
        severity: Optional[str] = None,
        nc_type: Optional[str] = None,
        responsible_person_id: Optional[int] = None,
        due_date_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[NonConformity], int]:
        """
        부적합 목록 조회

        Args:
            page: 페이지 번호
            size: 페이지 크기
            audit_plan_id: 감사 계획 ID 필터
            status: 상태 필터 (복수 선택 가능)
            severity: 심각도 필터
            nc_type: 유형 필터
            responsible_person_id: 담당자 ID 필터
            due_date_filter: 기한 필터 (overdue: 기한 초과, upcoming: 7일 내 마감 예정)
            search: 제목/통제항목 코드 검색

        Returns:
            Tuple[List[NonConformity], int]: 부적합 목록, 전체 개수
        """
        query = self.db.query(NonConformity).options(
            joinedload(NonConformity.control_item),
            joinedload(NonConformity.responsible_person),
            joinedload(NonConformity.assignees),
        )

        # 필터 적용
        if audit_plan_id:
            query = query.filter(NonConformity.audit_plan_id == audit_plan_id)
        if status:
            if len(status) == 1:
                query = query.filter(NonConformity.status == status[0])
            else:
                query = query.filter(NonConformity.status.in_(status))
        if severity:
            query = query.filter(NonConformity.severity == severity)
        if nc_type:
            query = query.filter(NonConformity.nc_type == nc_type)
        if responsible_person_id:
            query = query.filter(
                NonConformity.responsible_person_id == responsible_person_id
            )
        if due_date_filter:
            today = date.today()
            if due_date_filter == "overdue":
                query = query.filter(
                    NonConformity.due_date < today,
                    NonConformity.status.in_(["open", "in_progress"]),
                )
            elif due_date_filter == "upcoming":
                query = query.filter(
                    NonConformity.due_date >= today,
                    NonConformity.due_date <= today + timedelta(days=7),
                    NonConformity.status.in_(["open", "in_progress"]),
                )
        if search:
            keyword = f"%{search}%"
            query = query.filter(
                or_(
                    NonConformity.title.ilike(keyword),
                    NonConformity.control_item.has(ControlItem.code.ilike(keyword)),
                )
            )

        total = query.count()

        ncs = (
            query.join(NonConformity.control_item).order_by(ControlItem.sort_order, ControlItem.code)
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        return ncs, total

    def get_non_conformity_history(
        self, control_item_id: int
    ) -> Optional[NonConformityHistory]:
        """
        부적합 이력 조회 (동일 통제항목 반복 지적 분석)

        Args:
            control_item_id: 통제항목 ID

        Returns:
            NonConformityHistory: 부적합 이력
        """
        # 해당 통제항목의 모든 부적합 조회
        ncs = (
            self.db.query(NonConformity)
            .filter(NonConformity.control_item_id == control_item_id)
            .order_by(desc(NonConformity.detected_at))
            .all()
        )

        if not ncs:
            return None

        # 통제항목 정보 조회
        control_item = (
            self.db.query(ControlItem).filter(ControlItem.id == control_item_id).first()
        )

        if not control_item:
            return None

        return NonConformityHistory(
            control_item_id=control_item_id,
            control_item_code=control_item.code,
            control_item_title=control_item.title,
            total_count=len(ncs),
            recent_non_conformities=[],  # API 레이어에서 변환
        )

    def get_repeat_non_conformities(
        self, threshold: int = 2
    ) -> List[Dict[str, Any]]:
        """
        반복 지적 통제항목 분석

        Args:
            threshold: 반복 기준 (기본 2회 이상)

        Returns:
            List[Dict]: 반복 지적된 통제항목 목록
        """
        # 통제항목별 부적합 건수 집계
        results = (
            self.db.query(
                NonConformity.control_item_id,
                func.count(NonConformity.id).label("count"),
            )
            .group_by(NonConformity.control_item_id)
            .having(func.count(NonConformity.id) >= threshold)
            .all()
        )

        repeat_items = []
        for control_item_id, count in results:
            control_item = (
                self.db.query(ControlItem)
                .filter(ControlItem.id == control_item_id)
                .first()
            )
            if control_item:
                repeat_items.append(
                    {
                        "control_item_id": control_item_id,
                        "control_item_code": control_item.code,
                        "control_item_title": control_item.title,
                        "non_conformity_count": count,
                    }
                )

        return repeat_items

    # ========== 시정조치 워크플로우 ==========

    def create_corrective_action(
        self, nc_id: int, ca_data: CorrectiveActionCreate
    ) -> CorrectiveAction:
        """
        시정조치 요청

        Args:
            nc_id: 부적합 ID
            ca_data: 시정조치 생성 데이터

        Returns:
            CorrectiveAction: 생성된 시정조치
        """
        personnel_list = (
            self.db.query(Personnel)
            .filter(Personnel.id.in_(ca_data.responsible_person_ids))
            .all()
        )
        ca = CorrectiveAction(
            non_conformity_id=nc_id,
            action_plan=ca_data.action_plan,
            root_cause=ca_data.root_cause,
            preventive_measures=ca_data.preventive_measures,
            responsible_person_id=ca_data.responsible_person_ids[0],
            planned_completion_date=ca_data.planned_completion_date,
            status="planned",
        )
        ca.assignees = personnel_list
        self.db.add(ca)
        self.db.commit()
        self.db.refresh(ca)
        return ca

    def get_corrective_action(self, ca_id: int) -> Optional[CorrectiveAction]:
        """
        시정조치 조회

        Args:
            ca_id: 시정조치 ID

        Returns:
            CorrectiveAction: 시정조치 또는 None
        """
        return (
            self.db.query(CorrectiveAction)
            .options(
                joinedload(CorrectiveAction.non_conformity),
                joinedload(CorrectiveAction.responsible_person),
                joinedload(CorrectiveAction.assignees),
                joinedload(CorrectiveAction.verifier),
            )
            .filter(CorrectiveAction.id == ca_id)
            .first()
        )

    def update_corrective_action(
        self, ca_id: int, update_data: CorrectiveActionUpdate
    ) -> Optional[CorrectiveAction]:
        """
        시정조치 계획/결과 등록

        Args:
            ca_id: 시정조치 ID
            update_data: 수정 데이터

        Returns:
            CorrectiveAction: 수정된 시정조치
        """
        ca = self.get_corrective_action(ca_id)
        if not ca:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        person_ids = update_dict.pop("responsible_person_ids", None)
        for key, value in update_dict.items():
            if value is not None:
                if hasattr(value, "value"):
                    value = value.value
                setattr(ca, key, value)

        if person_ids is not None:
            personnel_list = (
                self.db.query(Personnel)
                .filter(Personnel.id.in_(person_ids))
                .all()
            )
            ca.assignees = personnel_list
            ca.responsible_person_id = person_ids[0] if person_ids else None

        self.db.commit()
        self.db.refresh(ca)
        return ca

    def verify_corrective_action(
        self, ca_id: int, verify_data: CorrectiveActionVerify, verifier_id: int
    ) -> Optional[CorrectiveAction]:
        """
        시정조치 검증 및 종료

        Args:
            ca_id: 시정조치 ID
            verify_data: 검증 데이터
            verifier_id: 검증자 ID

        Returns:
            CorrectiveAction: 검증된 시정조치
        """
        ca = self.get_corrective_action(ca_id)
        if not ca:
            return None

        ca.verified_by = verifier_id
        ca.verified_at = datetime.utcnow()
        ca.verification_result = verify_data.verification_result.value
        ca.verification_comment = verify_data.verification_comment

        # 검증 결과에 따른 상태 변경
        if verify_data.verification_result.value == "approved":
            ca.status = "verified"
            # 부적합 상태도 종료로 변경
            nc = ca.non_conformity
            if nc:
                nc.status = "closed"
                nc.closed_at = date.today()
        else:
            # 반려 시 진행중으로 변경
            ca.status = "in_progress"

        self.db.commit()
        self.db.refresh(ca)
        return ca

    def list_corrective_actions(
        self,
        nc_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        size: int = 10,
    ) -> Tuple[List[CorrectiveAction], int]:
        """
        시정조치 목록 조회

        Args:
            nc_id: 부적합 ID 필터
            status: 상태 필터
            page: 페이지 번호
            size: 페이지 크기

        Returns:
            Tuple[List[CorrectiveAction], int]: 시정조치 목록, 전체 개수
        """
        query = self.db.query(CorrectiveAction).options(
            joinedload(CorrectiveAction.responsible_person),
            joinedload(CorrectiveAction.assignees),
        )

        if nc_id:
            query = query.filter(CorrectiveAction.non_conformity_id == nc_id)
        if status:
            query = query.filter(CorrectiveAction.status == status)

        total = query.count()

        cas = (
            query.order_by(desc(CorrectiveAction.created_at))
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )

        return cas, total

    # ========== 심사 대응 자료 패키지 ==========

    def calculate_d_day(self, plan_id: int) -> int:
        """
        심사일까지 D-Day 계산

        Args:
            plan_id: 감사 계획 ID

        Returns:
            int: D-Day (음수: 지남, 양수: 남음)
        """
        plan = self.get_audit_plan(plan_id)
        if not plan:
            return 0

        today = date.today()
        delta = plan.start_date - today
        return delta.days
