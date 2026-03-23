"""
인증 관련 Pydantic 스키마
"""
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.core.security import validate_password_policy


class LoginRequest(BaseModel):
    """로그인 요청 스키마"""
    email: EmailStr
    password: str = Field(..., min_length=1)
    otp_code: Optional[str] = Field(None, min_length=6, max_length=9, description="OTP 코드 (6자리) 또는 백업 코드 (XXXX-XXXX 형식, 9자리)")


class TokenResponse(BaseModel):
    """토큰 응답 스키마"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseModel):
    """토큰 갱신 요청 스키마"""
    refresh_token: str


class PasswordChange(BaseModel):
    """비밀번호 변경 요청 스키마"""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_passwords(self) -> "PasswordChange":
        if self.new_password != self.confirm_password:
            raise ValueError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.")

        result = validate_password_policy(self.new_password)
        if not result["valid"]:
            raise ValueError("; ".join(result["errors"]))

        return self


class OTPSetup(BaseModel):
    """OTP 설정 응답 스키마"""
    secret: str
    uri: str
    qr_code_base64: str


class OTPVerify(BaseModel):
    """OTP 검증 요청 스키마"""
    otp_code: str = Field(..., min_length=6, max_length=6)

    @model_validator(mode="after")
    def validate_otp_format(self) -> "OTPVerify":
        if not self.otp_code.isdigit():
            raise ValueError("OTP 코드는 숫자만 포함해야 합니다.")
        return self


class MFADisableRequest(BaseModel):
    """MFA 비활성화 요청 스키마"""
    password: str = Field(..., min_length=1)
    otp_code: str = Field(..., min_length=6, max_length=6)


class MFAEnableResponse(BaseModel):
    """MFA 활성화 응답 스키마 (백업 코드 포함)"""
    message: str
    backup_codes: List[str]


class MFABackupCodesResponse(BaseModel):
    """MFA 백업 코드 응답 스키마"""
    backup_codes: List[str]


class MFARegenerateBackupCodesRequest(BaseModel):
    """MFA 백업 코드 재생성 요청 스키마"""
    password: str = Field(..., min_length=1)
    otp_code: str = Field(..., min_length=6, max_length=6)
