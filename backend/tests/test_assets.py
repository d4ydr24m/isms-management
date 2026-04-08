"""
Phase 2 - 자산 관리 모델 테스트
TDD 접근법: 테스트 먼저 작성 후 구현
"""
import pytest
from datetime import datetime, date
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.department import Department
from app.models.user import User


class TestAssetTypeModel:
    """AssetType (자산 유형) 모델 테스트"""

    def test_asset_type_creation(self, db: Session):
        """자산 유형 생성 테스트"""
        from app.models.asset import AssetType

        asset_type = AssetType(
            code="SRV",
            name="서버",
            description="서버 장비",
            icon="server",
            is_custom=False,
            is_active=True,
            sort_order=1,
        )
        db.add(asset_type)
        db.commit()
        db.refresh(asset_type)

        assert asset_type.id is not None
        assert asset_type.code == "SRV"
        assert asset_type.name == "서버"
        assert asset_type.is_custom is False
        assert asset_type.created_at is not None

    def test_asset_type_unique_code_constraint(self, db: Session):
        """자산 유형 코드 유니크 제약조건 테스트"""
        from app.models.asset import AssetType

        type1 = AssetType(code="NET", name="네트워크장비", sort_order=1)
        db.add(type1)
        db.commit()

        type2 = AssetType(code="NET", name="중복 유형", sort_order=2)
        db.add(type2)

        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    def test_asset_type_repr(self, db: Session):
        """자산 유형 __repr__ 테스트"""
        from app.models.asset import AssetType

        asset_type = AssetType(code="SEC", name="보안장비", sort_order=1)
        db.add(asset_type)
        db.commit()
        db.refresh(asset_type)

        repr_str = repr(asset_type)
        assert "AssetType" in repr_str
        assert "보안장비" in repr_str


class TestAssetCategoryModel:
    """AssetCategory (자산 분류) 모델 테스트"""

    def test_asset_category_creation(self, db: Session):
        """자산 분류 생성 테스트 (계층 구조 없이)"""
        from app.models.asset import AssetCategory

        category = AssetCategory(
            code="HW",
            name="하드웨어",
            description="하드웨어 자산",
            level=1,
            is_active=True,
            sort_order=1,
        )
        db.add(category)
        db.commit()
        db.refresh(category)

        assert category.id is not None
        assert category.code == "HW"
        assert category.name == "하드웨어"
        assert category.level == 1
        assert category.parent_id is None

    def test_asset_category_hierarchy(self, db: Session):
        """자산 분류 계층 구조 테스트 (대분류 → 중분류 → 소분류)"""
        from app.models.asset import AssetCategory

        # 대분류
        parent = AssetCategory(code="HW", name="하드웨어", level=1, sort_order=1)
        db.add(parent)
        db.commit()

        # 중분류
        middle = AssetCategory(
            code="HW-SRV",
            name="서버 장비",
            level=2,
            parent_id=parent.id,
            sort_order=1,
        )
        db.add(middle)
        db.commit()

        # 소분류
        child = AssetCategory(
            code="HW-SRV-PHYS",
            name="물리 서버",
            level=3,
            parent_id=middle.id,
            sort_order=1,
        )
        db.add(child)
        db.commit()
        db.refresh(child)

        assert child.parent_id == middle.id
        assert child.parent.name == "서버 장비"
        assert middle.parent.name == "하드웨어"
        assert child.level == 3

    def test_asset_category_unique_code_constraint(self, db: Session):
        """자산 분류 코드 유니크 제약조건 테스트"""
        from app.models.asset import AssetCategory

        cat1 = AssetCategory(code="SW", name="소프트웨어", level=1, sort_order=1)
        db.add(cat1)
        db.commit()

        cat2 = AssetCategory(code="SW", name="중복 분류", level=1, sort_order=2)
        db.add(cat2)

        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


class TestAssetModel:
    """Asset (자산) 모델 테스트"""

    @pytest.fixture
    def sample_asset_type(self, db: Session):
        """테스트용 자산 유형"""
        from app.models.asset import AssetType

        asset_type = AssetType(code="SRV", name="서버", sort_order=1)
        db.add(asset_type)
        db.commit()
        db.refresh(asset_type)
        return asset_type

    @pytest.fixture
    def sample_asset_category(self, db: Session):
        """테스트용 자산 분류"""
        from app.models.asset import AssetCategory

        category = AssetCategory(code="HW", name="하드웨어", level=1, sort_order=1)
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    def test_asset_creation(
        self, db: Session, sample_asset_type, sample_asset_category, test_department, test_user
    ):
        """자산 생성 테스트"""
        from app.models.asset import Asset

        asset = Asset(
            asset_code="AST-SRV-202601-0001",
            name="웹서버 #1",
            asset_type_id=sample_asset_type.id,
            department_id=test_department.id,
            owner_id=test_user.id,
            location="데이터센터 A동 3층",
            ip_address="192.168.1.100",
            mac_address="00:1A:2B:3C:4D:5E",
            os_version="Ubuntu 22.04 LTS",
            acquisition_date=date(2024, 1, 15),
            status="운영",
            is_active=True,
        )
        asset.categories.append(sample_asset_category)
        db.add(asset)
        db.commit()
        db.refresh(asset)

        assert asset.id is not None
        assert asset.asset_code == "AST-SRV-202601-0001"
        assert asset.name == "웹서버 #1"
        assert asset.status == "운영"
        assert asset.is_active is True
        assert asset.created_at is not None

    def test_asset_unique_code_constraint(
        self, db: Session, sample_asset_type, sample_asset_category, test_department, test_user
    ):
        """자산코드 유니크 제약조건 테스트"""
        from app.models.asset import Asset

        asset1 = Asset(
            asset_code="AST-SRV-202601-0001",
            name="서버1",
            asset_type_id=sample_asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="운영",
        )
        db.add(asset1)
        db.commit()

        asset2 = Asset(
            asset_code="AST-SRV-202601-0001",  # 중복 코드
            name="서버2",
            asset_type_id=sample_asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="운영",
        )
        db.add(asset2)

        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    def test_asset_relationships(
        self, db: Session, sample_asset_type, sample_asset_category, test_department, test_user
    ):
        """자산 관계 테스트 (유형, 분류, 부서, 소유자)"""
        from app.models.asset import Asset

        asset = Asset(
            asset_code="AST-SRV-202601-0002",
            name="DB서버",
            asset_type_id=sample_asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="운영",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        assert asset.asset_type is not None
        assert asset.asset_type.name == "서버"
        assert len(asset.categories) == 0  # M2M - no categories assigned in this test
        assert asset.department is not None
        assert asset.department.name == "테스트부서"
        assert asset.owner is not None
        assert asset.owner.name == "테스트 사용자"

    def test_asset_status_values(
        self, db: Session, sample_asset_type, sample_asset_category, test_department, test_user
    ):
        """자산 상태 값 테스트 (도입/운영/변경/폐기)"""
        from app.models.asset import Asset

        valid_statuses = ["도입", "운영", "변경", "폐기"]

        for i, status in enumerate(valid_statuses):
            asset = Asset(
                asset_code=f"AST-TEST-202601-{i:04d}",
                name=f"테스트 자산 {status}",
                asset_type_id=sample_asset_type.id,
    
                department_id=test_department.id,
                owner_id=test_user.id,
                status=status,
            )
            db.add(asset)

        db.commit()

        from app.models.asset import Asset as AssetModel
        assets = db.query(AssetModel).filter(AssetModel.asset_code.like("AST-TEST%")).all()
        assert len(assets) == 4


class TestAssetValuationModel:
    """AssetValuation (자산 가치 평가) 모델 테스트"""

    @pytest.fixture
    def sample_asset(self, db: Session, test_department, test_user):
        """테스트용 자산"""
        from app.models.asset import AssetType, AssetCategory, Asset

        asset_type = AssetType(code="SRV", name="서버", sort_order=1)
        db.add(asset_type)
        db.commit()

        category = AssetCategory(code="HW", name="하드웨어", level=1, sort_order=1)
        db.add(category)
        db.commit()

        asset = Asset(
            asset_code="AST-SRV-202601-0001",
            name="테스트서버",
            asset_type_id=asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="운영",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def test_asset_valuation_creation(self, db: Session, sample_asset, test_user):
        """자산 가치 평가 생성 테스트"""
        from app.models.asset import AssetValuation

        valuation = AssetValuation(
            asset_id=sample_asset.id,
            confidentiality=3,  # 상
            integrity=2,  # 중
            availability=3,  # 상
            evaluation_reason="핵심 업무 서버로 기밀성 및 가용성이 중요",
            evaluated_by=test_user.id,
            evaluated_at=datetime.utcnow(),
        )
        db.add(valuation)
        db.commit()
        db.refresh(valuation)

        assert valuation.id is not None
        assert valuation.confidentiality == 3
        assert valuation.integrity == 2
        assert valuation.availability == 3
        assert valuation.evaluated_by == test_user.id

    def test_asset_valuation_importance_level(self, db: Session, sample_asset, test_user):
        """자산 중요도 자동 계산 테스트 (MAX 방식)"""
        from app.models.asset import AssetValuation

        valuation = AssetValuation(
            asset_id=sample_asset.id,
            confidentiality=2,
            integrity=3,
            availability=1,
            evaluated_by=test_user.id,
            evaluated_at=datetime.utcnow(),
        )
        db.add(valuation)
        db.commit()
        db.refresh(valuation)

        # importance_level은 MAX(C, I, A)
        assert valuation.importance_level == 3

    def test_asset_valuation_values_range(self, db: Session, sample_asset, test_user):
        """CIA 값 범위 테스트 (1-3)"""
        from app.models.asset import AssetValuation

        # 정상 범위 (1, 2, 3)
        valuation = AssetValuation(
            asset_id=sample_asset.id,
            confidentiality=1,  # 하
            integrity=2,  # 중
            availability=3,  # 상
            evaluated_by=test_user.id,
            evaluated_at=datetime.utcnow(),
        )
        db.add(valuation)
        db.commit()

        assert valuation.confidentiality in [1, 2, 3]
        assert valuation.integrity in [1, 2, 3]
        assert valuation.availability in [1, 2, 3]


class TestAssetHistoryModel:
    """AssetHistory (자산 이력) 모델 테스트"""

    @pytest.fixture
    def sample_asset(self, db: Session, test_department, test_user):
        """테스트용 자산"""
        from app.models.asset import AssetType, AssetCategory, Asset

        asset_type = AssetType(code="SRV", name="서버", sort_order=1)
        db.add(asset_type)
        db.commit()

        category = AssetCategory(code="HW", name="하드웨어", level=1, sort_order=1)
        db.add(category)
        db.commit()

        asset = Asset(
            asset_code="AST-SRV-202601-0001",
            name="테스트서버",
            asset_type_id=asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="운영",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def test_asset_history_creation(self, db: Session, sample_asset, test_user):
        """자산 변경 이력 생성 테스트"""
        from app.models.asset import AssetHistory

        history = AssetHistory(
            asset_id=sample_asset.id,
            change_type="update",
            field_name="status",
            old_value="도입",
            new_value="운영",
            changed_by=test_user.id,
            changed_at=datetime.utcnow(),
            remarks="정상 운영 시작",
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        assert history.id is not None
        assert history.asset_id == sample_asset.id
        assert history.change_type == "update"
        assert history.field_name == "status"
        assert history.old_value == "도입"
        assert history.new_value == "운영"

    def test_asset_history_change_types(self, db: Session, sample_asset, test_user):
        """자산 변경 유형 테스트"""
        from app.models.asset import AssetHistory

        change_types = ["create", "update", "delete", "valuation", "assignment"]

        for i, change_type in enumerate(change_types):
            history = AssetHistory(
                asset_id=sample_asset.id,
                change_type=change_type,
                field_name="test_field",
                new_value=f"test_value_{i}",
                changed_by=test_user.id,
                changed_at=datetime.utcnow(),
            )
            db.add(history)

        db.commit()

        from app.models.asset import AssetHistory as AssetHistoryModel
        histories = db.query(AssetHistoryModel).filter_by(asset_id=sample_asset.id).all()
        assert len(histories) == 5


class TestAssetDisposalModel:
    """AssetDisposal (자산 폐기) 모델 테스트"""

    @pytest.fixture
    def sample_asset(self, db: Session, test_department, test_user):
        """테스트용 자산"""
        from app.models.asset import AssetType, AssetCategory, Asset

        asset_type = AssetType(code="SRV", name="서버", sort_order=1)
        db.add(asset_type)
        db.commit()

        category = AssetCategory(code="HW", name="하드웨어", level=1, sort_order=1)
        db.add(category)
        db.commit()

        asset = Asset(
            asset_code="AST-SRV-202601-0001",
            name="테스트서버",
            asset_type_id=asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="폐기",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def test_asset_disposal_creation(self, db: Session, sample_asset, test_admin_user):
        """자산 폐기 기록 생성 테스트"""
        from app.models.asset import AssetDisposal

        disposal = AssetDisposal(
            asset_id=sample_asset.id,
            disposal_date=date(2026, 1, 20),
            disposal_reason="노후화로 인한 교체",
            disposal_method="물리적 파쇄",
            data_deletion_confirmed=True,
            data_deletion_method="DOD 5220.22-M 방식 완전 삭제",
            approved_by=test_admin_user.id,
            approved_at=datetime.utcnow(),
            remarks="정상 폐기 완료",
        )
        db.add(disposal)
        db.commit()
        db.refresh(disposal)

        assert disposal.id is not None
        assert disposal.asset_id == sample_asset.id
        assert disposal.disposal_reason == "노후화로 인한 교체"
        assert disposal.data_deletion_confirmed is True
        assert disposal.approved_by == test_admin_user.id


class TestAssetAssignmentModel:
    """AssetAssignment (자산-담당자 할당) 모델 테스트"""

    @pytest.fixture
    def sample_asset(self, db: Session, test_department, test_user):
        """테스트용 자산"""
        from app.models.asset import AssetType, AssetCategory, Asset

        asset_type = AssetType(code="SRV", name="서버", sort_order=1)
        db.add(asset_type)
        db.commit()

        category = AssetCategory(code="HW", name="하드웨어", level=1, sort_order=1)
        db.add(category)
        db.commit()

        asset = Asset(
            asset_code="AST-SRV-202601-0001",
            name="테스트서버",
            asset_type_id=asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="운영",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def test_asset_assignment_creation(self, db: Session, sample_asset, test_user, test_admin_user):
        """자산 담당자 할당 테스트"""
        from app.models.asset import AssetAssignment

        assignment = AssetAssignment(
            asset_id=sample_asset.id,
            user_id=test_user.id,
            role="manager",  # owner/manager/user
            assigned_at=datetime.utcnow(),
            assigned_by=test_admin_user.id,
            is_active=True,
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)

        assert assignment.id is not None
        assert assignment.asset_id == sample_asset.id
        assert assignment.user_id == test_user.id
        assert assignment.role == "manager"
        assert assignment.is_active is True

    def test_asset_assignment_roles(self, db: Session, sample_asset, test_user, test_admin_user):
        """자산 담당자 역할 테스트"""
        from app.models.asset import AssetAssignment

        roles = ["owner", "manager", "user"]

        for role in roles:
            assignment = AssetAssignment(
                asset_id=sample_asset.id,
                user_id=test_user.id,
                role=role,
                assigned_at=datetime.utcnow(),
                assigned_by=test_admin_user.id,
                is_active=True,
            )
            db.add(assignment)
            db.commit()
            db.refresh(assignment)

            assert assignment.role == role


class TestAssetHandoverModel:
    """AssetHandover (자산 인수인계) 모델 테스트"""

    @pytest.fixture
    def sample_asset(self, db: Session, test_department, test_user):
        """테스트용 자산"""
        from app.models.asset import AssetType, AssetCategory, Asset

        asset_type = AssetType(code="SRV", name="서버", sort_order=1)
        db.add(asset_type)
        db.commit()

        category = AssetCategory(code="HW", name="하드웨어", level=1, sort_order=1)
        db.add(category)
        db.commit()

        asset = Asset(
            asset_code="AST-SRV-202601-0001",
            name="테스트서버",
            asset_type_id=asset_type.id,

            department_id=test_department.id,
            owner_id=test_user.id,
            status="운영",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    def test_asset_handover_creation(self, db: Session, sample_asset, test_user, test_admin_user):
        """자산 인수인계 기록 생성 테스트"""
        from app.models.asset import AssetHandover

        handover = AssetHandover(
            asset_id=sample_asset.id,
            from_user_id=test_admin_user.id,
            to_user_id=test_user.id,
            handover_date=date(2026, 1, 20),
            checklist_items='["접근권한 이관", "문서 전달", "시스템 접속 확인"]',
            checklist_completed=True,
            remarks="정상 인수인계 완료",
            approved_by=test_admin_user.id,
            approved_at=datetime.utcnow(),
        )
        db.add(handover)
        db.commit()
        db.refresh(handover)

        assert handover.id is not None
        assert handover.from_user_id == test_admin_user.id
        assert handover.to_user_id == test_user.id
        assert handover.checklist_completed is True

    def test_asset_handover_relationships(self, db: Session, sample_asset, test_user, test_admin_user):
        """자산 인수인계 관계 테스트"""
        from app.models.asset import AssetHandover

        handover = AssetHandover(
            asset_id=sample_asset.id,
            from_user_id=test_admin_user.id,
            to_user_id=test_user.id,
            handover_date=date(2026, 1, 20),
        )
        db.add(handover)
        db.commit()
        db.refresh(handover)

        assert handover.asset is not None
        assert handover.asset.name == "테스트서버"
        assert handover.from_user is not None
        assert handover.to_user is not None
