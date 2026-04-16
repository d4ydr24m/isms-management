"""
대량 업로드 (Bulk Upload) API
사용자 및 부서 Excel 일괄 등록
"""
import re
from io import BytesIO
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_permission
from app.core.security import get_password_hash, validate_password_policy
from app.models.department import Department
from app.models.personnel import Personnel
from app.models.user import User

router = APIRouter()

# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

# 공통 스타일
_HEADER_FONT = Font(bold=True, color="FFFFFF")
_REQUIRED_FILL = PatternFill(start_color="FF6B6B", end_color="FF6B6B", fill_type="solid")
_OPTIONAL_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
_CENTER = Alignment(horizontal="center")


def _style_header(ws, headers: list[tuple[str, bool]]):
    """헤더 행에 스타일 적용 (필수=빨간, 선택=파란)"""
    for col, (name, required) in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=name)
        cell.font = _HEADER_FONT
        cell.fill = _REQUIRED_FILL if required else _OPTIONAL_FILL
        cell.alignment = _CENTER


def _add_dept_validation(ws, db: Session, col_letter: str, max_row: int = 1000):
    """부서코드 드롭다운을 시트에 추가하고 참조시트를 반환"""
    wb = ws.parent
    depts = db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()
    if not depts:
        return

    # 참조 시트 생성 (없으면)
    ref_name = "참조데이터"
    if ref_name in wb.sheetnames:
        ref_ws = wb[ref_name]
    else:
        ref_ws = wb.create_sheet(title=ref_name)
        ref_ws.sheet_state = "hidden"

    # 부서 목록을 참조시트 A열에 기록
    ref_ws.cell(row=1, column=1, value="부서코드")
    for i, d in enumerate(depts, 2):
        ref_ws.cell(row=i, column=1, value=f"{d.code} ({d.name})")
    last_row = len(depts) + 1

    dv = DataValidation(
        type="list",
        formula1=f"참조데이터!$A$2:$A${last_row}",
        allow_blank=True,
    )
    dv.error = "목록에서 부서를 선택하세요."
    dv.errorTitle = "부서 오류"
    dv.prompt = "부서를 선택하세요"
    dv.promptTitle = "부서"
    ws.add_data_validation(dv)
    dv.add(f"{col_letter}2:{col_letter}{max_row}")


def _extract_code(value) -> str:
    """'CODE (NAME)' 또는 'CODE' 형식에서 코드 부분만 추출"""
    s = str(value).strip()
    if " (" in s:
        return s.split(" (")[0].strip()
    return s


def _workbook_to_streaming_response(wb: Workbook, filename: str) -> StreamingResponse:
    """Workbook을 StreamingResponse로 변환"""
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# 사용자 대량 업로드
# ---------------------------------------------------------------------------


@router.get("/users/template")
def download_user_template(
    include_data: bool = Query(False, description="기존 데이터 포함 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
):
    """사용자 일괄 등록용 Excel 템플릿 다운로드"""
    wb = Workbook()
    ws = wb.active
    ws.title = "사용자 일괄 등록"

    # 헤더 (필수=빨간, 선택=파란)
    headers = [
        ("이메일 ★", True),
        ("비밀번호 ★", True),
        ("이름 ★", True),
        ("전화번호", False),
        ("부서", False),
    ]
    _style_header(ws, headers)

    # 부서 드롭다운 (E열)
    _add_dept_validation(ws, db, "E")

    if include_data:
        users = db.query(User).filter(User.is_active == True).order_by(User.name).all()
        for i, u in enumerate(users, 2):
            ws.cell(row=i, column=1, value=u.email)
            ws.cell(row=i, column=2, value="")
            ws.cell(row=i, column=3, value=u.name)
            ws.cell(row=i, column=4, value=u.phone or "")
            dept_label = ""
            if u.department_id:
                dept = db.query(Department).filter(Department.id == u.department_id).first()
                if dept:
                    dept_label = f"{dept.code} ({dept.name})"
            ws.cell(row=i, column=5, value=dept_label)
    else:
        # 샘플 행
        ws.append(["user@example.com", "Password1!", "홍길동", "010-1234-5678", ""])

    # 열 너비
    for col, w in enumerate([25, 18, 15, 18, 25], 1):
        ws.column_dimensions[chr(64 + col)].width = w

    ws.auto_filter.ref = "A1:E1"

    filename = "user_bulk_data.xlsx" if include_data else "user_bulk_template.xlsx"
    return _workbook_to_streaming_response(wb, filename)


@router.post("/users/upload")
def upload_users(
    file: UploadFile = File(...),
    update_existing: bool = Query(False, description="기존 데이터 업데이트 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
):
    """Excel 파일로 사용자 일괄 등록 (update_existing=true 시 기존 사용자 업데이트)"""
    # 파일 유효성 검사
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="xlsx 형식의 Excel 파일만 업로드 가능합니다.")

    try:
        contents = file.file.read()
        wb = load_workbook(filename=BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Excel 파일을 읽을 수 없습니다.")

    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))  # 헤더 제외

    total = len(rows)
    success = 0
    created = 0
    updated = 0
    failed = 0
    errors: List[dict] = []

    for idx, row in enumerate(rows, start=2):
        # 빈 행 건너뛰기
        if not row or all(cell is None for cell in row):
            total -= 1
            continue

        email = str(row[0]).strip() if row[0] else ""
        password = str(row[1]).strip() if row[1] else ""
        name = str(row[2]).strip() if len(row) > 2 and row[2] else ""
        phone = str(row[3]).strip() if len(row) > 3 and row[3] else None
        dept_code = str(row[4]).strip() if len(row) > 4 and row[4] else None

        # 필수 필드 검증
        if not email:
            failed += 1
            errors.append({"row": idx, "email": email, "error": "이메일은 필수 항목입니다."})
            continue

        # 업데이트 모드에서는 비밀번호 선택적
        if not password and not (update_existing and db.query(User).filter(User.email == email).first()):
            failed += 1
            errors.append({"row": idx, "email": email, "error": "비밀번호는 필수 항목입니다."})
            continue

        if not name:
            failed += 1
            errors.append({"row": idx, "email": email, "error": "이름은 필수 항목입니다."})
            continue

        # 이메일 형식 검증
        if not EMAIL_REGEX.match(email):
            failed += 1
            errors.append({"row": idx, "email": email, "error": "이메일 형식이 올바르지 않습니다."})
            continue

        # 비밀번호 정책 검증 (비밀번호가 있을 때만)
        if password:
            pw_result = validate_password_policy(password)
        else:
            pw_result = {"valid": True, "errors": []}
        if not pw_result["valid"]:
            failed += 1
            errors.append({
                "row": idx,
                "email": email,
                "error": "비밀번호 정책 위반: " + "; ".join(pw_result["errors"]),
            })
            continue

        # 이메일 중복 검사
        existing = db.query(User).filter(User.email == email).first()
        if existing and not update_existing:
            failed += 1
            errors.append({"row": idx, "email": email, "error": "이미 등록된 이메일입니다."})
            continue

        # 부서 코드 조회 ("CODE (NAME)" 형식 지원)
        department_id = None
        if dept_code:
            parsed_code = _extract_code(dept_code)
            dept = db.query(Department).filter(Department.code == parsed_code).first()
            if not dept:
                failed += 1
                errors.append({
                    "row": idx,
                    "email": email,
                    "error": f"존재하지 않는 부서코드입니다: {parsed_code}",
                })
                continue
            department_id = dept.id

        try:
            if existing and update_existing:
                # 기존 사용자 업데이트
                existing.name = name
                if password:
                    existing.hashed_password = get_password_hash(password)
                existing.phone = phone
                existing.department_id = department_id
                db.flush()
                updated += 1
            else:
                # 사용자 생성
                user = User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    name=name,
                    phone=phone,
                    department_id=department_id,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                created += 1
            success += 1
        except Exception as e:
            db.rollback()
            failed += 1
            errors.append({"row": idx, "email": email, "error": f"처리 실패: {str(e)}"})

    # 모든 성공 건 커밋
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="데이터 저장 중 오류가 발생했습니다.")

    return {
        "total": total,
        "success": success,
        "created": created,
        "updated": updated,
        "failed": failed,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# 부서 대량 업로드
# ---------------------------------------------------------------------------


@router.get("/departments/template")
def download_department_template(
    include_data: bool = Query(False, description="기존 데이터 포함 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
):
    """부서 일괄 등록용 Excel 템플릿 다운로드"""
    wb = Workbook()
    ws = wb.active
    ws.title = "부서 일괄 등록"

    # 헤더 (필수=빨간, 선택=파란)
    headers = [
        ("부서명 ★", True),
        ("부서코드 ★", True),
        ("설명", False),
        ("상위부서", False),
    ]
    _style_header(ws, headers)

    # 상위부서 드롭다운 (D열)
    _add_dept_validation(ws, db, "D")

    if include_data:
        depts = db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()
        dept_map = {d.id: d for d in depts}
        for i, d in enumerate(depts, 2):
            ws.cell(row=i, column=1, value=d.name)
            ws.cell(row=i, column=2, value=d.code)
            ws.cell(row=i, column=3, value=d.description or "")
            parent_label = ""
            if d.parent_id and d.parent_id in dept_map:
                p = dept_map[d.parent_id]
                parent_label = f"{p.code} ({p.name})"
            ws.cell(row=i, column=4, value=parent_label)
    else:
        # 샘플 행
        ws.append(["개발팀", "DEV", "소프트웨어 개발 부서", ""])

    # 열 너비
    for col, w in enumerate([20, 15, 30, 25], 1):
        ws.column_dimensions[chr(64 + col)].width = w

    ws.auto_filter.ref = "A1:D1"

    filename = "department_bulk_data.xlsx" if include_data else "department_bulk_template.xlsx"
    return _workbook_to_streaming_response(wb, filename)


@router.post("/departments/upload")
def upload_departments(
    file: UploadFile = File(...),
    update_existing: bool = Query(False, description="기존 데이터 업데이트 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
):
    """Excel 파일로 부서 일괄 등록 (update_existing=true 시 기존 부서 업데이트)"""
    # 파일 유효성 검사
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="xlsx 형식의 Excel 파일만 업로드 가능합니다.")

    try:
        contents = file.file.read()
        wb = load_workbook(filename=BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Excel 파일을 읽을 수 없습니다.")

    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))  # 헤더 제외

    total = len(rows)
    success = 0
    created = 0
    updated = 0
    failed = 0
    errors: List[dict] = []

    for idx, row in enumerate(rows, start=2):
        # 빈 행 건너뛰기
        if not row or all(cell is None for cell in row):
            total -= 1
            continue

        name = str(row[0]).strip() if row[0] else ""
        code = str(row[1]).strip() if len(row) > 1 and row[1] else ""
        description = str(row[2]).strip() if len(row) > 2 and row[2] else None
        parent_code = str(row[3]).strip() if len(row) > 3 and row[3] else None

        # 필수 필드 검증
        if not name:
            failed += 1
            errors.append({"row": idx, "name": name, "error": "부서명은 필수 항목입니다."})
            continue

        if not code:
            failed += 1
            errors.append({"row": idx, "name": name, "error": "부서코드는 필수 항목입니다."})
            continue

        # 부서코드 중복 검사
        existing = db.query(Department).filter(Department.code == code).first()
        if existing and not update_existing:
            failed += 1
            errors.append({"row": idx, "name": name, "error": f"이미 등록된 부서코드입니다: {code}"})
            continue

        # 상위 부서 코드 조회 ("CODE (NAME)" 형식 지원)
        parent_id = None
        if parent_code:
            parsed_parent = _extract_code(parent_code)
            parent_dept = db.query(Department).filter(Department.code == parsed_parent).first()
            if not parent_dept:
                failed += 1
                errors.append({
                    "row": idx,
                    "name": name,
                    "error": f"존재하지 않는 상위부서코드입니다: {parsed_parent}",
                })
                continue
            parent_id = parent_dept.id

        try:
            if existing and update_existing:
                # 기존 부서 업데이트
                existing.name = name
                existing.description = description
                existing.parent_id = parent_id
                db.flush()
                updated += 1
            else:
                # 부서 생성
                dept = Department(
                    name=name,
                    code=code,
                    description=description,
                    parent_id=parent_id,
                    is_active=True,
                )
                db.add(dept)
                db.flush()
                created += 1
            success += 1
        except Exception as e:
            db.rollback()
            failed += 1
            errors.append({"row": idx, "name": name, "error": f"처리 실패: {str(e)}"})

    # 모든 성공 건 커밋
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="데이터 저장 중 오류가 발생했습니다.")

    return {
        "total": total,
        "success": success,
        "created": created,
        "updated": updated,
        "failed": failed,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# 담당자 대량 업로드
# ---------------------------------------------------------------------------


@router.get("/personnel/template")
def download_personnel_template(
    include_data: bool = Query(False, description="기존 데이터 포함 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
):
    """담당자 일괄 등록용 Excel 템플릿 다운로드"""
    wb = Workbook()
    ws = wb.active
    ws.title = "담당자 일괄 등록"

    # 헤더 (필수=빨간, 선택=파란)
    headers = [
        ("이름 ★", True),
        ("이메일", False),
        ("전화번호", False),
        ("직위", False),
        ("부서", False),
        ("비고", False),
    ]
    _style_header(ws, headers)

    # 부서 드롭다운 (E열)
    _add_dept_validation(ws, db, "E")

    if include_data:
        people = db.query(Personnel).filter(Personnel.is_active == True).order_by(Personnel.name).all()
        for i, p in enumerate(people, 2):
            ws.cell(row=i, column=1, value=p.name)
            ws.cell(row=i, column=2, value=p.email or "")
            ws.cell(row=i, column=3, value=p.phone or "")
            ws.cell(row=i, column=4, value=p.position or "")
            dept_label = ""
            if p.department_id:
                dept = db.query(Department).filter(Department.id == p.department_id).first()
                if dept:
                    dept_label = f"{dept.code} ({dept.name})"
            ws.cell(row=i, column=5, value=dept_label)
            ws.cell(row=i, column=6, value=p.note or "")
    else:
        # 샘플 행
        ws.append(["홍길동", "hong@example.com", "010-1234-5678", "대리", "", "개발팀 담당자"])

    # 열 너비
    for col, w in enumerate([15, 25, 18, 12, 25, 20], 1):
        ws.column_dimensions[chr(64 + col)].width = w

    ws.auto_filter.ref = "A1:F1"

    filename = "personnel_bulk_data.xlsx" if include_data else "personnel_bulk_template.xlsx"
    return _workbook_to_streaming_response(wb, filename)


@router.post("/personnel/upload")
def upload_personnel(
    file: UploadFile = File(...),
    update_existing: bool = Query(False, description="기존 데이터 업데이트 여부 (이메일 기준)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
):
    """Excel 파일로 담당자 일괄 등록 (update_existing=true 시 이메일 기준 기존 담당자 업데이트)"""
    # 파일 유효성 검사
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="xlsx 형식의 Excel 파일만 업로드 가능합니다.")

    try:
        contents = file.file.read()
        wb = load_workbook(filename=BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Excel 파일을 읽을 수 없습니다.")

    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))  # 헤더 제외

    total = len(rows)
    success = 0
    created = 0
    updated = 0
    failed = 0
    errors_list: List[dict] = []

    for idx, row in enumerate(rows, start=2):
        # 빈 행 건너뛰기
        if not row or all(cell is None for cell in row):
            total -= 1
            continue

        p_name = str(row[0]).strip() if row[0] else ""
        p_email = str(row[1]).strip() if len(row) > 1 and row[1] else None
        p_phone = str(row[2]).strip() if len(row) > 2 and row[2] else None
        p_position = str(row[3]).strip() if len(row) > 3 and row[3] else None
        p_dept_code = str(row[4]).strip() if len(row) > 4 and row[4] else None
        p_note = str(row[5]).strip() if len(row) > 5 and row[5] else None

        # 필수 필드 검증
        if not p_name:
            failed += 1
            errors_list.append({"row": idx, "name": p_name, "error": "이름은 필수 항목입니다."})
            continue

        # 이메일 형식 검증 (있는 경우)
        if p_email and not EMAIL_REGEX.match(p_email):
            failed += 1
            errors_list.append({"row": idx, "name": p_name, "error": "이메일 형식이 올바르지 않습니다."})
            continue

        # 이메일 중복 검사 (이메일이 있는 경우)
        existing_p = None
        if p_email:
            existing_p = db.query(Personnel).filter(Personnel.email == p_email).first()
            if existing_p and not update_existing:
                failed += 1
                errors_list.append({"row": idx, "name": p_name, "error": "이미 등록된 이메일입니다."})
                continue

        # 부서 코드 조회 ("CODE (NAME)" 형식 지원)
        p_department_id = None
        if p_dept_code:
            parsed_dept = _extract_code(p_dept_code)
            dept = db.query(Department).filter(Department.code == parsed_dept).first()
            if not dept:
                failed += 1
                errors_list.append({
                    "row": idx,
                    "name": p_name,
                    "error": f"존재하지 않는 부서코드입니다: {parsed_dept}",
                })
                continue
            p_department_id = dept.id

        try:
            if existing_p and update_existing:
                # 기존 담당자 업데이트
                existing_p.name = p_name
                existing_p.phone = p_phone
                existing_p.position = p_position
                existing_p.department_id = p_department_id
                existing_p.note = p_note
                db.flush()
                updated += 1
            else:
                # 담당자 생성
                personnel = Personnel(
                    name=p_name,
                    email=p_email,
                    phone=p_phone,
                    position=p_position,
                    department_id=p_department_id,
                    note=p_note,
                    is_active=True,
                )
                db.add(personnel)
                db.flush()
                created += 1
            success += 1
        except Exception as e:
            db.rollback()
            failed += 1
            errors_list.append({"row": idx, "name": p_name, "error": f"처리 실패: {str(e)}"})

    # 모든 성공 건 커밋
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="데이터 저장 중 오류가 발생했습니다.")

    return {
        "total": total,
        "success": success,
        "created": created,
        "updated": updated,
        "failed": failed,
        "errors": errors_list,
    }
