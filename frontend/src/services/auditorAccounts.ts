import { apiClient, handleApiError } from './api'
import type {
  AuditorAccount,
  AuditorAccountCreate,
  AuditorAccountUpdate,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '@/types'

export const auditorAccountService = {
  // 심사원 계정 목록 조회
  async getAuditorAccounts(params?: PaginationParams & { search?: string }): Promise<PaginatedResponse<AuditorAccount>> {
    try {
      const response = await apiClient.get<PaginatedResponse<AuditorAccount>>('/auditor-accounts', { params })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // 심사원 계정 상세 조회
  async getAuditorAccount(id: number): Promise<AuditorAccount> {
    try {
      const response = await apiClient.get<ApiResponse<AuditorAccount>>(`/auditor-accounts/${id}`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 심사원 계정 생성
  async createAuditorAccount(data: AuditorAccountCreate): Promise<AuditorAccount> {
    try {
      const response = await apiClient.post<ApiResponse<AuditorAccount>>('/auditor-accounts', data)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 심사원 계정 수정
  async updateAuditorAccount(id: number, data: AuditorAccountUpdate): Promise<AuditorAccount> {
    try {
      const response = await apiClient.put<ApiResponse<AuditorAccount>>(`/auditor-accounts/${id}`, data)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 심사원 계정 삭제 (만료)
  async deleteAuditorAccount(id: number): Promise<void> {
    try {
      await apiClient.delete(`/auditor-accounts/${id}`)
    } catch (error) {
      handleApiError(error)
    }
  },
}
