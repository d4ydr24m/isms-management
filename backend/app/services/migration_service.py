"""
엑셀 데이터 마이그레이션 서비스
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import load_workbook
from sqlalchemy.orm import Session

from app.models.control import ControlItem
from app.models.evidence import Evidence


class MigrationError:
    """마이그레이션 오류 정보"""

    def __init__(self, row: int, column: str, message: str, value: Any = None):
        self.row = row
        self.column = column
        self.message = message
        self.value = value

    def to_dict(self) -> dict:
        return {
            "row": self.row,
            "column": self.column,
            "message": self.message,
            "value": str(self.value) if self.value else None,
        }


class MigrationResult:
    """마이그레이션 결과"""

    def __init__(self):
        self.id = str(uuid.uuid4())
        self.success_count = 0
        self.error_count = 0
        self.errors: List[MigrationError] = []
        self.preview_data: List[Dict] = []
        self.created_evidences: List[int] = []

    def add_error(self, row: int, column: str, message: str, value: Any = None):
        self.errors.append(MigrationError(row, column, message, value))
        self.error_count += 1

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "errors": [e.to_dict() for e in self.errors],
            "preview_data": self.preview_data,
            "created_evidences": self.created_evidences,
        }


class MigrationService:
    """
    엑셀 데이터 마이그레이션 서비스

    기능:
    - 엑셀 파일 파싱
    - 매핑 검증
    - 미리보기
    - 실행
    """

    # 필수 컬럼
    REQUIRED_COLUMNS = ["title"]

    # 지원 컬럼
    SUPPORTED_COLUMNS = [
        "title",
        "description",
        "control_code",
        "valid_from",
        "valid_until",
        "author",
        "file_path",
    ]

    def __init__(self, db: Session):
        self.db = db
        self._control_cache: Dict[str, int] = {}

    def _load_control_cache(self):
        """통제항목 코드 캐시 로드"""
        if not self._control_cache:
            controls = self.db.query(ControlItem).all()
            self._control_cache = {c.code: c.id for c in controls}

    def _validate_control_code(self, code: str) -> Optional[int]:
        """통제항목 코드 검증 및 ID 반환"""
        self._load_control_cache()
        return self._control_cache.get(code)

    def _parse_date(self, value: Any) -> Optional[datetime]:
        """날짜 파싱"""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except ValueError:
                try:
                    return datetime.strptime(value, "%Y/%m/%d").date()
                except ValueError:
                    return None
        return None

    def preview(
        self,
        file_content: bytes,
        sheet_name: Optional[str] = None,
    ) -> MigrationResult:
        """
        엑셀 파일 미리보기 및 검증

        Args:
            file_content: 엑셀 파일 내용
            sheet_name: 시트 이름 (None이면 첫 번째 시트)

        Returns:
            MigrationResult: 미리보기 결과
        """
        import io

        result = MigrationResult()

        try:
            wb = load_workbook(io.BytesIO(file_content), data_only=True)
            if sheet_name:
                ws = wb[sheet_name]
            else:
                ws = wb.active
        except Exception as e:
            result.add_error(0, "", f"엑셀 파일 로드 실패: {str(e)}")
            return result

        # 헤더 읽기
        headers = []
        for cell in ws[1]:
            if cell.value:
                headers.append(str(cell.value).strip().lower())

        # 필수 컬럼 확인
        for required in self.REQUIRED_COLUMNS:
            if required not in headers:
                result.add_error(1, required, f"필수 컬럼 누락: {required}")

        if result.error_count > 0:
            return result

        # 데이터 행 검증
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            row_data = {}

            for col_idx, value in enumerate(row):
                if col_idx < len(headers):
                    header = headers[col_idx]
                    row_data[header] = value

            # 빈 행 건너뛰기
            if not any(row_data.values()):
                continue

            # title 필수 체크
            if not row_data.get("title"):
                result.add_error(row_idx, "title", "제목이 비어있습니다.")
                continue

            # 통제항목 코드 검증
            control_code = row_data.get("control_code")
            control_id = None
            if control_code:
                control_id = self._validate_control_code(str(control_code))
                if control_id is None:
                    result.add_error(
                        row_idx,
                        "control_code",
                        f"존재하지 않는 통제항목 코드: {control_code}",
                        control_code,
                    )

            # 날짜 검증
            valid_from = row_data.get("valid_from")
            if valid_from and not self._parse_date(valid_from):
                result.add_error(
                    row_idx,
                    "valid_from",
                    f"잘못된 날짜 형식: {valid_from}",
                    valid_from,
                )

            valid_until = row_data.get("valid_until")
            if valid_until and not self._parse_date(valid_until):
                result.add_error(
                    row_idx,
                    "valid_until",
                    f"잘못된 날짜 형식: {valid_until}",
                    valid_until,
                )

            # 미리보기 데이터 추가
            preview_item = {
                "row": row_idx,
                "title": row_data.get("title"),
                "description": row_data.get("description"),
                "control_code": control_code,
                "control_id": control_id,
                "valid_from": str(valid_from) if valid_from else None,
                "valid_until": str(valid_until) if valid_until else None,
                "author": row_data.get("author"),
                "has_error": False,
            }

            # 해당 행에 오류가 있는지 확인
            for error in result.errors:
                if error.row == row_idx:
                    preview_item["has_error"] = True
                    break

            if not preview_item["has_error"]:
                result.success_count += 1

            result.preview_data.append(preview_item)

        return result

    def execute(
        self,
        file_content: bytes,
        uploader_id: int,
        sheet_name: Optional[str] = None,
        skip_errors: bool = False,
    ) -> MigrationResult:
        """
        마이그레이션 실행

        Args:
            file_content: 엑셀 파일 내용
            uploader_id: 업로더 ID
            sheet_name: 시트 이름
            skip_errors: 오류 행 건너뛰기

        Returns:
            MigrationResult: 실행 결과
        """
        import io

        result = MigrationResult()

        try:
            wb = load_workbook(io.BytesIO(file_content), data_only=True)
            if sheet_name:
                ws = wb[sheet_name]
            else:
                ws = wb.active
        except Exception as e:
            result.add_error(0, "", f"엑셀 파일 로드 실패: {str(e)}")
            return result

        # 헤더 읽기
        headers = []
        for cell in ws[1]:
            if cell.value:
                headers.append(str(cell.value).strip().lower())

        # 데이터 행 처리
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            row_data = {}

            for col_idx, value in enumerate(row):
                if col_idx < len(headers):
                    header = headers[col_idx]
                    row_data[header] = value

            # 빈 행 건너뛰기
            if not any(row_data.values()):
                continue

            # title 필수 체크
            title = row_data.get("title")
            if not title:
                result.add_error(row_idx, "title", "제목이 비어있습니다.")
                continue

            # 통제항목 코드 검증
            control_code = row_data.get("control_code")
            control_ids = []
            if control_code:
                control_id = self._validate_control_code(str(control_code))
                if control_id is None:
                    result.add_error(
                        row_idx,
                        "control_code",
                        f"존재하지 않는 통제항목 코드: {control_code}",
                        control_code,
                    )
                    if not skip_errors:
                        continue
                else:
                    control_ids = [control_id]

            # 날짜 파싱
            valid_from = self._parse_date(row_data.get("valid_from"))
            valid_until = self._parse_date(row_data.get("valid_until"))

            # 증적 생성 (파일 없이 메타데이터만)
            try:
                evidence = Evidence(
                    title=str(title),
                    description=row_data.get("description"),
                    file_path=row_data.get("file_path") or f"imported/{uuid.uuid4().hex}",
                    file_name=f"{title}.imported",
                    file_size=0,
                    file_hash="0" * 64,
                    mime_type="application/octet-stream",
                    version="1.0",
                    status="active",
                    valid_from=valid_from,
                    valid_until=valid_until,
                    uploader_id=uploader_id,
                    author=row_data.get("author"),
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

                result.created_evidences.append(evidence.id)
                result.success_count += 1

            except Exception as e:
                result.add_error(row_idx, "", f"증적 생성 실패: {str(e)}")
                if not skip_errors:
                    self.db.rollback()
                    return result

        self.db.commit()
        return result
