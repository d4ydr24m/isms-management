"""
증적 서비스
증적 관리 비즈니스 로직
"""
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, BinaryIO

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.control import ControlItem
from app.models.evidence import Evidence, EvidenceVersion, control_item_evidences
from app.models.user import User
from app.services.file_service import FileService


class EvidenceService:
    """
    증적 서비스

    기능:
    - 증적 CRUD
    - 버전 관리
    - 통제항목 매핑
    - 유효기간 관리
    """

    def __init__(self, db: Session):
        self.db = db
        self._file_service: Optional[FileService] = None

    @property
    def file_service(self) -> FileService:
        """FileService 지연 초기화"""
        if self._file_service is None:
            self._file_service = FileService()
        return self._file_service

    def set_file_service(self, file_service: FileService):
        """FileService 주입 (테스트용)"""
        self._file_service = file_service

    def create_evidence(
        self,
        file: BinaryIO,
        filename: str,
        content_type: str,
        title: str,
        uploader_id: int,
        description: Optional[str] = None,
        evidence_type: Optional[str] = None,
        valid_from: Optional[date] = None,
        valid_until: Optional[date] = None,
        control_ids: Optional[List[int]] = None,
        author: Optional[str] = None,
    ) -> Evidence:
        """
        증적 생성

        Args:
            file: 업로드 파일
            filename: 파일명
            content_type: MIME 타입
            title: 증적 제목
            uploader_id: 업로더 ID
            description: 설명
            evidence_type: 증적 유형
            valid_from: 유효 시작일
            valid_until: 유효 만료일
            control_ids: 연결할 통제항목 ID 목록
            author: 작성자

        Returns:
            Evidence: 생성된 증적
        """
        # 파일 업로드
        file_metadata = self.file_service.upload_file(
            file=file,
            filename=filename,
            content_type=content_type,
            folder="evidences",
        )

        # 증적 생성
        evidence = Evidence(
            title=title,
            description=description,
            file_path=file_metadata["file_path"],
            file_name=file_metadata["original_filename"],
            file_size=file_metadata["file_size"],
            file_hash=file_metadata["file_hash"],
            mime_type=file_metadata["mime_type"],
            version="1.0",
            status="active",
            valid_from=valid_from,
            valid_until=valid_until,
            uploader_id=uploader_id,
            author=author,
        )
        self.db.add(evidence)
        self.db.flush()

        # 통제항목 연결
        if control_ids:
            controls = (
                self.db.query(ControlItem)
                .filter(ControlItem.id.in_(control_ids))
                .all()
            )
            evidence.control_items.extend(controls)

        # 버전 히스토리 생성 (초기 버전)
        version = EvidenceVersion(
            evidence_id=evidence.id,
            version="1.0",
            file_path=file_metadata["file_path"],
            file_name=file_metadata["original_filename"],
            file_size=file_metadata["file_size"],
            file_hash=file_metadata["file_hash"],
            uploaded_by=uploader_id,
            change_description="최초 업로드",
        )
        self.db.add(version)

        self.db.commit()
        self.db.refresh(evidence)

        return evidence

    def create_version(
        self,
        evidence_id: int,
        file: BinaryIO,
        filename: str,
        content_type: str,
        uploader_id: int,
        change_description: Optional[str] = None,
    ) -> Evidence:
        """
        새 버전 생성

        Args:
            evidence_id: 증적 ID
            file: 업로드 파일
            filename: 파일명
            content_type: MIME 타입
            uploader_id: 업로더 ID
            change_description: 변경 설명

        Returns:
            Evidence: 업데이트된 증적
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError("증적을 찾을 수 없습니다.")

        # 파일 업로드
        file_metadata = self.file_service.upload_file(
            file=file,
            filename=filename,
            content_type=content_type,
            folder="evidences",
        )

        # 버전 증가 계산
        current_version = evidence.version
        try:
            major, minor = current_version.split(".")
            new_version = f"{major}.{int(minor) + 1}"
        except (ValueError, AttributeError):
            new_version = "1.1"

        # 증적 업데이트
        evidence.file_path = file_metadata["file_path"]
        evidence.file_name = file_metadata["original_filename"]
        evidence.file_size = file_metadata["file_size"]
        evidence.file_hash = file_metadata["file_hash"]
        evidence.mime_type = file_metadata["mime_type"]
        evidence.version = new_version

        # 버전 히스토리 추가
        version = EvidenceVersion(
            evidence_id=evidence.id,
            version=new_version,
            file_path=file_metadata["file_path"],
            file_name=file_metadata["original_filename"],
            file_size=file_metadata["file_size"],
            file_hash=file_metadata["file_hash"],
            uploaded_by=uploader_id,
            change_description=change_description,
        )
        self.db.add(version)

        self.db.commit()
        self.db.refresh(evidence)

        return evidence

    def update_evidence(
        self,
        evidence_id: int,
        title: Optional[str] = None,
        description: Optional[str] = None,
        valid_from: Optional[date] = None,
        valid_until: Optional[date] = None,
        author: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Evidence:
        """
        증적 정보 수정

        Args:
            evidence_id: 증적 ID
            title: 제목
            description: 설명
            valid_from: 유효 시작일
            valid_until: 유효 만료일
            author: 작성자
            status: 상태

        Returns:
            Evidence: 수정된 증적
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError("증적을 찾을 수 없습니다.")

        if title is not None:
            evidence.title = title
        if description is not None:
            evidence.description = description
        if valid_from is not None:
            evidence.valid_from = valid_from
        if valid_until is not None:
            evidence.valid_until = valid_until
        if author is not None:
            evidence.author = author
        if status is not None:
            evidence.status = status

        # 유효기간에 따라 상태 자동 변경
        if evidence.valid_until:
            if evidence.valid_until >= date.today() and evidence.status == "expired":
                evidence.status = "active"
            elif evidence.valid_until < date.today() and evidence.status == "active":
                evidence.status = "expired"

        self.db.commit()
        self.db.refresh(evidence)

        return evidence

    def delete_version(self, evidence_id: int, version_id: int) -> None:
        """
        증적의 특정 버전 삭제 (현재 버전은 삭제 불가)

        Args:
            evidence_id: 증적 ID
            version_id: 버전 ID
        """
        from app.models.evidence import EvidenceVersion

        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError("증적을 찾을 수 없습니다.")

        version = (
            self.db.query(EvidenceVersion)
            .filter(EvidenceVersion.id == version_id, EvidenceVersion.evidence_id == evidence_id)
            .first()
        )
        if not version:
            raise ValueError("버전을 찾을 수 없습니다.")

        # 현재 버전은 삭제 불가 (버전 문자열 비교)
        if version.version == evidence.version:
            raise ValueError("현재 버전은 삭제할 수 없습니다.")

        # MinIO 파일 삭제 (현재 evidence와 같은 파일이면 스킵)
        if version.file_path and version.file_path != evidence.file_path:
            try:
                self.file_service.delete_file(version.file_path)
            except Exception:
                pass

        self.db.delete(version)
        self.db.commit()

    def delete_evidence(self, evidence_id: int) -> None:
        """
        증적 완전 삭제 (hard delete)

        증적, 버전 이력, 통제항목 매핑, MinIO 파일을 모두 삭제합니다.

        Args:
            evidence_id: 증적 ID
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError("증적을 찾을 수 없습니다.")

        # MinIO에서 파일 삭제
        try:
            if evidence.file_path:
                self.file_service.delete_file(evidence.file_path)
            # 버전 파일도 삭제
            for version in evidence.versions:
                if version.file_path and version.file_path != evidence.file_path:
                    try:
                        self.file_service.delete_file(version.file_path)
                    except Exception:
                        pass
        except Exception:
            pass  # 파일 삭제 실패해도 DB 삭제는 진행

        # 통제항목 매핑 삭제
        from app.models.evidence import control_item_evidences
        self.db.execute(
            control_item_evidences.delete().where(
                control_item_evidences.c.evidence_id == evidence_id
            )
        )

        # 버전 이력 삭제
        for version in evidence.versions:
            self.db.delete(version)

        # 증적 삭제
        self.db.delete(evidence)
        self.db.commit()

    def update_control_mappings(
        self,
        evidence_id: int,
        control_ids: List[int],
        add: bool = True,
    ) -> Evidence:
        """
        증적-통제항목 매핑 추가/제거

        Args:
            evidence_id: 증적 ID
            control_ids: 통제항목 ID 목록
            add: True면 추가, False면 제거

        Returns:
            Evidence: 업데이트된 증적
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError("증적을 찾을 수 없습니다.")

        controls = (
            self.db.query(ControlItem)
            .filter(ControlItem.id.in_(control_ids))
            .all()
        )

        if add:
            for control in controls:
                if control not in evidence.control_items:
                    evidence.control_items.append(control)
        else:
            for control in controls:
                if control in evidence.control_items:
                    evidence.control_items.remove(control)

        self.db.commit()
        self.db.refresh(evidence)

        return evidence

    def replace_control_mappings(
        self,
        evidence_id: int,
        control_ids: List[int],
    ) -> Evidence:
        """
        증적-통제항목 매핑 전체 교체

        기존 매핑을 모두 제거하고 새로운 매핑으로 교체합니다.

        Args:
            evidence_id: 증적 ID
            control_ids: 새로운 통제항목 ID 목록

        Returns:
            Evidence: 업데이트된 증적
        """
        evidence = self.db.query(Evidence).filter(Evidence.id == evidence_id).first()
        if not evidence:
            raise ValueError("증적을 찾을 수 없습니다.")

        # 새 통제항목 목록으로 교체
        controls = (
            self.db.query(ControlItem)
            .filter(ControlItem.id.in_(control_ids))
            .all()
        ) if control_ids else []

        evidence.control_items = controls
        self.db.commit()
        self.db.refresh(evidence)

        return evidence

    def check_expiring_evidences(
        self,
        days: int = 30,
    ) -> List[Evidence]:
        """
        유효기간 만료 예정 증적 조회

        Args:
            days: 만료 임계일 수 (기본 30일)

        Returns:
            List[Evidence]: 만료 예정 증적 목록
        """
        threshold_date = date.today() + timedelta(days=days)

        return (
            self.db.query(Evidence)
            .filter(
                Evidence.status == "active",
                Evidence.valid_until.isnot(None),
                Evidence.valid_until <= threshold_date,
                Evidence.valid_until >= date.today(),
            )
            .order_by(Evidence.valid_until)
            .all()
        )

    def search_evidences(
        self,
        search: Optional[str] = None,
        evidence_type: Optional[str] = None,
        status: Optional[str] = None,
        control_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict:
        """
        증적 검색

        Args:
            search: 검색어 (제목, 설명)
            evidence_type: 증적 유형
            status: 상태
            control_id: 통제항목 ID
            page: 페이지 번호
            page_size: 페이지 크기

        Returns:
            dict: 검색 결과 (items, total, page, page_size, total_pages)
        """
        query = self.db.query(Evidence)

        # 검색어 필터
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Evidence.title.ilike(search_term),
                    Evidence.description.ilike(search_term),
                )
            )

        # 상태 필터
        if status:
            query = query.filter(Evidence.status == status)

        # 통제항목 필터
        if control_id:
            query = query.join(control_item_evidences).filter(
                control_item_evidences.c.control_item_id == control_id
            )

        # 전체 개수
        total = query.count()

        # 페이지네이션
        offset = (page - 1) * page_size
        items = (
            query
            .order_by(Evidence.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        total_pages = (total + page_size - 1) // page_size

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    def get_evidence_by_id(self, evidence_id: int) -> Optional[Evidence]:
        """
        ID로 증적 조회

        Args:
            evidence_id: 증적 ID

        Returns:
            Evidence: 증적 또는 None
        """
        return self.db.query(Evidence).filter(Evidence.id == evidence_id).first()

    def get_version_history(self, evidence_id: int) -> List[EvidenceVersion]:
        """
        버전 히스토리 조회

        Args:
            evidence_id: 증적 ID

        Returns:
            List[EvidenceVersion]: 버전 히스토리
        """
        return (
            self.db.query(EvidenceVersion)
            .filter(EvidenceVersion.evidence_id == evidence_id)
            .order_by(EvidenceVersion.created_at.desc())
            .all()
        )
