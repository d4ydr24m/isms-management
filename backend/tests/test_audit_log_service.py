"""
감사 로그 서비스 테스트
TDD - 증적 조회/다운로드 감사 로그 기록 테스트
"""
import json
import pytest
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.audit_log_service import AuditLogService, log_user_activity


class TestAuditLogService:
    """AuditLogService 단위 테스트"""

    def test_create_audit_log_basic(self, db: Session, test_admin_user: User):
        """기본 감사 로그 생성"""
        service = AuditLogService(db)

        log = service.create_log(
            action="read",
            resource_type="evidence",
            resource_id=1,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
        )

        assert log is not None
        assert log.user_id == test_admin_user.id
        assert log.action == "read"
        assert log.resource_type == "evidence"
        assert log.resource_id == 1
        assert log.current_hash is not None

    def test_create_audit_log_with_request_info(self, db: Session, test_admin_user: User):
        """요청 정보 포함한 감사 로그"""
        service = AuditLogService(db)

        log = service.create_log(
            action="download",
            resource_type="evidence",
            resource_id=5,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0",
            request_method="GET",
            request_path="/api/v1/evidences/5/download",
        )

        assert log.ip_address == "192.168.1.100"
        assert log.user_agent == "Mozilla/5.0"
        assert log.request_method == "GET"
        assert log.request_path == "/api/v1/evidences/5/download"

    def test_create_audit_log_with_values(self, db: Session, test_admin_user: User):
        """변경 전/후 값 포함한 감사 로그"""
        service = AuditLogService(db)

        old_value = {"status": "draft"}
        new_value = {"status": "approved"}

        log = service.create_log(
            action="update",
            resource_type="evidence",
            resource_id=3,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
            old_value=old_value,
            new_value=new_value,
        )

        assert json.loads(log.old_value) == old_value
        assert json.loads(log.new_value) == new_value

    def test_hash_chain_integrity(self, db: Session, test_admin_user: User):
        """해시 체인 무결성 검증"""
        service = AuditLogService(db)

        # 첫 번째 로그
        log1 = service.create_log(
            action="create",
            resource_type="evidence",
            resource_id=1,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
        )

        # 두 번째 로그
        log2 = service.create_log(
            action="read",
            resource_type="evidence",
            resource_id=1,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
        )

        # 해시 체인 확인
        assert log2.previous_hash == log1.current_hash
        assert log1.current_hash != log2.current_hash

    def test_verify_hash_chain_valid(self, db: Session, test_admin_user: User):
        """해시 체인 검증 - 유효한 경우"""
        service = AuditLogService(db)

        # 로그 3개 생성
        for i in range(3):
            service.create_log(
                action="read",
                resource_type="evidence",
                resource_id=i + 1,
                user_id=test_admin_user.id,
                user_email=test_admin_user.email,
                user_name=test_admin_user.name,
            )

        # 해시 체인 검증
        result = service.verify_hash_chain(limit=3)
        assert result["is_valid"] is True

    def test_list_logs_with_filters(self, db: Session, test_admin_user: User):
        """필터를 사용한 로그 목록 조회"""
        service = AuditLogService(db)

        # 특정 증적에 대한 로그 생성
        for action in ["create", "view", "download", "update"]:
            service.create_log(
                action=action,
                resource_type="evidence",
                resource_id=99,
                user_id=test_admin_user.id,
                user_email=test_admin_user.email,
                user_name=test_admin_user.name,
            )

        logs, total = service.list_logs(
            resource_type="evidence",
            resource_id=99,
        )

        assert total == 4
        actions = [log.action for log in logs]
        assert "create" in actions
        assert "view" in actions
        assert "download" in actions
        assert "update" in actions

    def test_list_logs_by_user(self, db: Session, test_admin_user: User):
        """사용자별 로그 조회"""
        service = AuditLogService(db)

        # 로그 생성
        for i in range(5):
            service.create_log(
                action="view",
                resource_type="evidence",
                resource_id=i + 1,
                user_id=test_admin_user.id,
                user_email=test_admin_user.email,
                user_name=test_admin_user.name,
            )

        logs, total = service.list_logs(user_id=test_admin_user.id, size=10)

        assert total >= 5
        assert all(log.user_id == test_admin_user.id for log in logs)

    def test_list_logs_by_action(self, db: Session, test_admin_user: User):
        """액션별 로그 조회"""
        service = AuditLogService(db)

        # 다양한 액션 로그 생성
        service.create_log(
            action="download",
            resource_type="evidence",
            resource_id=100,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
        )
        service.create_log(
            action="view",
            resource_type="template",
            resource_id=50,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
        )

        # 다운로드 액션만 검색
        logs, total = service.list_logs(action="download", size=100)
        assert all(log.action == "download" for log in logs)

        # evidence 타입만 검색
        logs, total = service.list_logs(resource_type="evidence", size=100)
        assert all(log.resource_type == "evidence" for log in logs)

    def test_export_logs_json(self, db: Session, test_admin_user: User):
        """JSON 형식 로그 내보내기"""
        service = AuditLogService(db)

        # 로그 생성
        service.create_log(
            action="create",
            resource_type="evidence",
            resource_id=1,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
        )

        # JSON 내보내기
        result = service.export_logs(format="json")
        data = json.loads(result)

        assert isinstance(data, list)
        assert len(data) >= 1
        assert "action" in data[0]
        assert "resource_type" in data[0]

    def test_export_logs_csv(self, db: Session, test_admin_user: User):
        """CSV 형식 로그 내보내기"""
        service = AuditLogService(db)

        # 로그 생성
        service.create_log(
            action="download",
            resource_type="evidence",
            resource_id=2,
            user_id=test_admin_user.id,
            user_email=test_admin_user.email,
            user_name=test_admin_user.name,
        )

        # CSV 내보내기
        result = service.export_logs(format="csv")

        assert "ID" in result  # 헤더 확인
        assert "Action" in result
        assert "download" in result


class TestLogUserActivityHelper:
    """log_user_activity 헬퍼 함수 테스트"""

    def test_log_evidence_view(self, db: Session, test_admin_user: User):
        """증적 조회 로그 헬퍼"""
        log = log_user_activity(
            db=db,
            user=test_admin_user,
            action="view",
            resource_type="evidence",
            resource_id=10,
            new_value={
                "evidence_title": "보안점검표",
                "file_name": "checklist.pdf",
            },
            request_method="GET",
            request_path="/api/v1/evidences/10/preview",
        )

        assert log.action == "view"
        assert log.resource_type == "evidence"
        assert log.resource_id == 10
        # JSON 파싱 후 확인 (유니코드 인코딩 처리)
        parsed_value = json.loads(log.new_value)
        assert parsed_value["evidence_title"] == "보안점검표"

    def test_log_evidence_download(self, db: Session, test_admin_user: User):
        """증적 다운로드 로그 헬퍼"""
        log = log_user_activity(
            db=db,
            user=test_admin_user,
            action="download",
            resource_type="evidence",
            resource_id=15,
            new_value={
                "evidence_title": "취약점진단결과",
                "file_name": "vuln_scan_2024.pdf",
            },
            request_method="GET",
            request_path="/api/v1/evidences/15/download",
        )

        assert log.action == "download"
        assert log.resource_type == "evidence"
        assert log.resource_id == 15
        # JSON 파싱 후 확인 (유니코드 인코딩 처리)
        parsed_value = json.loads(log.new_value)
        assert parsed_value["evidence_title"] == "취약점진단결과"
        assert parsed_value["file_name"] == "vuln_scan_2024.pdf"
