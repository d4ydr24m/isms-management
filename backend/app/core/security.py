"""
보안 유틸리티 함수
JWT 토큰, 비밀번호 해싱, TOTP 등
"""
import re
import secrets
import string
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from jose import JWTError, jwt
import bcrypt
import pyotp

from app.core.config import settings


def get_password_hash(password: str) -> str:
    """
    비밀번호 해싱
    bcrypt를 직접 사용하여 해싱
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    비밀번호 검증
    """
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT Access Token 생성
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    JWT Refresh Token 생성
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    JWT 토큰 디코딩
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_totp_secret() -> str:
    """
    TOTP 시크릿 생성
    """
    return pyotp.random_base32()


def verify_totp(secret: str, token: str) -> bool:
    """
    TOTP 토큰 검증

    valid_window은 settings.TOTP_VALID_WINDOW으로 제어.
    0 = 현재 30초 윈도우만 허용 (가장 엄격)
    1 = ±30초 허용 (기본값, 시간 동기화 오차 대비)
    """
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=settings.TOTP_VALID_WINDOW)


def get_totp_uri(secret: str, email: str) -> str:
    """
    TOTP QR 코드 URI 생성
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="ISMS Management System")


def generate_backup_codes(count: int = 10) -> List[str]:
    """
    MFA 백업 코드 생성

    8자리 대문자 영숫자 코드를 생성하고 "XXXX-XXXX" 형식으로 반환

    Args:
        count: 생성할 코드 수 (기본 10)

    Returns:
        List of formatted backup codes
    """
    alphabet = string.ascii_uppercase + string.digits
    codes = []
    for _ in range(count):
        raw = ''.join(secrets.choice(alphabet) for _ in range(8))
        formatted = f"{raw[:4]}-{raw[4:]}"
        codes.append(formatted)
    return codes


def hash_backup_code(code: str) -> str:
    """
    백업 코드를 bcrypt로 해싱

    Args:
        code: 원본 백업 코드 (대시 포함 가능)

    Returns:
        해싱된 백업 코드
    """
    normalized = code.replace("-", "").upper()
    return get_password_hash(normalized)


def verify_backup_code(code: str, hashed: str) -> bool:
    """
    백업 코드를 해시와 비교 검증

    Args:
        code: 사용자 입력 백업 코드
        hashed: 저장된 해시

    Returns:
        일치 여부
    """
    normalized = code.replace("-", "").upper()
    return verify_password(normalized, hashed)


def validate_password_policy(password: str) -> Dict[str, Any]:
    """
    비밀번호 정책 검증

    정책:
    - 최소 8자 이상
    - 대문자 포함
    - 소문자 포함
    - 숫자 포함
    - 특수문자 포함

    Returns:
        Dict with 'valid' (bool) and 'errors' (List[str])
    """
    errors: List[str] = []

    # 최소 길이 체크
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        errors.append(f"비밀번호는 최소 8자 이상이어야 합니다.")

    # 대문자 체크
    if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        errors.append("비밀번호에 대문자가 포함되어야 합니다.")

    # 소문자 체크
    if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        errors.append("비밀번호에 소문자가 포함되어야 합니다.")

    # 숫자 체크
    if settings.PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        errors.append("비밀번호에 숫자가 포함되어야 합니다.")

    # 특수문자 체크
    if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        errors.append("비밀번호에 특수문자가 포함되어야 합니다.")

    return {
        "valid": len(errors) == 0,
        "errors": errors
    }
