"""
자산 서비스
Phase 2: FR-501 ~ FR-505
자산 관리 비즈니스 로직
"""
import json
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, or_, and_, Integer
from sqlalchemy.orm import Session

from app.models.asset import (
    Asset, AssetType, AssetCategory, AssetValuation,
    AssetHistory, AssetDisposal, AssetAssignment, AssetHandover,
    AssetStatus, AssetAssignmentRole, AssetChangeType,
)
from app.models.user import User
from app.models.department import Department
from app.schemas.notification import NotificationType, NotificationPriority


def utc_now():
    """UTC 현재 시간 반환"""
    return datetime.now(timezone.utc)


class AssetService:
    """
    자산 서비스

    기능:
    - 자산 유형/분류 CRUD
    - 자산 CRUD
    - 자산코드 자동 채번
    - CIA 평가 및 중요도 계산
    - 자산 이력 자동 기록
    - 담당자 할당 및 변경 처리
    - 엑셀 임포트/내보내기
    - 자산 폐기 처리
    - 통계 조회
    """

    def __init__(self, db: Session, notification_service=None):
        self.db = db
        self._notification_service = notification_service

    def set_notification_service(self, notification_service):
        """NotificationService 주입 (선택적)"""
        self._notification_service = notification_service

    def _send_assignment_notification(
        self,
        user_id: int,
        asset: Asset,
        notification_type: NotificationType,
        title: str,
        message: str,
    ) -> None:
        """담당자 관련 알림 발송 (내부 메서드)"""
        if self._notification_service is None:
            return  # NotificationService가 없으면 알림 생략

        try:
            self._notification_service.create_notification(
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                priority=NotificationPriority.NORMAL,
                link_url=f"/assets/{asset.id}",
                reference_type="asset",
                reference_id=asset.id,
            )
        except Exception:
            # 알림 실패해도 비즈니스 로직은 계속 진행
            pass

    # =========================================================================
    # 자산 유형 관리 (FR-501)
    # =========================================================================

    def get_asset_types(
        self,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[AssetType], int]:
        """자산 유형 목록 조회"""
        query = self.db.query(AssetType)
        if is_active is not None:
            query = query.filter(AssetType.is_active == is_active)
        query = query.order_by(AssetType.sort_order, AssetType.code)
        items = query.all()
        return items, len(items)

    def get_asset_type_by_id(self, type_id: int) -> Optional[AssetType]:
        """자산 유형 ID로 조회"""
        return self.db.query(AssetType).filter(AssetType.id == type_id).first()

    def get_asset_type_by_code(self, code: str) -> Optional[AssetType]:
        """자산 유형 코드로 조회"""
        return self.db.query(AssetType).filter(AssetType.code == code).first()

    def create_asset_type(
        self,
        code: str,
        name: str,
        description: Optional[str] = None,
        icon: Optional[str] = None,
        sort_order: int = 0,
    ) -> AssetType:
        """자산 유형 생성"""
        # 코드 중복 체크
        existing = self.get_asset_type_by_code(code)
        if existing:
            raise ValueError(f"이미 존재하는 자산 유형 코드입니다: {code}")

        asset_type = AssetType(
            code=code,
            name=name,
            description=description,
            icon=icon,
            is_custom=True,  # 사용자 생성은 커스텀
            is_active=True,
            sort_order=sort_order,
        )
        self.db.add(asset_type)
        self.db.commit()
        self.db.refresh(asset_type)
        return asset_type

    def update_asset_type(
        self,
        type_id: int,
        **kwargs,
    ) -> AssetType:
        """자산 유형 수정"""
        asset_type = self.get_asset_type_by_id(type_id)
        if not asset_type:
            raise ValueError("자산 유형을 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if value is not None and hasattr(asset_type, key):
                setattr(asset_type, key, value)

        self.db.commit()
        self.db.refresh(asset_type)
        return asset_type

    # =========================================================================
    # 자산 분류 관리 (FR-501)
    # =========================================================================

    def get_asset_categories(
        self,
        parent_id: Optional[int] = None,
        level: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[List[AssetCategory], int]:
        """자산 분류 목록 조회"""
        query = self.db.query(AssetCategory)
        if parent_id is not None:
            query = query.filter(AssetCategory.parent_id == parent_id)
        if level is not None:
            query = query.filter(AssetCategory.level == level)
        if is_active is not None:
            query = query.filter(AssetCategory.is_active == is_active)
        query = query.order_by(AssetCategory.level, AssetCategory.sort_order, AssetCategory.code)
        items = query.all()
        return items, len(items)

    def get_asset_category_by_id(self, category_id: int) -> Optional[AssetCategory]:
        """자산 분류 ID로 조회"""
        return self.db.query(AssetCategory).filter(AssetCategory.id == category_id).first()

    def get_asset_category_by_code(self, code: str) -> Optional[AssetCategory]:
        """자산 분류 코드로 조회"""
        return self.db.query(AssetCategory).filter(AssetCategory.code == code).first()

    def create_asset_category(
        self,
        code: str,
        name: str,
        level: int = 1,
        parent_id: Optional[int] = None,
        description: Optional[str] = None,
        sort_order: int = 0,
    ) -> AssetCategory:
        """자산 분류 생성"""
        # 코드 중복 체크
        existing = self.get_asset_category_by_code(code)
        if existing:
            raise ValueError(f"이미 존재하는 분류 코드입니다: {code}")

        # 레벨 검증
        if level > AssetCategory.MAX_LEVEL:
            raise ValueError(f"분류 레벨은 {AssetCategory.MAX_LEVEL}을 초과할 수 없습니다.")

        # 부모 검증
        if parent_id:
            parent = self.get_asset_category_by_id(parent_id)
            if not parent:
                raise ValueError("상위 분류를 찾을 수 없습니다.")
            if parent.level >= level:
                raise ValueError("상위 분류의 레벨보다 높은 레벨이어야 합니다.")

        category = AssetCategory(
            code=code,
            name=name,
            description=description,
            level=level,
            parent_id=parent_id,
            is_active=True,
            sort_order=sort_order,
        )
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def update_asset_category(
        self,
        category_id: int,
        **kwargs,
    ) -> AssetCategory:
        """자산 분류 수정"""
        category = self.get_asset_category_by_id(category_id)
        if not category:
            raise ValueError("자산 분류를 찾을 수 없습니다.")

        for key, value in kwargs.items():
            if value is not None and hasattr(category, key):
                setattr(category, key, value)

        self.db.commit()
        self.db.refresh(category)
        return category

    # =========================================================================
    # 자산 CRUD (FR-502)
    # =========================================================================

    def generate_asset_code(self, asset_type_code: str) -> str:
        """
        자산코드 자동 채번
        형식: AST-{유형코드}-{년월}-{순번}
        예: AST-SRV-202501-001
        """
        now = datetime.now()
        year_month = now.strftime("%Y%m")
        prefix = f"AST-{asset_type_code}-{year_month}-"

        # 해당 월의 최대 순번 조회
        max_code = (
            self.db.query(Asset.asset_code)
            .filter(Asset.asset_code.like(f"{prefix}%"))
            .order_by(Asset.asset_code.desc())
            .first()
        )

        if max_code:
            try:
                last_seq = int(max_code[0].split("-")[-1])
                new_seq = last_seq + 1
            except (ValueError, IndexError):
                new_seq = 1
        else:
            new_seq = 1

        return f"{prefix}{new_seq:03d}"

    def create_asset(
        self,
        name: str,
        asset_type_id: int,
        user_id: int,
        **kwargs,
    ) -> Asset:
        """자산 생성"""
        # 자산 유형 확인
        asset_type = self.get_asset_type_by_id(asset_type_id)
        if not asset_type:
            raise ValueError("자산 유형을 찾을 수 없습니다.")

        # 자산코드 자동 채번
        asset_code = self.generate_asset_code(asset_type.code)

        # specifications JSON 변환 (크기 제한 5KB)
        specs = kwargs.pop("specifications", None)
        if specs and isinstance(specs, dict):
            specs_json = json.dumps(specs, ensure_ascii=False)
            if len(specs_json) > 5000:
                raise ValueError("사양 정보가 너무 깁니다 (최대 5000자)")
            specs = specs_json

        asset = Asset(
            asset_code=asset_code,
            name=name,
            asset_type_id=asset_type_id,
            status=AssetStatus.INTRODUCED.value,
            is_active=True,
            **kwargs,
        )
        if specs:
            asset.specifications = specs

        self.db.add(asset)
        self.db.flush()

        # 생성 이력 기록
        self._record_history(
            asset_id=asset.id,
            change_type=AssetChangeType.CREATE.value,
            changed_by=user_id,
            new_value=f"자산 생성: {name}",
        )

        self.db.commit()
        self.db.refresh(asset)
        return asset

    def get_asset_by_id(self, asset_id: int) -> Optional[Asset]:
        """자산 ID로 조회"""
        return self.db.query(Asset).filter(Asset.id == asset_id).first()

    def get_asset_by_code(self, asset_code: str) -> Optional[Asset]:
        """자산 코드로 조회"""
        return self.db.query(Asset).filter(Asset.asset_code == asset_code).first()

    def update_asset(
        self,
        asset_id: int,
        user_id: int,
        **kwargs,
    ) -> Asset:
        """자산 수정"""
        asset = self.get_asset_by_id(asset_id)
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다.")

        # 변경 이력 기록을 위한 이전 값 저장
        changes = []
        for key, value in kwargs.items():
            if value is not None and hasattr(asset, key):
                old_value = getattr(asset, key)
                if old_value != value:
                    changes.append({
                        "field_name": key,
                        "old_value": str(old_value) if old_value else None,
                        "new_value": str(value),
                    })
                    setattr(asset, key, value)

        if changes:
            # 상태 변경 시 status도 "변경"으로
            if "status" not in kwargs:
                if asset.status == AssetStatus.OPERATING.value:
                    asset.status = AssetStatus.CHANGED.value

            # 변경 이력 기록
            for change in changes:
                self._record_history(
                    asset_id=asset.id,
                    change_type=AssetChangeType.UPDATE.value,
                    changed_by=user_id,
                    field_name=change["field_name"],
                    old_value=change["old_value"],
                    new_value=change["new_value"],
                )

        self.db.commit()
        self.db.refresh(asset)
        return asset

    def delete_asset(self, asset_id: int, user_id: int) -> Asset:
        """자산 비활성화 (소프트 삭제)"""
        asset = self.get_asset_by_id(asset_id)
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다.")

        asset.is_active = False
        self._record_history(
            asset_id=asset.id,
            change_type=AssetChangeType.DELETE.value,
            changed_by=user_id,
            old_value="active",
            new_value="inactive",
        )

        self.db.commit()
        self.db.refresh(asset)
        return asset

    def search_assets(
        self,
        search: Optional[str] = None,
        asset_type_id: Optional[int] = None,
        category_id: Optional[int] = None,
        department_id: Optional[int] = None,
        status: Optional[str] = None,
        is_active: Optional[bool] = True,
        importance_level: Optional[int] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict:
        """자산 검색 및 필터링"""
        query = self.db.query(Asset)

        # 검색어 필터 (LIKE 와일드카드 이스케이프 처리)
        if search:
            # SQL injection 방지를 위한 와일드카드 이스케이프
            escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            search_term = f"%{escaped_search}%"
            query = query.filter(
                or_(
                    Asset.name.ilike(search_term, escape="\\"),
                    Asset.asset_code.ilike(search_term, escape="\\"),
                    Asset.description.ilike(search_term, escape="\\"),
                    Asset.ip_address.ilike(search_term, escape="\\"),
                    Asset.hostname.ilike(search_term, escape="\\"),
                )
            )

        # 필터
        if asset_type_id is not None:
            query = query.filter(Asset.asset_type_id == asset_type_id)
        if category_id is not None:
            query = query.filter(Asset.category_id == category_id)
        if department_id is not None:
            query = query.filter(Asset.department_id == department_id)
        if status is not None:
            query = query.filter(Asset.status == status)
        if is_active is not None:
            query = query.filter(Asset.is_active == is_active)

        # 중요도 필터 (최신 가치평가 기준)
        if importance_level is not None:
            subquery = (
                self.db.query(
                    AssetValuation.asset_id,
                    func.max(AssetValuation.id).label("max_id")
                )
                .group_by(AssetValuation.asset_id)
                .subquery()
            )
            query = (
                query
                .join(subquery, Asset.id == subquery.c.asset_id)
                .join(AssetValuation, AssetValuation.id == subquery.c.max_id)
                .filter(AssetValuation.importance_level == importance_level)
            )

        # 전체 개수
        total = query.count()

        # 페이지네이션
        offset = (page - 1) * size
        items = (
            query
            .order_by(Asset.created_at.desc())
            .offset(offset)
            .limit(size)
            .all()
        )

        pages = (total + size - 1) // size

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    # =========================================================================
    # 자산 가치 평가 (FR-503)
    # =========================================================================

    def create_valuation(
        self,
        asset_id: int,
        confidentiality: int,
        integrity: int,
        availability: int,
        user_id: int,
        evaluation_reason: Optional[str] = None,
    ) -> AssetValuation:
        """자산 가치 평가 생성"""
        asset = self.get_asset_by_id(asset_id)
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다.")

        # CIA 범위 검증 (1-3)
        for name, value in [("기밀성", confidentiality), ("무결성", integrity), ("가용성", availability)]:
            if not (1 <= value <= 3):
                raise ValueError(f"{name}은 1-3 사이의 값이어야 합니다.")

        # 중요도 자동 계산 (MAX 방식)
        importance_level = max(confidentiality, integrity, availability)

        valuation = AssetValuation(
            asset_id=asset_id,
            confidentiality=confidentiality,
            integrity=integrity,
            availability=availability,
            importance_level=importance_level,
            evaluation_reason=evaluation_reason,
            evaluated_by=user_id,
            evaluated_at=utc_now(),
        )
        self.db.add(valuation)

        # 평가 이력 기록
        self._record_history(
            asset_id=asset_id,
            change_type=AssetChangeType.VALUATION.value,
            changed_by=user_id,
            new_value=f"C:{confidentiality}, I:{integrity}, A:{availability} -> 중요도:{importance_level}",
        )

        self.db.commit()
        self.db.refresh(valuation)
        return valuation

    def get_current_valuation(self, asset_id: int) -> Optional[AssetValuation]:
        """현재 (최신) 가치 평가 조회"""
        return (
            self.db.query(AssetValuation)
            .filter(AssetValuation.asset_id == asset_id)
            .order_by(AssetValuation.id.desc())
            .first()
        )

    def get_valuation_history(self, asset_id: int) -> List[AssetValuation]:
        """가치 평가 이력 조회"""
        return (
            self.db.query(AssetValuation)
            .filter(AssetValuation.asset_id == asset_id)
            .order_by(AssetValuation.created_at.desc())
            .all()
        )

    # =========================================================================
    # 자산 이력 관리 (FR-504)
    # =========================================================================

    def _record_history(
        self,
        asset_id: int,
        change_type: str,
        changed_by: int,
        field_name: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        remarks: Optional[str] = None,
    ) -> AssetHistory:
        """자산 변경 이력 기록 (내부 메서드)"""
        history = AssetHistory(
            asset_id=asset_id,
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=utc_now(),
            remarks=remarks,
        )
        self.db.add(history)
        return history

    def get_asset_history(self, asset_id: int) -> List[AssetHistory]:
        """자산 변경 이력 조회"""
        return (
            self.db.query(AssetHistory)
            .filter(AssetHistory.asset_id == asset_id)
            .order_by(AssetHistory.changed_at.desc())
            .all()
        )

    def dispose_asset(
        self,
        asset_id: int,
        user_id: int,
        disposal_date: date,
        disposal_reason: Optional[str] = None,
        disposal_method: Optional[str] = None,
        data_deletion_confirmed: bool = False,
        data_deletion_method: Optional[str] = None,
        data_deletion_evidence_id: Optional[int] = None,
        remarks: Optional[str] = None,
    ) -> Asset:
        """자산 폐기 처리"""
        asset = self.get_asset_by_id(asset_id)
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다.")

        # 폐기 정보 저장
        disposal = AssetDisposal(
            asset_id=asset_id,
            disposal_date=disposal_date,
            disposal_reason=disposal_reason,
            disposal_method=disposal_method,
            data_deletion_confirmed=data_deletion_confirmed,
            data_deletion_method=data_deletion_method,
            data_deletion_evidence_id=data_deletion_evidence_id,
            approved_by=user_id,
            approved_at=utc_now(),
            remarks=remarks,
        )
        self.db.add(disposal)

        # 자산 상태 변경
        asset.status = AssetStatus.DISPOSED.value
        asset.disposal_date = disposal_date
        asset.is_active = False

        # 이력 기록
        self._record_history(
            asset_id=asset_id,
            change_type=AssetChangeType.DELETE.value,
            changed_by=user_id,
            old_value=asset.status,
            new_value=AssetStatus.DISPOSED.value,
            remarks=f"폐기 사유: {disposal_reason}",
        )

        self.db.commit()
        self.db.refresh(asset)
        return asset

    def get_lifecycle_stats(self) -> Dict:
        """자산 생명주기 통계"""
        # 상태별 개수
        status_counts = (
            self.db.query(Asset.status, func.count(Asset.id))
            .filter(Asset.is_active == True)
            .group_by(Asset.status)
            .all()
        )
        by_status = {status: count for status, count in status_counts}

        # 이번 달 도입/폐기
        today = date.today()
        first_day = today.replace(day=1)

        introduced_this_month = (
            self.db.query(func.count(Asset.id))
            .filter(
                Asset.created_at >= first_day,
                Asset.status == AssetStatus.INTRODUCED.value,
            )
            .scalar() or 0
        )

        disposed_this_month = (
            self.db.query(func.count(Asset.id))
            .filter(
                Asset.disposal_date >= first_day,
                Asset.status == AssetStatus.DISPOSED.value,
            )
            .scalar() or 0
        )

        total = sum(by_status.values())

        return {
            "by_status": by_status,
            "total": total,
            "introduced_this_month": introduced_this_month,
            "disposed_this_month": disposed_this_month,
        }

    # =========================================================================
    # 담당자 관리 (FR-505)
    # =========================================================================

    def create_assignment(
        self,
        asset_id: int,
        user_id: int,
        role: str,
        assigned_by: int,
        remarks: Optional[str] = None,
    ) -> AssetAssignment:
        """담당자 할당"""
        asset = self.get_asset_by_id(asset_id)
        if not asset:
            raise ValueError("자산을 찾을 수 없습니다.")

        # 사용자 또는 담당자 확인
        from app.models.personnel import Personnel
        user = self.db.query(User).filter(User.id == user_id).first()
        personnel_id = None
        assignee_name = None
        if not user:
            # 담당자(Personnel) 테이블에서 확인
            personnel = self.db.query(Personnel).filter(Personnel.id == user_id).first()
            if not personnel:
                raise ValueError("담당자를 찾을 수 없습니다.")
            personnel_id = personnel.id
            assignee_name = personnel.name
            # 연결된 시스템 계정이 있으면 해당 user_id도 설정
            if personnel.user_id:
                user_id = personnel.user_id
                user = self.db.query(User).filter(User.id == user_id).first()
            else:
                user_id = None  # 시스템 계정 없는 담당자
        else:
            assignee_name = user.name

        # 역할 검증
        valid_roles = [r.value for r in AssetAssignmentRole]
        if role not in valid_roles:
            raise ValueError(f"유효하지 않은 역할입니다. 허용값: {valid_roles}")

        assignment = AssetAssignment(
            asset_id=asset_id,
            user_id=user_id,
            personnel_id=personnel_id,
            role=role,
            assigned_by=assigned_by,
            assigned_at=utc_now(),
            is_active=True,
            remarks=remarks,
        )
        self.db.add(assignment)

        # 이력 기록
        self._record_history(
            asset_id=asset_id,
            change_type=AssetChangeType.ASSIGNMENT.value,
            changed_by=assigned_by,
            new_value=f"담당자 할당: {assignee_name} ({role})",
        )

        self.db.commit()
        self.db.refresh(assignment)

        # 담당자에게 알림 발송 (FR-505 3.7.5)
        role_name = {"owner": "소유자", "manager": "관리자", "user": "사용자"}.get(role, role)
        self._send_assignment_notification(
            user_id=user_id,
            asset=asset,
            notification_type=NotificationType.ASSET_ASSIGNED,
            title="자산 담당자 지정",
            message=f"자산 '{asset.name}'의 {role_name}로 지정되었습니다.",
        )

        return assignment

    def get_assignments(self, asset_id: int) -> List[AssetAssignment]:
        """자산 담당자 목록 조회"""
        from sqlalchemy.orm import joinedload
        return (
            self.db.query(AssetAssignment)
            .options(
                joinedload(AssetAssignment.user),
                joinedload(AssetAssignment.personnel),
                joinedload(AssetAssignment.assigner),
            )
            .filter(
                AssetAssignment.asset_id == asset_id,
                AssetAssignment.is_active == True,
            )
            .order_by(AssetAssignment.role, AssetAssignment.assigned_at)
            .all()
        )

    def update_assignment(
        self,
        assignment_id: int,
        user_id: int,
        **kwargs,
    ) -> AssetAssignment:
        """담당자 할당 수정"""
        assignment = (
            self.db.query(AssetAssignment)
            .filter(AssetAssignment.id == assignment_id)
            .first()
        )
        if not assignment:
            raise ValueError("담당자 할당 정보를 찾을 수 없습니다.")

        # 기존 담당자 정보 저장 (알림용)
        old_user_id = assignment.user_id
        new_user_id = kwargs.get("user_id")
        asset = self.get_asset_by_id(assignment.asset_id)

        for key, value in kwargs.items():
            if value is not None and hasattr(assignment, key):
                setattr(assignment, key, value)

        # 이력 기록
        self._record_history(
            asset_id=assignment.asset_id,
            change_type=AssetChangeType.ASSIGNMENT.value,
            changed_by=user_id,
            new_value=f"담당자 정보 변경: {assignment.user_id}",
        )

        self.db.commit()
        self.db.refresh(assignment)

        # 담당자 변경 시 알림 발송 (FR-505 3.7.5)
        if new_user_id and new_user_id != old_user_id and asset:
            # 새 담당자에게 알림
            self._send_assignment_notification(
                user_id=new_user_id,
                asset=asset,
                notification_type=NotificationType.ASSET_ASSIGNED,
                title="자산 담당자 지정",
                message=f"자산 '{asset.name}'의 담당자로 지정되었습니다.",
            )
            # 기존 담당자에게 알림
            self._send_assignment_notification(
                user_id=old_user_id,
                asset=asset,
                notification_type=NotificationType.ASSET_ASSIGNMENT_CHANGED,
                title="자산 담당자 변경",
                message=f"자산 '{asset.name}'의 담당자가 변경되었습니다.",
            )

        return assignment

    def delete_assignment(
        self,
        assignment_id: int,
        user_id: int,
    ) -> None:
        """담당자 해제 (비활성화)"""
        assignment = (
            self.db.query(AssetAssignment)
            .filter(AssetAssignment.id == assignment_id)
            .first()
        )
        if not assignment:
            raise ValueError("담당자 할당 정보를 찾을 수 없습니다.")

        # 알림용 정보 저장
        asset = self.get_asset_by_id(assignment.asset_id)
        assignee_user_id = assignment.user_id

        assignment.is_active = False

        # 이력 기록
        self._record_history(
            asset_id=assignment.asset_id,
            change_type=AssetChangeType.ASSIGNMENT.value,
            changed_by=user_id,
            old_value=f"담당자: {assignment.user_id}",
            new_value="해제",
        )

        self.db.commit()

        # 담당 해제된 사용자에게 알림 (FR-505 3.7.5)
        if asset:
            self._send_assignment_notification(
                user_id=assignee_user_id,
                asset=asset,
                notification_type=NotificationType.ASSET_ASSIGNMENT_CHANGED,
                title="자산 담당 해제",
                message=f"자산 '{asset.name}'의 담당자에서 해제되었습니다.",
            )

    def get_handover_history(self, asset_id: int) -> List[AssetHandover]:
        """인수인계 이력 조회"""
        return (
            self.db.query(AssetHandover)
            .filter(AssetHandover.asset_id == asset_id)
            .order_by(AssetHandover.handover_date.desc())
            .all()
        )

    # =========================================================================
    # 통계 (FR-502)
    # =========================================================================

    def get_stats(self) -> Dict:
        """전체 자산 통계"""
        total_count = self.db.query(func.count(Asset.id)).scalar() or 0
        active_count = (
            self.db.query(func.count(Asset.id))
            .filter(Asset.is_active == True)
            .scalar() or 0
        )

        # 상태별
        status_counts = (
            self.db.query(Asset.status, func.count(Asset.id))
            .group_by(Asset.status)
            .all()
        )
        by_status = {status: count for status, count in status_counts}

        # 중요도별 (최신 평가 기준)
        importance_counts = {}
        for level in [1, 2, 3]:
            subquery = (
                self.db.query(
                    AssetValuation.asset_id,
                    func.max(AssetValuation.id).label("max_id")
                )
                .group_by(AssetValuation.asset_id)
                .subquery()
            )
            count = (
                self.db.query(func.count(Asset.id))
                .join(subquery, Asset.id == subquery.c.asset_id)
                .join(AssetValuation, AssetValuation.id == subquery.c.max_id)
                .filter(AssetValuation.importance_level == level)
                .scalar() or 0
            )
            importance_counts[level] = count

        # 최근 7일 추가/폐기
        week_ago = date.today() - timedelta(days=7)
        recent_added = (
            self.db.query(func.count(Asset.id))
            .filter(Asset.created_at >= week_ago)
            .scalar() or 0
        )
        recent_disposed = (
            self.db.query(func.count(Asset.id))
            .filter(
                Asset.disposal_date >= week_ago,
                Asset.status == AssetStatus.DISPOSED.value,
            )
            .scalar() or 0
        )

        return {
            "total_count": total_count,
            "active_count": active_count,
            "by_status": by_status,
            "by_importance": importance_counts,
            "recent_added": recent_added,
            "recent_disposed": recent_disposed,
        }

    def get_by_type(self) -> List[Dict]:
        """유형별 자산 통계"""
        results = (
            self.db.query(
                AssetType.id,
                AssetType.code,
                AssetType.name,
                func.count(Asset.id).label("count"),
                func.sum(func.cast(Asset.is_active, Integer)).label("active_count"),
            )
            .outerjoin(Asset, Asset.asset_type_id == AssetType.id)
            .group_by(AssetType.id, AssetType.code, AssetType.name)
            .all()
        )

        return [
            {
                "type_id": r.id,
                "type_code": r.code,
                "type_name": r.name,
                "count": r.count or 0,
                "active_count": r.active_count or 0,
            }
            for r in results
        ]

    def get_by_department(self) -> List[Dict]:
        """부서별 자산 통계"""
        results = (
            self.db.query(
                Department.id,
                Department.name,
                func.count(Asset.id).label("count"),
            )
            .outerjoin(Asset, Asset.department_id == Department.id)
            .group_by(Department.id, Department.name)
            .all()
        )

        return [
            {
                "department_id": r.id,
                "department_name": r.name,
                "count": r.count or 0,
                "by_importance": {},  # TODO: 추후 구현
            }
            for r in results
        ]

    def get_by_importance(self) -> List[Dict]:
        """중요도별 자산 통계"""
        total = self.db.query(func.count(Asset.id)).filter(Asset.is_active == True).scalar() or 1
        labels = {1: "하", 2: "중", 3: "상"}

        results = []
        for level in [1, 2, 3]:
            subquery = (
                self.db.query(
                    AssetValuation.asset_id,
                    func.max(AssetValuation.id).label("max_id")
                )
                .group_by(AssetValuation.asset_id)
                .subquery()
            )
            count = (
                self.db.query(func.count(Asset.id))
                .join(subquery, Asset.id == subquery.c.asset_id)
                .join(AssetValuation, AssetValuation.id == subquery.c.max_id)
                .filter(
                    AssetValuation.importance_level == level,
                    Asset.is_active == True,
                )
                .scalar() or 0
            )
            results.append({
                "importance_level": level,
                "label": labels[level],
                "count": count,
                "percentage": round(count / total * 100, 1) if total > 0 else 0,
            })

        return results

    # =========================================================================
    # 엑셀 임포트/내보내기 (FR-502)
    # =========================================================================

    def export_assets(self, filters: Optional[Dict] = None) -> bytes:
        """자산 목록 엑셀 내보내기"""
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment
        except ImportError:
            raise ImportError("openpyxl 패키지가 필요합니다.")

        # 자산 조회
        search_result = self.search_assets(**(filters or {}), page=1, size=10000)
        assets = search_result["items"]

        wb = Workbook()
        ws = wb.active
        ws.title = "자산 목록"

        # 헤더 스타일
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")

        # 헤더
        headers = [
            "자산코드", "자산명", "자산유형", "분류", "위치", "부서",
            "IP주소", "호스트명", "제조사", "모델", "상태", "중요도",
            "취득일", "취득비용"
        ]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")

        # 데이터
        for row, asset in enumerate(assets, 2):
            valuation = self.get_current_valuation(asset.id)
            ws.cell(row=row, column=1, value=asset.asset_code)
            ws.cell(row=row, column=2, value=asset.name)
            ws.cell(row=row, column=3, value=asset.asset_type.name if asset.asset_type else "")
            ws.cell(row=row, column=4, value=asset.category.name if asset.category else "")
            ws.cell(row=row, column=5, value=asset.location or "")
            ws.cell(row=row, column=6, value=asset.department.name if asset.department else "")
            ws.cell(row=row, column=7, value=asset.ip_address or "")
            ws.cell(row=row, column=8, value=asset.hostname or "")
            ws.cell(row=row, column=9, value=asset.manufacturer or "")
            ws.cell(row=row, column=10, value=asset.model or "")
            ws.cell(row=row, column=11, value=asset.status)
            ws.cell(row=row, column=12, value=valuation.importance_level if valuation else "")
            ws.cell(row=row, column=13, value=str(asset.acquisition_date) if asset.acquisition_date else "")
            ws.cell(row=row, column=14, value=asset.acquisition_cost or "")

        # 열 너비 조정
        for col in range(1, len(headers) + 1):
            ws.column_dimensions[chr(64 + col)].width = 15

        # 바이트로 반환
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output.read()

    def get_import_template(self) -> bytes:
        """자산 임포트 템플릿 생성"""
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            from openpyxl.worksheet.datavalidation import DataValidation
        except ImportError:
            raise ImportError("openpyxl 패키지가 필요합니다.")

        wb = Workbook()
        ws = wb.active
        ws.title = "자산 임포트"

        # 헤더 스타일
        header_font = Font(bold=True, color="FFFFFF")
        required_font = Font(bold=True, color="000000")
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        required_fill = PatternFill(start_color="FF6B6B", end_color="FF6B6B", fill_type="solid")
        required_font_white = Font(bold=True, color="FFFFFF")
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin'),
        )

        # 헤더 (필수 항목 표시)
        headers = [
            ("자산코드", False),
            ("자산명 (필수)", True),
            ("자산유형코드 (필수)", True),
            ("분류코드", False),
            ("위치", False),
            ("부서코드", False),
            ("IP주소", False),
            ("호스트명", False),
            ("시리얼번호", False),
            ("제조사", False),
            ("모델", False),
            ("상태", False),
            ("중요도", False),
        ]

        for col, (header, required) in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = required_font_white if required else header_font
            cell.fill = required_fill if required else header_fill
            cell.alignment = Alignment(horizontal="center")
            cell.border = border

        # 자산 유형 코드 목록 (데이터 검증용)
        asset_types, _ = self.get_asset_types(is_active=True)
        if asset_types:
            type_codes = ",".join([t.code for t in asset_types])
            dv = DataValidation(type="list", formula1=f'"{type_codes}"', allow_blank=False)
            dv.error = "유효한 자산 유형 코드를 선택하세요."
            dv.errorTitle = "입력 오류"
            ws.add_data_validation(dv)
            dv.add("C2:C1000")

        # 안내 행 (row 2) - 회색 배경
        guide_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
        guide_font = Font(color="888888", italic=True, size=9)
        guides = [
            "비워두면 자동생성",
            "필수",
            "필수 (예: SRV, PC)",
            "분류 코드",
            "물리적 위치",
            "부서 코드",
            "예: 192.168.1.1",
            "예: web-srv-01",
            "",
            "",
            "",
            "도입/운영/폐기",
            "1~5",
        ]
        for col, guide in enumerate(guides, 1):
            cell = ws.cell(row=2, column=col, value=guide)
            cell.font = guide_font
            cell.fill = guide_fill

        # 예시 데이터 (row 3)
        ws.cell(row=3, column=1, value="")
        ws.cell(row=3, column=2, value="웹서버-01")
        ws.cell(row=3, column=3, value="SRV")
        ws.cell(row=3, column=5, value="서버실")
        ws.cell(row=3, column=7, value="192.168.1.100")
        ws.cell(row=3, column=8, value="web-server-01")

        # 데이터 검증 범위 수정 (row 3부터)
        if asset_types:
            dv2 = DataValidation(type="list", formula1=f'"{type_codes}"', allow_blank=False)
            dv2.error = "유효한 자산 유형 코드를 선택하세요."
            dv2.errorTitle = "입력 오류"
            ws.add_data_validation(dv2)
            dv2.add("C3:C1000")

        # 열 너비 조정
        column_widths = [22, 18, 20, 12, 15, 12, 18, 18, 15, 12, 12, 12, 10]
        for col, width in enumerate(column_widths, 1):
            ws.column_dimensions[chr(64 + col)].width = width

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output.read()

    def import_assets(
        self,
        file_content: bytes,
        user_id: int,
    ) -> Dict:
        """자산 엑셀 임포트"""
        try:
            from openpyxl import load_workbook
        except ImportError:
            raise ImportError("openpyxl 패키지가 필요합니다.")

        wb = load_workbook(BytesIO(file_content))
        ws = wb.active

        results = {
            "total": 0,
            "success": 0,
            "failed": 0,
            "errors": [],
        }

        for row_num in range(3, ws.max_row + 1):
            # 빈 행 무시
            asset_code = ws.cell(row=row_num, column=1).value
            name = ws.cell(row=row_num, column=2).value
            type_code = ws.cell(row=row_num, column=3).value

            if not name and not type_code and not asset_code:
                continue

            results["total"] += 1

            try:
                if not name or not type_code:
                    results["failed"] += 1
                    results["errors"].append({
                        "row": row_num,
                        "error": "자산명과 자산유형코드는 필수입니다."
                    })
                    continue

                # 자산 유형 조회
                asset_type = self.get_asset_type_by_code(str(type_code).strip())
                if not asset_type:
                    results["failed"] += 1
                    results["errors"].append({
                        "row": row_num,
                        "error": f"존재하지 않는 자산 유형 코드입니다: {type_code}"
                    })
                    continue

                # 부서 조회
                dept_code = ws.cell(row=row_num, column=6).value
                department_id = None
                if dept_code:
                    dept = self.db.query(Department).filter(Department.code == str(dept_code).strip()).first()
                    if dept:
                        department_id = dept.id

                # 자산코드가 있으면 기존 자산 업데이트 시도
                if asset_code:
                    existing = self.db.query(Asset).filter(Asset.asset_code == str(asset_code).strip()).first()
                    if existing:
                        existing.name = str(name)
                        existing.asset_type_id = asset_type.id
                        if ws.cell(row=row_num, column=4).value:
                            existing.category_id = None  # TODO: resolve category
                        if ws.cell(row=row_num, column=5).value:
                            existing.location = str(ws.cell(row=row_num, column=5).value)
                        if department_id:
                            existing.department_id = department_id
                        if ws.cell(row=row_num, column=7).value:
                            existing.ip_address = str(ws.cell(row=row_num, column=7).value)
                        if ws.cell(row=row_num, column=8).value:
                            existing.hostname = str(ws.cell(row=row_num, column=8).value)
                        if ws.cell(row=row_num, column=9).value:
                            existing.serial_number = str(ws.cell(row=row_num, column=9).value)
                        if ws.cell(row=row_num, column=10).value:
                            existing.manufacturer = str(ws.cell(row=row_num, column=10).value)
                        if ws.cell(row=row_num, column=11).value:
                            existing.model = str(ws.cell(row=row_num, column=11).value)
                        self.db.commit()
                        results["success"] += 1
                        continue

                # 자산 생성 (자산코드 자동 생성)
                self.create_asset(
                    name=str(name),
                    asset_type_id=asset_type.id,
                    user_id=user_id,
                    location=ws.cell(row=row_num, column=5).value,
                    department_id=department_id,
                    ip_address=ws.cell(row=row_num, column=7).value,
                    hostname=ws.cell(row=row_num, column=8).value,
                    serial_number=ws.cell(row=row_num, column=9).value,
                    manufacturer=ws.cell(row=row_num, column=10).value,
                    model=ws.cell(row=row_num, column=11).value,
                )
                results["success"] += 1

            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "row": row_num,
                    "error": str(e)
                })

        return results


# Integer를 import해야 함 (SQLAlchemy)
from sqlalchemy import Integer
