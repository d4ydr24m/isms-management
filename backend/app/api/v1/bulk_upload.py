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
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.security import get_password_hash, validate_password_policy
from app.models.department import Department
from app.models.personnel import Personnel
from app.models.user import User

router = APIRouter()

# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


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
    current_user: User = Depends(get_current_active_user),
):
    """사용자 일괄 등록용 Excel 템플릿 다운로드"""
    wb = Workbook()
    ws = wb.active
    ws.title = "사용자 일괄 등록"

    # 헤더
    headers = ["이메일(필수)", "비밀번호(필수)", "이름(필수)", "전화번호", "부서코드"]
    ws.append(headers)

    if include_data:
        users = db.query(User).filter(User.is_active == True).order_by(User.name).all()
        for u in users:
            dept_code = ""
            if u.department_id:
                dept = db.query(Department).filter(Department.id == u.department_id).first()
                if dept:
                    dept_code = dept.code
            ws.append([u.email, "", u.name, u.phone or "", dept_code])
    else:
        # 샘플 행
        ws.append(["user@example.com", "Password1!", "홍길동", "010-1234-5678", "DEV"])

    filename = "user_bulk_data.xlsx" if include_data else "user_bulk_template.xlsx"
    return _workbook_to_streaming_response(wb, filename)


@router.post("/users/upload")
def upload_users(
    file: UploadFile = File(...),
    update_existing: bool = Query(False, description="기존 데이터 업데이트 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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

        # 부서 코드 조회
        department_id = None
        if dept_code:
            dept = db.query(Department).filter(Department.code == dept_code).first()
            if not dept:
                failed += 1
                errors.append({
                    "row": idx,
                    "email": email,
                    "error": f"존재하지 않는 부서코드입니다: {dept_code}",
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
    current_user: User = Depends(get_current_active_user),
):
    """부서 일괄 등록용 Excel 템플릿 다운로드"""
    wb = Workbook()
    ws = wb.active
    ws.title = "부서 일괄 등록"

    # 헤더
    headers = ["부서명(필수)", "부서코드(필수)", "설명", "상위부서코드"]
    ws.append(headers)

    if include_data:
        depts = db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()
        dept_map = {d.id: d.code for d in depts}
        for d in depts:
            parent_code = dept_map.get(d.parent_id, "") if d.parent_id else ""
            ws.append([d.name, d.code, d.description or "", parent_code])
    else:
        # 샘플 행
        ws.append(["개발팀", "DEV", "소프트웨어 개발 부서", "IT"])

    filename = "department_bulk_data.xlsx" if include_data else "department_bulk_template.xlsx"
    return _workbook_to_streaming_response(wb, filename)


@router.post("/departments/upload")
def upload_departments(
    file: UploadFile = File(...),
    update_existing: bool = Query(False, description="기존 데이터 업데이트 여부"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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

        # 상위 부서 코드 조회
        parent_id = None
        if parent_code:
            parent_dept = db.query(Department).filter(Department.code == parent_code).first()
            if not parent_dept:
                failed += 1
                errors.append({
                    "row": idx,
                    "name": name,
                    "error": f"존재하지 않는 상위부서코드입니다: {parent_code}",
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
    current_user: User = Depends(get_current_active_user),
):
    """담당자 일괄 등록용 Excel 템플릿 다운로드"""
    wb = Workbook()
    ws = wb.active
    ws.title = "담당자 일괄 등록"

    # 헤더
    headers = ["이름(필수)", "이메일", "전화번호", "직위", "부서코드", "비고"]
    ws.append(headers)

    if include_data:
        people = db.query(Personnel).filter(Personnel.is_active == True).order_by(Personnel.name).all()
        for p in people:
            dept_code = ""
            if p.department_id:
                dept = db.query(Department).filter(Department.id == p.department_id).first()
                if dept:
                    dept_code = dept.code
            ws.append([p.name, p.email or "", p.phone or "", p.position or "", dept_code, p.note or ""])
    else:
        # 샘플 행
        ws.append(["홍길동", "hong@example.com", "010-1234-5678", "대리", "DEV", "개발팀 담당자"])

    filename = "personnel_bulk_data.xlsx" if include_data else "personnel_bulk_template.xlsx"
    return _workbook_to_streaming_response(wb, filename)


@router.post("/personnel/upload")
def upload_personnel(
    file: UploadFile = File(...),
    update_existing: bool = Query(False, description="기존 데이터 업데이트 여부 (이메일 기준)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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

        # 부서 코드 조회
        p_department_id = None
        if p_dept_code:
            dept = db.query(Department).filter(Department.code == p_dept_code).first()
            if not dept:
                failed += 1
                errors_list.append({
                    "row": idx,
                    "name": p_name,
                    "error": f"존재하지 않는 부서코드입니다: {p_dept_code}",
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
