import { apiClient, handleApiError } from './api'
import type {
  LoginRequest,
  LoginResponse,
  TokenRefreshResponse,
  MfaSetupResponse,
  MfaVerifyRequest,
  PasswordChangeRequest,
  CurrentUser,
  ApiResponse,
} from '@/types'

export const authService = {
  // 로그인
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials)
      const { accessToken, refreshToken, requiresMfa } = response.data.data!

      if (!requiresMfa) {
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
      }

      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 로그아웃
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout')
    } catch (error) {
      // 로그아웃은 항상 성공으로 처리
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  },

  // 토큰 갱신
  async refreshToken(refreshToken: string): Promise<TokenRefreshResponse> {
    try {
      const response = await apiClient.post<ApiResponse<TokenRefreshResponse>>('/auth/refresh', {
        refreshToken,
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

  // 2FA 설정
  async setupMfa(): Promise<MfaSetupResponse> {
    try {
      const response = await apiClient.post<ApiResponse<MfaSetupResponse>>('/auth/mfa/setup')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 2FA 검증
  async verifyMfa(data: MfaVerifyRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/mfa/verify', data)
      const { accessToken, refreshToken } = response.data.data!

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)

      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },
}
