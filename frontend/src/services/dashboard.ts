import { apiClient, handleApiError } from './api'
import type {
  DashboardSummary,
  EvidenceProgress,
  UpcomingActivity,
  ExpiringEvidence,
  PendingTask,
  NonConformitySummary,
  ApiResponse,
} from '@/types'

export const dashboardService = {
  // 전체 요약 조회
  async getSummary(): Promise<DashboardSummary> {
    try {
      const response = await apiClient.get<ApiResponse<DashboardSummary>>('/dashboard/summary')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 진척률 조회
  async getProgress(): Promise<EvidenceProgress> {
    try {
      const response = await apiClient.get<ApiResponse<EvidenceProgress>>('/dashboard/progress')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 예정 활동 조회
  async getActivities(period?: 'today' | 'week' | 'month'): Promise<UpcomingActivity[]> {
    try {
      const response = await apiClient.get<ApiResponse<UpcomingActivity[]>>('/dashboard/activities', {
        params: { period },
      })
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 만료 예정 증적 조회
  async getExpiringEvidences(days?: number): Promise<ExpiringEvidence[]> {
    try {
      const response = await apiClient.get<ApiResponse<ExpiringEvidence[]>>('/dashboard/expiring-evidences', {
        params: { days },
      })
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 미완료 업무 조회
  async getPendingTasks(): Promise<PendingTask[]> {
    try {
      const response = await apiClient.get<ApiResponse<PendingTask[]>>('/dashboard/pending-tasks')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 부적합 현황 조회
  async getNonConformitySummary(): Promise<NonConformitySummary> {
    try {
      const response = await apiClient.get<ApiResponse<NonConformitySummary>>('/dashboard/nonconformities')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },
}
