import { apiClient, handleApiError } from './api'
import type {
  SearchParams,
  SearchResponse,
  SearchControlResult,
  SearchEvidenceResult,
  SearchUserResult,
} from '@/types'

export const searchService = {
  // 통합 검색 — backend returns SearchResponse directly
  async search(params: SearchParams): Promise<SearchResponse> {
    try {
      const response = await apiClient.get<SearchResponse>('/search', { params })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 통제항목 검색
  async searchControls(query: string): Promise<SearchControlResult[]> {
    try {
      const response = await apiClient.get<SearchResponse>('/search', {
        params: { query, category: 'controls' },
      })
      return response.data.controls
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 증적 검색
  async searchEvidences(query: string): Promise<SearchEvidenceResult[]> {
    try {
      const response = await apiClient.get<SearchResponse>('/search', {
        params: { query, category: 'evidences' },
      })
      return response.data.evidences
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 사용자 검색
  async searchUsers(query: string): Promise<SearchUserResult[]> {
    try {
      const response = await apiClient.get<SearchResponse>('/search', {
        params: { query, category: 'users' },
      })
      return response.data.users
    } catch (error) {
      return handleApiError(error)
    }
  },
}
