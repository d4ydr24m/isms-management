import { apiClient, handleApiError } from './api'
import type {
  SearchParams,
  SearchResponse,
  SearchControlResult,
  SearchEvidenceResult,
  SearchUserResult,
  ApiResponse,
} from '@/types'

export const searchService = {
  // 통합 검색
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      const response = await apiClient.get<ApiResponse<SearchResponse>>('/search', {
        params,
      })
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 통제항목 검색
  async searchControls(query: string): Promise<SearchControlResult[]> {
    try {
      const response = await apiClient.get<ApiResponse<SearchResponse>>('/search', {
        params: { query, category: 'controls' },
      })
      return response.data.data!.controls
    } catch (error) {
      handleApiError(error)
    }
  },

  // 증적 검색
  async searchEvidences(query: string): Promise<SearchEvidenceResult[]> {
    try {
      const response = await apiClient.get<ApiResponse<SearchResponse>>('/search', {
        params: { query, category: 'evidences' },
      })
      return response.data.data!.evidences
    } catch (error) {
      handleApiError(error)
    }
  },

  // 사용자 검색
  async searchUsers(query: string): Promise<SearchUserResult[]> {
    try {
      const response = await apiClient.get<ApiResponse<SearchResponse>>('/search', {
        params: { query, category: 'users' },
      })
      return response.data.data!.users
    } catch (error) {
      handleApiError(error)
    }
  },
}
