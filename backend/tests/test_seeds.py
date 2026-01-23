"""
Phase 2.0 - 시드 데이터 테스트
ISMS-P 통제항목 및 기본 역할 시드 데이터 로딩 테스트
"""
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from sqlalchemy.orm import Session

from app.models.control import ControlDomain, ControlCategory, ControlItem
from app.models.user import Role, User
from app.models.department import Department


class TestISMSControlsSeeds:
    """ISMS-P 통제항목 시드 데이터 테스트"""

    def test_isms_controls_json_file_exists(self):
        """isms_controls.json 파일 존재 확인"""
        seeds_path = Path("c:/Users/Aiden.Han/workspace/isms-management/backend/app/db/seeds/isms_controls.json")
        assert seeds_path.exists(), "isms_controls.json 파일이 존재하지 않습니다."

    def test_isms_controls_json_is_valid(self):
        """isms_controls.json 파일이 유효한 JSON인지 확인"""
        seeds_path = Path("c:/Users/Aiden.Han/workspace/isms-management/backend/app/db/seeds/isms_controls.json")
        with open(seeds_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "domains" in data, "domains 키가 없습니다."
        assert "categories" in data, "categories 키가 없습니다."
        assert "control_items" in data, "control_items 키가 없습니다."

    def test_isms_controls_domains_structure(self):
        """통제영역 데이터 구조 검증"""
        seeds_path = Path("c:/Users/Aiden.Han/workspace/isms-management/backend/app/db/seeds/isms_controls.json")
        with open(seeds_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 최소 2개의 영역이 있어야 함 (관리체계, 보호대책)
        assert len(data["domains"]) >= 2, "최소 2개의 통제영역이 필요합니다."

        for domain in data["domains"]:
            assert "code" in domain, "domain에 code 필드가 필요합니다."
            assert "name" in domain, "domain에 name 필드가 필요합니다."
            assert "sort_order" in domain, "domain에 sort_order 필드가 필요합니다."

    def test_isms_controls_categories_structure(self):
        """통제항목 카테고리 데이터 구조 검증"""
        seeds_path = Path("c:/Users/Aiden.Han/workspace/isms-management/backend/app/db/seeds/isms_controls.json")
        with open(seeds_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert len(data["categories"]) >= 10, "최소 10개의 카테고리가 필요합니다."

        for category in data["categories"]:
            assert "domain_code" in category, "category에 domain_code 필드가 필요합니다."
            assert "code" in category, "category에 code 필드가 필요합니다."
            assert "name" in category, "category에 name 필드가 필요합니다."
            assert "sort_order" in category, "category에 sort_order 필드가 필요합니다."

    def test_isms_controls_items_structure(self):
        """통제항목 데이터 구조 검증"""
        seeds_path = Path("c:/Users/Aiden.Han/workspace/isms-management/backend/app/db/seeds/isms_controls.json")
        with open(seeds_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 현재 15개 항목이 있지만, 향후 80개로 확장될 수 있음
        assert len(data["control_items"]) >= 10, "최소 10개의 통제항목이 필요합니다."

        for item in data["control_items"]:
            assert "category_code" in item, "control_item에 category_code 필드가 필요합니다."
            assert "code" in item, "control_item에 code 필드가 필요합니다."
            assert "title" in item, "control_item에 title 필드가 필요합니다."
            assert "description" in item, "control_item에 description 필드가 필요합니다."
            assert "is_required" in item, "control_item에 is_required 필드가 필요합니다."
            assert "sort_order" in item, "control_item에 sort_order 필드가 필요합니다."

    def test_category_domain_code_references_exist(self):
        """카테고리의 domain_code가 실제 도메인을 참조하는지 검증"""
        seeds_path = Path("c:/Users/Aiden.Han/workspace/isms-management/backend/app/db/seeds/isms_controls.json")
        with open(seeds_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        domain_codes = {d["code"] for d in data["domains"]}

        for category in data["categories"]:
            assert category["domain_code"] in domain_codes, \
                f"카테고리 {category['code']}의 domain_code '{category['domain_code']}'가 존재하지 않습니다."

    def test_item_category_code_references_exist(self):
        """통제항목의 category_code가 실제 카테고리를 참조하는지 검증"""
        seeds_path = Path("c:/Users/Aiden.Han/workspace/isms-management/backend/app/db/seeds/isms_controls.json")
        with open(seeds_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        category_codes = {c["code"] for c in data["categories"]}

        for item in data["control_items"]:
            assert item["category_code"] in category_codes, \
                f"통제항목 {item['code']}의 category_code '{item['category_code']}'가 존재하지 않습니다."


class TestLoadISMSControls:
    """load_isms_controls 함수 테스트"""

    def test_load_isms_controls_creates_domains(self, db: Session):
        """통제영역이 올바르게 생성되는지 테스트"""
        from app.db.init_db import load_isms_controls

        load_isms_controls(db)

        domains = db.query(ControlDomain).all()
        assert len(domains) >= 2, "최소 2개의 통제영역이 생성되어야 합니다."

        domain_codes = [d.code for d in domains]
        assert "A" in domain_codes, "관리체계 영역(A)이 생성되어야 합니다."
        assert "B" in domain_codes, "보호대책 영역(B)이 생성되어야 합니다."

    def test_load_isms_controls_creates_categories(self, db: Session):
        """통제항목 카테고리가 올바르게 생성되는지 테스트"""
        from app.db.init_db import load_isms_controls

        load_isms_controls(db)

        categories = db.query(ControlCategory).all()
        assert len(categories) >= 10, "최소 10개의 카테고리가 생성되어야 합니다."

        # 각 카테고리가 도메인과 연결되어 있는지 확인
        for category in categories:
            assert category.domain_id is not None, f"카테고리 {category.code}에 도메인이 연결되지 않았습니다."

    def test_load_isms_controls_creates_items(self, db: Session):
        """통제항목이 올바르게 생성되는지 테스트"""
        from app.db.init_db import load_isms_controls

        load_isms_controls(db)

        items = db.query(ControlItem).all()
        assert len(items) >= 10, "최소 10개의 통제항목이 생성되어야 합니다."

        # 각 항목이 카테고리와 연결되어 있는지 확인
        for item in items:
            assert item.category_id is not None, f"통제항목 {item.code}에 카테고리가 연결되지 않았습니다."

    def test_load_isms_controls_idempotent(self, db: Session):
        """load_isms_controls 중복 실행 시 데이터가 중복 생성되지 않는지 테스트"""
        from app.db.init_db import load_isms_controls

        # 첫 번째 실행
        load_isms_controls(db)
        first_count = db.query(ControlItem).count()

        # 두 번째 실행
        load_isms_controls(db)
        second_count = db.query(ControlItem).count()

        assert first_count == second_count, "중복 실행 시 데이터가 중복 생성되었습니다."


class TestDefaultRolesSeeds:
    """기본 역할 시드 데이터 테스트"""

    def test_create_default_roles(self, db: Session):
        """기본 역할 생성 테스트"""
        from app.db.init_db import create_default_roles

        create_default_roles(db)

        roles = db.query(Role).all()
        assert len(roles) == 6, "6개의 기본 역할이 생성되어야 합니다."

        role_names = [r.name for r in roles]
        expected_roles = ["CISO", "보안담당자", "부서담당자", "일반직원", "내부감사인", "외부심사원"]

        for expected_role in expected_roles:
            assert expected_role in role_names, f"'{expected_role}' 역할이 생성되지 않았습니다."

    def test_default_roles_are_system_roles(self, db: Session):
        """기본 역할이 시스템 역할로 표시되는지 테스트"""
        from app.db.init_db import create_default_roles

        create_default_roles(db)

        roles = db.query(Role).all()
        for role in roles:
            assert role.is_system_role is True, f"'{role.name}' 역할이 시스템 역할로 표시되지 않았습니다."

    def test_ciso_role_has_all_permissions(self, db: Session):
        """CISO 역할이 모든 권한을 가지는지 테스트"""
        from app.db.init_db import create_default_roles

        create_default_roles(db)

        ciso = db.query(Role).filter_by(name="CISO").first()
        assert ciso is not None, "CISO 역할이 생성되지 않았습니다."
        assert ciso.permissions == "all", "CISO 역할은 'all' 권한을 가져야 합니다."

    def test_external_auditor_read_only(self, db: Session):
        """외부심사원 역할이 읽기 전용 권한만 가지는지 테스트"""
        from app.db.init_db import create_default_roles

        create_default_roles(db)

        auditor = db.query(Role).filter_by(name="외부심사원").first()
        assert auditor is not None, "외부심사원 역할이 생성되지 않았습니다."

        # 읽기 권한만 있어야 함
        permissions = auditor.permissions.split(",")
        for perm in permissions:
            assert "read" in perm or perm.endswith(":read"), \
                f"외부심사원은 읽기 전용이어야 합니다. 잘못된 권한: {perm}"

    def test_create_default_roles_idempotent(self, db: Session):
        """create_default_roles 중복 실행 시 데이터가 중복 생성되지 않는지 테스트"""
        from app.db.init_db import create_default_roles

        # 첫 번째 실행
        create_default_roles(db)
        first_count = db.query(Role).count()

        # 두 번째 실행
        create_default_roles(db)
        second_count = db.query(Role).count()

        assert first_count == second_count, "중복 실행 시 역할이 중복 생성되었습니다."


class TestDefaultDepartment:
    """기본 부서 시드 데이터 테스트"""

    def test_create_default_department(self, db: Session):
        """기본 부서 생성 테스트"""
        from app.db.init_db import create_default_department

        dept = create_default_department(db)

        assert dept is not None, "기본 부서가 생성되지 않았습니다."
        assert dept.code == "ROOT", "기본 부서 코드는 'ROOT'이어야 합니다."
        assert dept.name == "본사", "기본 부서 이름은 '본사'이어야 합니다."
        assert dept.is_active is True, "기본 부서는 활성 상태여야 합니다."

    def test_create_default_department_idempotent(self, db: Session):
        """create_default_department 중복 실행 시 데이터가 중복 생성되지 않는지 테스트"""
        from app.db.init_db import create_default_department

        # 첫 번째 실행
        dept1 = create_default_department(db)
        first_count = db.query(Department).filter_by(code="ROOT").count()

        # 두 번째 실행
        dept2 = create_default_department(db)
        second_count = db.query(Department).filter_by(code="ROOT").count()

        assert first_count == second_count == 1, "기본 부서가 중복 생성되었습니다."
        assert dept1.id == dept2.id, "같은 부서가 반환되어야 합니다."


class TestAdminUser:
    """관리자 계정 시드 데이터 테스트"""

    def test_create_admin_user(self, db: Session):
        """관리자 계정 생성 테스트"""
        from app.db.init_db import create_default_roles, create_default_department, create_admin_user

        create_default_roles(db)
        dept = create_default_department(db)
        create_admin_user(db, dept)

        admin = db.query(User).filter_by(email="admin@example.com").first()

        assert admin is not None, "관리자 계정이 생성되지 않았습니다."
        assert admin.is_superuser is True, "관리자는 슈퍼유저여야 합니다."
        assert admin.is_active is True, "관리자는 활성 상태여야 합니다."
        assert admin.department_id == dept.id, "관리자는 기본 부서에 속해야 합니다."

    def test_admin_user_has_ciso_role(self, db: Session):
        """관리자가 CISO 역할을 가지는지 테스트"""
        from app.db.init_db import create_default_roles, create_default_department, create_admin_user

        create_default_roles(db)
        dept = create_default_department(db)
        create_admin_user(db, dept)

        admin = db.query(User).filter_by(email="admin@example.com").first()
        role_names = [r.name for r in admin.roles]

        assert "CISO" in role_names, "관리자는 CISO 역할을 가져야 합니다."

    def test_create_admin_user_idempotent(self, db: Session):
        """create_admin_user 중복 실행 시 데이터가 중복 생성되지 않는지 테스트"""
        from app.db.init_db import create_default_roles, create_default_department, create_admin_user

        create_default_roles(db)
        dept = create_default_department(db)

        # 첫 번째 실행
        create_admin_user(db, dept)
        first_count = db.query(User).filter_by(email="admin@example.com").count()

        # 두 번째 실행
        create_admin_user(db, dept)
        second_count = db.query(User).filter_by(email="admin@example.com").count()

        assert first_count == second_count == 1, "관리자 계정이 중복 생성되었습니다."
