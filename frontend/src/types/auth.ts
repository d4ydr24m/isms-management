// 인증 관련 타입
export interface LoginRequest {
  email: string
  password: string
  otpCode?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: {
    id: number
    email: string
    name: string
    roles: string[]
  }
  requiresMfa: boolean
}

export interface MfaSetupResponse {
  secret: string
  uri: string
  qrCodeBase64: string
}

export interface MfaVerifyRequest {
  otpCode: string
  secret: string
}

export interface MfaEnableResponse {
  message: string
  backupCodes: string[]
}

export interface TokenRefreshRequest {
  refreshToken: string
}

export interface TokenRefreshResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
}

export interface PasswordChangeRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// 현재 사용자 정보
export interface CurrentUser {
  id: number
  email: string
  name: string
  departmentId: number | null
  department: string | null
  roles: string[]
  permissions: string[]
  isActive: boolean
  isMfaEnabled: boolean
}
