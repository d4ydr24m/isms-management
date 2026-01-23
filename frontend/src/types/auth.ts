// 인증 관련 타입
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
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
  qrCode: string
  backupCodes: string[]
}

export interface MfaVerifyRequest {
  token: string
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
