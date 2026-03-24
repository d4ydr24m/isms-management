"""
시스템 설정 API 라우터
/api/v1/system-settings
"""
from typing import Dict

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, require_permission
from app.models.user import User
from app.models.system_setting import SystemSetting

router = APIRouter(prefix="/system-settings", tags=["시스템 설정"])

# 기본 설정 값
DEFAULTS = {
    "certification_type": "ISMS-P",  # "ISMS" or "ISMS-P"
    # Security settings
    "max_login_attempts": "5",
    "account_lockout_duration_minutes": "30",
    "session_timeout_minutes": "30",
    "password_min_length": "8",
    "password_require_uppercase": "true",
    "password_require_lowercase": "true",
    "password_require_digit": "true",
    "password_require_special": "true",
    "password_expiry_days": "90",
    # IP whitelist (comma-separated, empty = allow all)
    "ip_whitelist": "",
    "ip_whitelist_enabled": "false",
    # SMTP settings
    "smtp_host": "",
    "smtp_port": "587",
    "smtp_user": "",
    "smtp_password": "",
    "smtp_use_tls": "true",
    "smtp_from_email": "",
    "smtp_from_name": "ISMS 관리 시스템",
    "smtp_enabled": "false",
}


def _get_setting(db: Session, key: str) -> str:
    """설정 값을 조회하고, 없으면 기본값 반환"""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        return setting.value
    return DEFAULTS.get(key, "")


def _set_setting(db: Session, key: str, value: str, description: str = None):
    """설정 값을 저장 (upsert)"""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        setting.value = value
        if description:
            setting.description = description
    else:
        setting = SystemSetting(key=key, value=value, description=description)
        db.add(setting)
    db.commit()
    return setting


@router.get("")
def get_all_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, str]:
    """전체 시스템 설정 조회"""
    settings = db.query(SystemSetting).all()
    result = dict(DEFAULTS)  # start with defaults
    for s in settings:
        result[s.key] = s.value
    return result


@router.put("")
def update_settings(
    updates: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("system:admin")),
) -> Dict[str, str]:
    """시스템 설정 업데이트"""
    allowed_keys = set(DEFAULTS.keys())
    for key, value in updates.items():
        if key in allowed_keys:
            _set_setting(db, key, value)

    # Return updated settings
    settings = db.query(SystemSetting).all()
    result = dict(DEFAULTS)
    for s in settings:
        result[s.key] = s.value
    return result


@router.get("/my-ip")
def get_my_ip(
    request: Request,
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, str]:
    """현재 접속 중인 IP 주소 조회"""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        real_ip = request.headers.get("X-Real-IP")
        client_ip = real_ip if real_ip else (request.client.host if request.client else "unknown")

    return {"ip": client_ip}


@router.post("/test-email")
def test_email(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("system:admin")),
) -> Dict[str, str]:
    """테스트 이메일 발송"""
    import smtplib
    from email.mime.text import MIMEText

    smtp_enabled = _get_setting(db, "smtp_enabled")
    if smtp_enabled != "true":
        return {"success": "false", "message": "SMTP가 비활성화되어 있습니다."}

    smtp_host = _get_setting(db, "smtp_host")
    smtp_port = int(_get_setting(db, "smtp_port") or "587")
    smtp_user = _get_setting(db, "smtp_user")
    smtp_password = _get_setting(db, "smtp_password")
    smtp_use_tls = _get_setting(db, "smtp_use_tls") == "true"
    smtp_from_email = _get_setting(db, "smtp_from_email") or smtp_user
    smtp_from_name = _get_setting(db, "smtp_from_name") or "ISMS 관리 시스템"

    if not smtp_host or not smtp_user:
        return {"success": "false", "message": "SMTP 설정이 올바르지 않습니다."}

    try:
        msg = MIMEText("ISMS 관리 시스템 테스트 이메일입니다.\n\n이 이메일이 수신되었다면 SMTP 설정이 올바르게 구성되어 있습니다.", "plain", "utf-8")
        msg["Subject"] = "[ISMS] 테스트 이메일"
        msg["From"] = f"{smtp_from_name} <{smtp_from_email}>"
        msg["To"] = current_user.email

        server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
        if smtp_use_tls:
            server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.sendmail(smtp_from_email, [current_user.email], msg.as_string())
        server.quit()

        return {"success": "true", "message": f"테스트 이메일이 {current_user.email}로 발송되었습니다."}
    except Exception as e:
        return {"success": "false", "message": f"이메일 발송 실패: {str(e)}"}


def get_certification_type(db: Session) -> str:
    """현재 인증 유형 조회 (다른 모듈에서 사용)"""
    return _get_setting(db, "certification_type")
