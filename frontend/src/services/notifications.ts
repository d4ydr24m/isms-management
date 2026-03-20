import { apiClient, handleApiError } from './api'
import type {
  Notification,
  NotificationSetting,
  NotificationSettingUpdate,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '@/types'

export const notificationService = {
  // 알림 목록 조회
  async getNotifications(params?: PaginationParams & { isRead?: boolean }): Promise<PaginatedResponse<Notification>> {
    try {
      const response = await apiClient.get<PaginatedResponse<Notification>>('/notifications', { params })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 알림 읽음 처리
  async markAsRead(id: number): Promise<void> {
    try {
      await apiClient.put(`/notifications/${id}/read`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 전체 읽음 처리
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.put('/notifications/read-all')
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 알림 설정 조회
  async getSettings(): Promise<NotificationSetting[]> {
    try {
      const response = await apiClient.get<ApiResponse<NotificationSetting[]>>('/notifications/settings')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 알림 설정 변경 (단일)
  async updateSetting(setting: NotificationSettingUpdate): Promise<void> {
    try {
      await apiClient.put(`/notifications/settings/${setting.type}`, setting)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 알림 설정 변경 (다수)
  async updateSettings(settings: NotificationSettingUpdate[]): Promise<void> {
    try {
      await apiClient.put('/notifications/settings', { settings })
    } catch (error) {
      return handleApiError(error)
    }
  },
}
