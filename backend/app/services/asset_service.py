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
from app.models.personnel import Personnel
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

    def delete_asset_category(self, category_id: int) -> None:
        """자산 분류 삭제 (하위 분류가 있거나 자산에 연결된 경우 불가)"""
        category = self.get_asset_category_by_id(category_id)
        if not category:
            raise ValueError("자산 분류를 찾을 수 없습니다.")

        # 하위 분류 존재 여부 확인
        children_count = (
            self.db.query(AssetCategory)
            .filter(AssetCategory.parent_id == category_id)
            .count()
        )
        if children_count > 0:
            raise ValueError(
                f"하위 분류가 {children_count}개 존재합니다. 하위 분류를 먼저 삭제해주세요."
            )

        # 자산에 연결된 경우 확인
        if category.assets:
            raise ValueError(
                f"이 분류에 연결된 자산이 {len(category.assets)}개 있습니다. 자산의 분류를 먼저 변경해주세요."
            )

        self.db.delete(category)
        self.db.commit()

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

        # 다중 분류 처리
        category_ids = kwargs.pop("category_ids", None)

        # specifications JSON 변환 (크기 제한 5KB)
        specs = kwargs.pop("specifications", None)
        if specs and isinstance(specs, dict):
            specs_json = json.dumps(specs, ensure_ascii=False)
            if len(specs_json) > 5000:
                raise ValueError("사양 정보가 너무 깁니다 (최대 5000자)")
            specs = specs_json

        status = kwargs.pop("status", None) or AssetStatus.INTRODUCED.value

        asset = Asset(
            asset_code=asset_code,
            name=name,
            asset_type_id=asset_type_id,
            status=status,
            is_active=True,
            **kwargs,
        )
        if specs:
            asset.specifications = specs

        self.db.add(asset)
        self.db.flush()

        # 분류 매핑
        if category_ids:
            for cat_id in category_ids:
                cat = self.get_asset_category_by_id(cat_id)
                if cat:
                    asset.categories.append(cat)

        # 생성 이력 기록
        self._record_history(
            asset_id=asset.id,
            change_type=AssetChangeType.CREATE.value,
            changed_by=user_id,
            new_value=f"자산 생성: {name}",
        )

        # 소유자 지정 시 담당자 자동 할당
        if kwargs.get("personnel_owner_id"):
            self._sync_owner_assignment(asset.id, kwargs["personnel_owner_id"], user_id)

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

        # 다중 분류 처리
        category_ids = kwargs.pop("category_ids", None)

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

        # 분류 변경 처리
        if category_ids is not None:
            old_ids = sorted([c.id for c in asset.categories])
            new_ids = sorted(category_ids)
            if old_ids != new_ids:
                old_names = ", ".join(c.name for c in asset.categories) or None
                asset.categories = [
                    c for c_id in category_ids
                    if (c := self.get_asset_category_by_id(c_id))
                ]
                new_names = ", ".join(c.name for c in asset.categories) or None
                changes.append({
                    "field_name": "category_ids",
                    "old_value": old_names,
                    "new_value": new_names,
                })

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

        # personnel_owner_id 변경 시 담당자 탭의 "소유자" 역할 자동 동기화
        if "personnel_owner_id" in kwargs and kwargs["personnel_owner_id"]:
            personnel_id = kwargs["personnel_owner_id"]
            self._sync_owner_assignment(asset.id, personnel_id, user_id)

        self.db.commit()
        self.db.refresh(asset)
        return asset

    def _sync_owner_assignment(self, asset_id: int, personnel_id: int, assigned_by: int):
        """자산 소유자 변경 시 담당자 탭의 소유자 역할 자동 동기화"""
        from app.models.personnel import Personnel

        # 이미 동일 인물이 소유자 역할로 활성 할당되어 있으면 스킵
        existing_owners = (
            self.db.query(AssetAssignment)
            .filter(
                AssetAssignment.asset_id == asset_id,
                AssetAssignment.role == AssetAssignmentRole.OWNER.value,
                AssetAssignment.is_active == True,
            )
            .all()
        )

        already_assigned = any(
            o.personnel_id == personnel_id for o in existing_owners
        )
        if already_assigned:
            return

        # 기존 소유자 역할 비활성화
        for owner in existing_owners:
            owner.is_active = False

        # 새 소유자 담당자 할당 생성
        personnel = self.db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if personnel:
            new_assignment = AssetAssignment(
                asset_id=asset_id,
                personnel_id=personnel_id,
                user_id=personnel.user_id,
                role=AssetAssignmentRole.OWNER.value,
                assigned_by=assigned_by,
                assigned_at=utc_now(),
                is_active=True,
            )
            self.db.add(new_assignment)

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
        eol_status: Optional[str] = None,
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
            query = query.filter(Asset.categories.any(AssetCategory.id == category_id))
        if department_id is not None:
            query = query.filter(Asset.department_id == department_id)
        if status is not None:
            # 영문 상태값 → 한글 매핑 (프론트엔드 호환)
            status_map = {
                "introduced": AssetStatus.INTRODUCED.value,
                "operating": AssetStatus.OPERATING.value,
                "changed": AssetStatus.CHANGED.value,
                "disposed": AssetStatus.DISPOSED.value,
            }
            mapped_status = status_map.get(status, status)
            query = query.filter(Asset.status == mapped_status)
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

        # EoL 상태 필터
        if eol_status:
            from datetime import date, timedelta
            today = date.today()
            if eol_status == "expired":
                # EoL이 이미 지난 자산
                query = query.filter(
                    Asset.eol_date.isnot(None),
                    Asset.eol_date < today,
                )
            elif eol_status == "soon":
                # 90일 이내 EoL 예정
                query = query.filter(
                    Asset.eol_date.isnot(None),
                    Asset.eol_date >= today,
                    Asset.eol_date <= today + timedelta(days=90),
                )
            elif eol_status == "none":
                # EoL 미설정
                query = query.filter(Asset.eol_date.is_(None))

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

        # 중요도 자동 계산 (C+I+A 합산 방식)
        importance_score = confidentiality + integrity + availability
        if importance_score >= 8:
            importance_level = 3  # 상
        elif importance_score >= 6:
            importance_level = 2  # 중
        else:
            importance_level = 1  # 하

        valuation = AssetValuation(
            asset_id=asset_id,
            confidentiality=confidentiality,
            integrity=integrity,
            availability=availability,
            importance_score=importance_score,
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
            new_value=f"C:{confidentiality}, I:{integrity}, A:{availability} -> 점수:{importance_score}, 중요도:{importance_level}",
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

    def export_assets(self, filters: Optional[Dict] = None, include_data: bool = True) -> bytes:
        """자산 목록 엑셀 내보내기 (데이터 검증 드롭다운 포함)"""
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment
            from openpyxl.worksheet.datavalidation import DataValidation
            from openpyxl.utils import get_column_letter
        except ImportError:
            raise ImportError("openpyxl 패키지가 필요합니다.")

        # 자산 조회
        if include_data:
            search_result = self.search_assets(**(filters or {}), page=1, size=10000)
            assets = search_result["items"]
        else:
            assets = []

        wb = Workbook()
        ws = wb.active
        ws.title = "자산 목록"

        # ── 참조 시트 생성 (드롭다운 데이터 소스) ──
        ref_ws = wb.create_sheet(title="참조데이터")

        # 자산유형 목록
        asset_types, _ = self.get_asset_types(is_active=True)
        ref_ws.cell(row=1, column=1, value="자산유형코드")
        ref_ws.cell(row=1, column=2, value="자산유형명")
        type_code_list = []
        for i, at in enumerate(asset_types, 2):
            label = f"{at.code} ({at.name})"
            ref_ws.cell(row=i, column=1, value=label)
            ref_ws.cell(row=i, column=2, value=at.name)
            type_code_list.append(label)
        type_last_row = len(asset_types) + 1

        # 분류 목록 (소분류 level-3만, level-2는 level-3가 없을 때만 포함)
        all_categories = self.db.query(AssetCategory).filter(AssetCategory.is_active == True).order_by(AssetCategory.code).all()
        level3_cats = [c for c in all_categories if c.level == 3]
        level2_codes_with_children = set(c.code.rsplit('-', 1)[0] for c in level3_cats if '-' in c.code)
        level2_without_children = [c for c in all_categories if c.level == 2 and c.code not in level2_codes_with_children]
        selectable_cats = sorted(level3_cats + level2_without_children, key=lambda c: c.code)
        ref_ws.cell(row=1, column=3, value="분류코드")
        cat_list = []
        for i, cat in enumerate(selectable_cats, 2):
            # level-2의 부모 이름을 접두사로 표시
            parent_name = ""
            if cat.level == 3:
                parent = next((p for p in all_categories if p.id == cat.parent_id), None)
                if parent:
                    parent_name = f"{parent.name} > "
            label = f"{cat.code} ({parent_name}{cat.name})"
            ref_ws.cell(row=i, column=3, value=label)
            cat_list.append(label)
        cat_last_row = len(selectable_cats) + 1

        # 부서 목록
        departments = self.db.query(Department).order_by(Department.name).all()
        ref_ws.cell(row=1, column=4, value="부서코드")
        dept_list = []
        for i, dept in enumerate(departments, 2):
            label = f"{dept.code} ({dept.name})"
            ref_ws.cell(row=i, column=4, value=label)
            dept_list.append(label)
        dept_last_row = len(departments) + 1

        # 상태 목록
        statuses = ["도입", "운영", "변경", "폐기"]
        ref_ws.cell(row=1, column=5, value="상태")
        for i, s in enumerate(statuses, 2):
            ref_ws.cell(row=i, column=5, value=s)

        # CIA 평가 목록 (1:하, 2:중, 3:상)
        ref_ws.cell(row=1, column=6, value="CIA")
        for i, v in enumerate(["1 (하)", "2 (중)", "3 (상)"], 2):
            ref_ws.cell(row=i, column=6, value=v)

        # 소유자(담당자/Personnel) 목록
        personnel_list = self.db.query(Personnel).filter(Personnel.is_active == True).order_by(Personnel.name).all()
        ref_ws.cell(row=1, column=7, value="소유자")
        for i, p in enumerate(personnel_list, 2):
            label = p.name
            if p.department:
                label = f"{p.name} ({p.department.name})"
            ref_ws.cell(row=i, column=7, value=label)
        personnel_last_row = len(personnel_list) + 1

        ref_ws.sheet_state = "hidden"

        # ── 메인 시트: 헤더 ──
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
        required_fill = PatternFill(start_color="FF6B6B", end_color="FF6B6B", fill_type="solid")

        headers = [
            ("자산코드", False),     # A(1)
            ("자산명 ★", True),      # B(2)
            ("자산유형 ★", True),    # C(3)
            ("분류", False),          # D(4)
            ("위치", False),          # E(5)
            ("부서", False),          # F(6)
            ("소유자", False),        # G(7)
            ("담당자", False),        # H(8)
            ("IP주소", False),        # I(9)
            ("호스트명", False),      # J(10)
            ("제조사", False),        # K(11)
            ("모델", False),          # L(12)
            ("OS 버전", False),       # M(13)
            ("서비스 버전", False),   # N(14)
            ("상태", False),          # O(15)
            ("기밀성(C)", False),     # P(16)
            ("무결성(I)", False),     # Q(17)
            ("가용성(A)", False),     # R(18)
            ("취득일", False),        # S(19)
            ("취득비용", False),      # T(20)
            ("EoL 만료일", False),    # U(21)
            ("설명", False),          # V(22)
        ]
        for col, (header, required) in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = required_fill if required else header_fill
            cell.alignment = Alignment(horizontal="center")

        # ── 데이터 검증 (드롭다운) ──
        max_data_row = max(len(assets) + 1, 1000)

        # 자산유형 (C열) - 참조시트 A열
        if type_last_row > 1:
            dv_type = DataValidation(
                type="list",
                formula1=f"참조데이터!$A$2:$A${type_last_row}",
                allow_blank=True,
            )
            dv_type.error = "목록에서 자산유형을 선택하세요."
            dv_type.errorTitle = "자산유형 오류"
            dv_type.prompt = "자산유형을 선택하세요"
            dv_type.promptTitle = "자산유형"
            ws.add_data_validation(dv_type)
            dv_type.add(f"C2:C{max_data_row}")

        # 분류 (D열) - 참조시트 C열
        if cat_last_row > 1:
            dv_cat = DataValidation(
                type="list",
                formula1=f"참조데이터!$C$2:$C${cat_last_row}",
                allow_blank=True,
            )
            dv_cat.error = "목록에서 분류를 선택하세요."
            dv_cat.errorTitle = "분류 오류"
            dv_cat.prompt = "분류를 선택하세요"
            dv_cat.promptTitle = "분류"
            ws.add_data_validation(dv_cat)
            dv_cat.add(f"D2:D{max_data_row}")

        # 부서 (F열) - 참조시트 D열
        if dept_last_row > 1:
            dv_dept = DataValidation(
                type="list",
                formula1=f"참조데이터!$D$2:$D${dept_last_row}",
                allow_blank=True,
            )
            dv_dept.error = "목록에서 부서를 선택하세요."
            dv_dept.errorTitle = "부서 오류"
            dv_dept.prompt = "부서를 선택하세요"
            dv_dept.promptTitle = "부서"
            ws.add_data_validation(dv_dept)
            dv_dept.add(f"F2:F{max_data_row}")

        # 소유자 (G열) - 참조시트 G열 (Personnel 목록)
        if personnel_last_row > 1:
            dv_owner = DataValidation(
                type="list",
                formula1=f"참조데이터!$G$2:$G${personnel_last_row}",
                allow_blank=True,
            )
            dv_owner.error = "목록에서 소유자를 선택하세요."
            dv_owner.errorTitle = "소유자 오류"
            dv_owner.prompt = "소유자를 선택하세요"
            dv_owner.promptTitle = "소유자"
            ws.add_data_validation(dv_owner)
            dv_owner.add(f"G2:G{max_data_row}")

        # 담당자 (H열) - 쉼표 구분 이름 입력 (자산 할당 동기화)

        # 상태 (O열)
        dv_status = DataValidation(
            type="list",
            formula1=f"참조데이터!$E$2:$E$5",
            allow_blank=True,
        )
        dv_status.error = "도입/운영/변경/폐기 중 선택하세요."
        dv_status.errorTitle = "상태 오류"
        dv_status.prompt = "상태를 선택하세요"
        dv_status.promptTitle = "상태"
        ws.add_data_validation(dv_status)
        dv_status.add(f"O2:O{max_data_row}")

        # 기밀성(C) (P열) - 참조시트 F열
        dv_cia_c = DataValidation(
            type="list",
            formula1=f"참조데이터!$F$2:$F$4",
            allow_blank=True,
        )
        dv_cia_c.error = "1(하)/2(중)/3(상) 중 선택하세요."
        dv_cia_c.errorTitle = "기밀성 오류"
        dv_cia_c.prompt = "기밀성 등급을 선택하세요 (1:하, 2:중, 3:상)"
        dv_cia_c.promptTitle = "기밀성(C)"
        ws.add_data_validation(dv_cia_c)
        dv_cia_c.add(f"P2:P{max_data_row}")

        # 무결성(I) (Q열)
        dv_cia_i = DataValidation(
            type="list",
            formula1=f"참조데이터!$F$2:$F$4",
            allow_blank=True,
        )
        dv_cia_i.error = "1(하)/2(중)/3(상) 중 선택하세요."
        dv_cia_i.errorTitle = "무결성 오류"
        dv_cia_i.prompt = "무결성 등급을 선택하세요 (1:하, 2:중, 3:상)"
        dv_cia_i.promptTitle = "무결성(I)"
        ws.add_data_validation(dv_cia_i)
        dv_cia_i.add(f"Q2:Q{max_data_row}")

        # 가용성(A) (R열)
        dv_cia_a = DataValidation(
            type="list",
            formula1=f"참조데이터!$F$2:$F$4",
            allow_blank=True,
        )
        dv_cia_a.error = "1(하)/2(중)/3(상) 중 선택하세요."
        dv_cia_a.errorTitle = "가용성 오류"
        dv_cia_a.prompt = "가용성 등급을 선택하세요 (1:하, 2:중, 3:상)"
        dv_cia_a.promptTitle = "가용성(A)"
        ws.add_data_validation(dv_cia_a)
        dv_cia_a.add(f"R2:R{max_data_row}")

        # ── 예시 행 (빈 템플릿일 때만) ──
        data_start_row = 2
        if not include_data:
            example_font = Font(italic=True, color="888888")
            example_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
            example_type = type_code_list[0] if type_code_list else "SRV (서버)"
            # SRV에 맞는 level-3 분류 찾기
            example_cat = next((c for c in cat_list if c.startswith("HW-SRV-")), cat_list[0] if cat_list else "")
            example_dept = dept_list[0] if dept_list else ""
            example_owner = ""
            if personnel_list:
                p = personnel_list[0]
                example_owner = f"{p.name} ({p.department.name})" if p.department else p.name
            example_data = [
                "",                                          # A: 자산코드 (자동생성)
                "예시) 웹서버-01",                           # B: 자산명
                example_type,                                # C: 자산유형
                example_cat,                                 # D: 분류
                "서울 본사 3층",                              # E: 위치
                example_dept,                                # F: 부서
                example_owner,                               # G: 소유자
                "홍길동 (관리자), 김철수 (사용자)",           # H: 담당자
                "192.168.1.100",                             # I: IP주소
                "web-server-01",                             # J: 호스트명
                "Dell",                                      # K: 제조사
                "PowerEdge R740",                            # L: 모델
                "Ubuntu 22.04",                              # M: OS 버전
                "Apache 2.4",                                # N: 서비스 버전
                "운영",                                      # O: 상태
                "3 (상)",                                    # P: 기밀성(C)
                "2 (중)",                                    # Q: 무결성(I)
                "3 (상)",                                    # R: 가용성(A)
                "2025-01-15",                                # S: 취득일
                "5000000",                                   # T: 취득비용
                "2028-01-10",                                # U: EoL 만료일
                "메인 웹 서비스 운영 서버",                  # V: 설명
            ]
            for col, val in enumerate(example_data, 1):
                cell = ws.cell(row=2, column=col, value=val)
                cell.font = example_font
                cell.fill = example_fill
            data_start_row = 3

        # ── 데이터 (코드 형식으로 기록) ──
        for row, asset in enumerate(assets, data_start_row):
            valuation = self.get_current_valuation(asset.id)
            ws.cell(row=row, column=1, value=asset.asset_code)
            ws.cell(row=row, column=2, value=asset.name)
            ws.cell(row=row, column=3, value=f"{asset.asset_type.code} ({asset.asset_type.name})" if asset.asset_type else "")
            # 분류: level-3 우선, level-2는 하위가 없을 때만 표시
            export_cats = [c for c in asset.categories if c.level == 3] or [c for c in asset.categories if c.level == 2]
            ws.cell(row=row, column=4, value=", ".join(f"{c.code} ({c.name})" for c in export_cats) if export_cats else "")
            ws.cell(row=row, column=5, value=asset.location or "")
            ws.cell(row=row, column=6, value=f"{asset.department.code} ({asset.department.name})" if asset.department else "")
            ws.cell(row=row, column=7, value=f"{asset.personnel_owner.name} ({asset.personnel_owner.department.name})" if asset.personnel_owner and asset.personnel_owner.department else (asset.personnel_owner.name if asset.personnel_owner else ""))
            # 담당자: 소유자(owner) 역할 제외한 할당 목록 (이름 (역할) 형식)
            role_label_map = {"manager": "관리자", "user": "사용자"}
            assignments = self.get_assignments(asset.id)
            assignee_entries = []
            for a in assignments:
                if a.role == AssetAssignmentRole.OWNER.value:
                    continue
                aname = (a.user.name if a.user else None) or (a.personnel.name if a.personnel else None)
                if aname:
                    role_label = role_label_map.get(a.role, "사용자")
                    assignee_entries.append(f"{aname} ({role_label})")
            ws.cell(row=row, column=8, value=", ".join(assignee_entries) if assignee_entries else "")
            ws.cell(row=row, column=9, value=asset.ip_address or "")
            ws.cell(row=row, column=10, value=asset.hostname or "")
            ws.cell(row=row, column=11, value=asset.manufacturer or "")
            ws.cell(row=row, column=12, value=asset.model or "")
            ws.cell(row=row, column=13, value=asset.os_version or "")
            ws.cell(row=row, column=14, value=asset.service_version or "")
            ws.cell(row=row, column=15, value=asset.status)
            cia_label = {1: "1 (하)", 2: "2 (중)", 3: "3 (상)"}
            ws.cell(row=row, column=16, value=cia_label.get(valuation.confidentiality, "") if valuation else "")
            ws.cell(row=row, column=17, value=cia_label.get(valuation.integrity, "") if valuation else "")
            ws.cell(row=row, column=18, value=cia_label.get(valuation.availability, "") if valuation else "")
            ws.cell(row=row, column=19, value=str(asset.acquisition_date) if asset.acquisition_date else "")
            ws.cell(row=row, column=20, value=asset.acquisition_cost or "")
            ws.cell(row=row, column=21, value=str(asset.eol_date) if asset.eol_date else "")
            ws.cell(row=row, column=22, value=asset.description or "")

        # 열 너비 조정
        column_widths = [22, 18, 22, 22, 15, 22, 22, 18, 18, 18, 12, 12, 15, 15, 10, 10, 10, 10, 12, 12, 14, 30]
        for col, width in enumerate(column_widths, 1):
            ws.column_dimensions[get_column_letter(col)].width = width

        # 헤더 자동 필터 및 틀 고정
        last_col_letter = get_column_letter(len(headers))
        ws.auto_filter.ref = f"A1:{last_col_letter}1"
        ws.freeze_panes = "A2"

        # 바이트로 반환
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output.read()

    def get_import_template(self) -> bytes:
        """자산 임포트 빈 템플릿 생성 (export_assets와 동일한 형식, 데이터 없음)"""
        return self.export_assets(filters=None, include_data=False)

    @staticmethod
    def _extract_code(value: str) -> str:
        """'CODE (NAME)' 또는 'CODE' 형식에서 코드 부분만 추출"""
        s = str(value).strip()
        # "SRV (서버)" → "SRV"
        if " (" in s:
            return s.split(" (")[0].strip()
        return s

    def _sync_assignments_from_import(
        self,
        asset_id: int,
        assignee_list: List[Tuple[int, str]],
        assigned_by: int,
    ) -> None:
        """엑셀 임포트 시 담당자 할당 동기화 (추가 및 역할 업데이트)"""
        existing_assignments = self.get_assignments(asset_id)
        # personnel_id → assignment 매핑
        existing_map: Dict[int, AssetAssignment] = {}
        for a in existing_assignments:
            pid = a.personnel_id
            if not pid and a.user_id:
                p = self.db.query(Personnel).filter(
                    Personnel.user_id == a.user_id
                ).first()
                if p:
                    pid = p.id
            if pid:
                existing_map[pid] = a

        for pid, role in assignee_list:
            if pid in existing_map:
                # 역할이 다르면 업데이트
                existing_a = existing_map[pid]
                if existing_a.role != role:
                    existing_a.role = role
                continue
            personnel = self.db.query(Personnel).filter(Personnel.id == pid).first()
            if not personnel:
                continue
            assignment = AssetAssignment(
                asset_id=asset_id,
                user_id=personnel.user_id,
                personnel_id=pid,
                role=role,
                assigned_by=assigned_by,
                assigned_at=utc_now(),
                is_active=True,
            )
            self.db.add(assignment)
        self.db.commit()

    def import_assets(
        self,
        file_content: bytes,
        user_id: int,
        deactivate_missing: bool = False,
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
            "deactivated": 0,
            "errors": [],
        }
        processed_asset_ids: set = set()

        # 헤더 행 찾기: 첫 번째 열이 "자산코드"인 행을 찾아 데이터 시작 행 결정
        data_start_row = 2  # 기본값
        for row_num in range(1, min(ws.max_row + 1, 10)):
            cell_val = ws.cell(row=row_num, column=1).value
            if cell_val and "자산코드" in str(cell_val):
                data_start_row = row_num + 1
                break

        # 안내/예시 행 건너뛰기: 데이터 행에서 스타일 행(회색 배경, 이탤릭 등) 스킵
        for row_num in range(data_start_row, min(ws.max_row + 1, data_start_row + 5)):
            name_val = ws.cell(row=row_num, column=2).value
            if name_val and str(name_val).strip() in ("필수", "★ 필수 입력", "비워두면 자동생성"):
                data_start_row = row_num + 1
                continue
            # 예시 데이터 행 (이탤릭 폰트) 스킵
            cell_font = ws.cell(row=row_num, column=2).font
            if cell_font and cell_font.italic:
                data_start_row = row_num + 1
                continue
            break

        for row_num in range(data_start_row, ws.max_row + 1):
            # 빈 행 무시
            asset_code = ws.cell(row=row_num, column=1).value
            name = ws.cell(row=row_num, column=2).value
            type_code_raw = ws.cell(row=row_num, column=3).value

            if not name and not type_code_raw and not asset_code:
                continue

            results["total"] += 1

            try:
                if not name or not type_code_raw:
                    results["failed"] += 1
                    results["errors"].append({
                        "row": row_num,
                        "error": "자산명과 자산유형코드는 필수입니다."
                    })
                    continue

                # "CODE (NAME)" 형식에서 코드 추출
                type_code = self._extract_code(type_code_raw)

                # 자산 유형 조회
                asset_type = self.get_asset_type_by_code(type_code)
                if not asset_type:
                    results["failed"] += 1
                    results["errors"].append({
                        "row": row_num,
                        "error": f"존재하지 않는 자산 유형 코드입니다: {type_code}"
                    })
                    continue

                # 부서 조회 ("CODE (NAME)" 형식 지원)
                dept_raw = ws.cell(row=row_num, column=6).value
                department_id = None
                if dept_raw:
                    dept_code = self._extract_code(dept_raw)
                    dept = self.db.query(Department).filter(Department.code == dept_code).first()
                    if dept:
                        department_id = dept.id

                # 분류 조회 ("CODE (NAME)" 형식 지원, 쉼표 구분 복수 가능)
                cat_raw = ws.cell(row=row_num, column=4).value
                category_ids = []
                if cat_raw:
                    for cat_token in str(cat_raw).split(","):
                        cat_code = self._extract_code(cat_token.strip())
                        if cat_code:
                            cat = self.db.query(AssetCategory).filter(AssetCategory.code == cat_code).first()
                            if cat:
                                category_ids.append(cat.id)

                # 컬럼 매핑 (export_assets 헤더 순서와 일치)
                # 1:자산코드, 2:자산명, 3:자산유형, 4:분류, 5:위치, 6:부서,
                # 7:소유자(Personnel), 8:담당자(쉼표구분), 9:IP주소, 10:호스트명,
                # 11:제조사, 12:모델, 13:OS버전, 14:서비스버전, 15:상태,
                # 16:기밀성(C), 17:무결성(I), 18:가용성(A),
                # 19:취득일, 20:취득비용, 21:EoL 만료일, 22:설명
                location_val = ws.cell(row=row_num, column=5).value
                owner_raw = ws.cell(row=row_num, column=7).value
                assignee_raw = ws.cell(row=row_num, column=8).value
                ip_address_val = ws.cell(row=row_num, column=9).value
                hostname_val = ws.cell(row=row_num, column=10).value
                manufacturer_val = ws.cell(row=row_num, column=11).value
                model_val = ws.cell(row=row_num, column=12).value
                os_version_val = ws.cell(row=row_num, column=13).value
                service_version_val = ws.cell(row=row_num, column=14).value
                status_val = ws.cell(row=row_num, column=15).value
                cia_c_raw = ws.cell(row=row_num, column=16).value
                cia_i_raw = ws.cell(row=row_num, column=17).value
                cia_a_raw = ws.cell(row=row_num, column=18).value
                acquisition_date_val = ws.cell(row=row_num, column=19).value
                acquisition_cost_val = ws.cell(row=row_num, column=20).value
                eol_date_val = ws.cell(row=row_num, column=21).value
                description_val = ws.cell(row=row_num, column=22).value

                # 소유자 조회 ("name (dept)" 형식에서 name 추출)
                personnel_owner_id = None
                if owner_raw:
                    owner_name = self._extract_code(owner_raw)
                    personnel = self.db.query(Personnel).filter(
                        Personnel.name == owner_name,
                        Personnel.is_active == True,
                    ).first()
                    if personnel:
                        personnel_owner_id = personnel.id

                # 담당자 목록 파싱 ("이름 (역할)" 쉼표 구분)
                role_value_map = {"소유자": "owner", "관리자": "manager", "사용자": "user"}
                assignee_list: List[Tuple[int, str]] = []  # (personnel_id, role)
                if assignee_raw:
                    for entry in str(assignee_raw).split(","):
                        entry = entry.strip()
                        if not entry:
                            continue
                        # "이름 (역할)" 형식 파싱
                        role = AssetAssignmentRole.USER.value
                        aname = entry
                        if " (" in entry and entry.endswith(")"):
                            aname = entry[:entry.rfind(" (")].strip()
                            role_kr = entry[entry.rfind(" (") + 2:-1].strip()
                            role = role_value_map.get(role_kr, AssetAssignmentRole.USER.value)
                        p = self.db.query(Personnel).filter(
                            Personnel.name == aname,
                            Personnel.is_active == True,
                        ).first()
                        if p:
                            # 소유자 역할은 personnel_owner_id로 처리
                            if role == AssetAssignmentRole.OWNER.value:
                                if not personnel_owner_id:
                                    personnel_owner_id = p.id
                            else:
                                assignee_list.append((p.id, role))

                # 취득일 파싱
                acquisition_date = None
                if acquisition_date_val:
                    from datetime import date as date_type, datetime as datetime_type
                    if isinstance(acquisition_date_val, (date_type, datetime_type)):
                        acquisition_date = acquisition_date_val if isinstance(acquisition_date_val, date_type) else acquisition_date_val.date()
                    else:
                        try:
                            acquisition_date = datetime_type.strptime(str(acquisition_date_val).strip(), "%Y-%m-%d").date()
                        except ValueError:
                            pass

                # 취득비용 파싱
                acquisition_cost = None
                if acquisition_cost_val:
                    try:
                        acquisition_cost = int(float(str(acquisition_cost_val).strip().replace(",", "")))
                    except (ValueError, TypeError):
                        pass

                # EoL 만료일 파싱
                eol_date = None
                if eol_date_val:
                    from datetime import date as date_type, datetime as datetime_type
                    if isinstance(eol_date_val, (date_type, datetime_type)):
                        eol_date = eol_date_val if isinstance(eol_date_val, date_type) else eol_date_val.date()
                    else:
                        try:
                            eol_date = datetime_type.strptime(str(eol_date_val).strip(), "%Y-%m-%d").date()
                        except ValueError:
                            pass

                # CIA 파싱 ("N (label)" 형식에서 숫자 추출)
                def parse_cia(val) -> Optional[int]:
                    if val is None:
                        return None
                    s = str(val).strip()
                    if not s:
                        return None
                    # "3 (상)" → 3, "2" → 2
                    try:
                        return int(s[0])
                    except (ValueError, IndexError):
                        return None

                cia_c = parse_cia(cia_c_raw)
                cia_i = parse_cia(cia_i_raw)
                cia_a = parse_cia(cia_a_raw)

                # 자산코드가 있으면 기존 자산 업데이트 시도
                if asset_code:
                    existing = self.db.query(Asset).filter(Asset.asset_code == str(asset_code).strip()).first()
                    if existing:
                        existing.name = str(name)
                        existing.asset_type_id = asset_type.id
                        if category_ids:
                            existing.categories = [
                                c for cid in category_ids
                                if (c := self.get_asset_category_by_id(cid))
                            ]
                        existing.location = str(location_val) if location_val else None
                        if department_id:
                            existing.department_id = department_id
                        # 소유자 설정 시 담당자 탭 owner 역할 동기화
                        existing.personnel_owner_id = personnel_owner_id
                        if personnel_owner_id:
                            self._sync_owner_assignment(existing.id, personnel_owner_id, user_id)

                        existing.ip_address = str(ip_address_val) if ip_address_val else None
                        existing.hostname = str(hostname_val) if hostname_val else None
                        existing.manufacturer = str(manufacturer_val) if manufacturer_val else None
                        existing.model = str(model_val) if model_val else None
                        existing.os_version = str(os_version_val) if os_version_val else None
                        existing.service_version = str(service_version_val) if service_version_val else None
                        if status_val:
                            existing.status = str(status_val).strip()
                        existing.acquisition_date = acquisition_date
                        existing.acquisition_cost = acquisition_cost
                        existing.eol_date = eol_date
                        existing.description = str(description_val) if description_val else None
                        self.db.commit()

                        # 담당자 할당 동기화 (소유자 제외한 나머지)
                        if assignee_raw is not None:
                            self._sync_assignments_from_import(
                                existing.id, assignee_list, user_id
                            )

                        # CIA 평가 생성/업데이트
                        if cia_c is not None and cia_i is not None and cia_a is not None:
                            self.create_valuation(
                                asset_id=existing.id,
                                confidentiality=cia_c,
                                integrity=cia_i,
                                availability=cia_a,
                                user_id=user_id,
                                evaluation_reason="엑셀 일괄 등록",
                            )

                        processed_asset_ids.add(existing.id)
                        results["success"] += 1
                        continue

                # 자산 생성 (자산코드 자동 생성)
                create_kwargs: Dict[str, Any] = {
                    "name": str(name),
                    "asset_type_id": asset_type.id,
                    "user_id": user_id,
                    "category_ids": category_ids or None,
                    "location": str(location_val) if location_val else None,
                    "department_id": department_id,
                    "ip_address": str(ip_address_val) if ip_address_val else None,
                    "hostname": str(hostname_val) if hostname_val else None,
                    "manufacturer": str(manufacturer_val) if manufacturer_val else None,
                    "model": str(model_val) if model_val else None,
                    "os_version": str(os_version_val) if os_version_val else None,
                    "service_version": str(service_version_val) if service_version_val else None,
                    "description": str(description_val) if description_val else None,
                }
                if personnel_owner_id:
                    create_kwargs["personnel_owner_id"] = personnel_owner_id
                if status_val:
                    create_kwargs["status"] = str(status_val).strip()
                if acquisition_date:
                    create_kwargs["acquisition_date"] = acquisition_date
                if acquisition_cost is not None:
                    create_kwargs["acquisition_cost"] = acquisition_cost
                if eol_date:
                    create_kwargs["eol_date"] = eol_date
                new_asset = self.create_asset(**create_kwargs)

                # 담당자 할당
                if assignee_list:
                    self._sync_assignments_from_import(
                        new_asset.id, assignee_list, user_id
                    )

                # CIA 평가 생성
                if cia_c is not None and cia_i is not None and cia_a is not None:
                    self.create_valuation(
                        asset_id=new_asset.id,
                        confidentiality=cia_c,
                        integrity=cia_i,
                        availability=cia_a,
                        user_id=user_id,
                        evaluation_reason="엑셀 일괄 등록",
                    )

                processed_asset_ids.add(new_asset.id)
                results["success"] += 1

            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "row": row_num,
                    "error": str(e)
                })

        # 템플릿에 없는 기존 활성 자산 비활성화
        if deactivate_missing and processed_asset_ids:
            active_assets = (
                self.db.query(Asset)
                .filter(Asset.is_active == True, Asset.id.notin_(processed_asset_ids))
                .all()
            )
            for asset in active_assets:
                asset.is_active = False
                self._record_history(
                    asset_id=asset.id,
                    change_type=AssetChangeType.DELETE.value,
                    changed_by=user_id,
                    new_value="엑셀 임포트 동기화로 비활성화",
                )
                results["deactivated"] += 1
            self.db.commit()

        return results


# Integer를 import해야 함 (SQLAlchemy)
from sqlalchemy import Integer
