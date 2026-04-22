import { apiClient, handleApiError } from './api'
import type {
  LLMGenerateRequest,
  LLMGenerateResponse,
  LLMMyDraftsResponse,
  LLMSuggestion,
  LLMSuggestionList,
} from '@/types'

// apiClient는 요청·응답에서 camelCase ↔ snake_case를 자동 변환하므로
// 여기 메서드는 camelCase로만 다루면 된다.
export const llmCorrectiveActionService = {
  // 초안 생성 요청 (202 + task_id)
  async generate(payload: LLMGenerateRequest): Promise<LLMGenerateResponse> {
    try {
      const response = await apiClient.post<LLMGenerateResponse>(
        '/llm/corrective-actions/generate',
        payload,
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // task_id로 상태/결과 조회 (폴링)
  async getByTaskId(taskId: string): Promise<LLMSuggestion> {
    try {
      const response = await apiClient.get<LLMSuggestion>(
        `/llm/corrective-actions/${encodeURIComponent(taskId)}`,
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 부적합의 과거 초안 이력
  async listByNonConformity(ncId: number): Promise<LLMSuggestionList> {
    try {
      const response = await apiClient.get<LLMSuggestionList>(
        `/llm/corrective-actions/by-nonconformity/${ncId}`,
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 내 최근 초안 (전역 배지 전용, 본문 제외 경량 응답)
  async listMine(limit = 10): Promise<LLMMyDraftsResponse> {
    try {
      const response = await apiClient.get<LLMMyDraftsResponse>(
        '/llm/corrective-actions/mine',
        { params: { limit } },
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 초안 하드 삭제 (소유자 또는 관리자만)
  async deleteSuggestion(suggestionId: number): Promise<void> {
    try {
      await apiClient.delete(`/llm/corrective-actions/${suggestionId}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 진행 중(pending/running) 초안 취소 — failed 로 전이시키고 Celery revoke 시도.
  async cancelSuggestion(suggestionId: number): Promise<LLMSuggestion> {
    try {
      const response = await apiClient.post<LLMSuggestion>(
        `/llm/corrective-actions/${suggestionId}/cancel`,
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },
}
