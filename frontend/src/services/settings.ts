import { apiClient, handleApiError } from './api'
import type {
  ProfileUpdateRequest,
  SecuritySettings,
  SystemSettings,
  SystemSettingsUpdateRequest,
  ApiResponse,
} from '@/types'

export const settingsService = {
  // 프로필 업데이트
  async updateProfile(data: ProfileUpdateRequest): Promise<void> {
    try {
      await apiClient.put('/users/profile', data)
    } catch (error) {
      handleApiError(error)
    }
  },

  // 보안 설정 조회
  async getSecuritySettings(): Promise<SecuritySettings> {
    try {
      const response = await apiClient.get<ApiResponse<SecuritySettings>>('/users/security')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 시스템 설정 조회
  async getSystemSettings(): Promise<SystemSettings> {
    try {
      const response = await apiClient.get<ApiResponse<SystemSettings>>('/users/settings')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 시스템 설정 업데이트
  async updateSystemSettings(data: SystemSettingsUpdateRequest): Promise<void> {
    try {
      await apiClient.put('/users/settings', data)
    } catch (error) {
      handleApiError(error)
    }
  },
}
