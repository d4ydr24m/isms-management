import { apiClient, handleApiError } from './api'
import type {
  LoginRequest,
  LoginResponse,
  TokenRefreshResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
  MfaEnableResponse,
  PasswordChangeRequest,
  CurrentUser,
  ApiResponse,
} from '@/types'

// Authentication is handled via HttpOnly cookies set by the backend.
// Tokens are never exposed to JavaScript — all cookie management is server-side.
export const authService = {
  // 로그인
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 로그아웃
  async logout(): Promise<void> {
    try {
      // Backend clears HttpOnly cookies in the response
      await apiClient.post('/auth/logout')
    } catch {
      // 로그아웃은 항상 성공으로 처리
    }
  },

  // 토큰 갱신
  async refreshToken(refreshToken: string): Promise<TokenRefreshResponse> {
    try {
      const response = await apiClient.post<ApiResponse<TokenRefreshResponse>>('/auth/refresh', {
        refresh_token: refreshToken,
      })
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 현재 사용자 정보 조회
  async getCurrentUser(): Promise<CurrentUser> {
    try {
      const response = await apiClient.get<ApiResponse<CurrentUser>>('/auth/me')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 비밀번호 변경
  async changePassword(data: PasswordChangeRequest): Promise<void> {
    try {
      await apiClient.post('/auth/password/change', data)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 2FA 설정 — backend returns OTPSetup directly (no ApiResponse wrapper)
  async setupMfa(): Promise<MfaSetupResponse> {
    try {
      const response = await apiClient.post<MfaSetupResponse>('/auth/mfa/setup')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 2FA 검증 — backend returns MFAEnableResponse directly
  async verifyMfa(data: MfaVerifyRequest): Promise<MfaEnableResponse> {
    try {
      const response = await apiClient.post<MfaEnableResponse>('/auth/mfa/verify', data)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 백업 코드 재생성 — backend returns MFABackupCodesResponse directly
  async regenerateBackupCodes(
    password: string,
    otpCode: string,
  ): Promise<{ backupCodes: string[] }> {
    try {
      const response = await apiClient.post<{ backupCodes: string[] }>(
        '/auth/mfa/backup-codes/regenerate',
        { password, otpCode },
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },
}
