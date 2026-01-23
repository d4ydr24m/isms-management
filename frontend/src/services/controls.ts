import { apiClient, handleApiError } from './api'
import type {
  ControlItem,
  ControlItemDetail,
  ControlDomain,
  ControlProgress,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '@/types'

export const controlService = {
  // 통제항목 목록 조회
  async getControls(
    params?: PaginationParams & { domainId?: number; categoryId?: number; search?: string; isRequired?: boolean }
  ): Promise<PaginatedResponse<ControlItem>> {
    try {
      const response = await apiClient.get<PaginatedResponse<ControlItem>>('/controls', { params })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // 통제항목 상세 조회
  async getControl(id: number): Promise<ControlItemDetail> {
    try {
      const response = await apiClient.get<ApiResponse<ControlItemDetail>>(`/controls/${id}`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 통제항목별 증적 목록 조회
  async getControlEvidences(id: number): Promise<any[]> {
    try {
      const response = await apiClient.get<ApiResponse<any[]>>(`/controls/${id}/evidences`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 통제영역 목록 조회
  async getDomains(): Promise<ControlDomain[]> {
    try {
      const response = await apiClient.get<ApiResponse<ControlDomain[]>>('/controls/domains')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 증적 확보율 조회
  async getProgress(): Promise<ControlProgress> {
    try {
      const response = await apiClient.get<ApiResponse<ControlProgress>>('/controls/progress')
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },
}
