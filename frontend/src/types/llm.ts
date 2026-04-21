// LLM 보완조치내역서 초안 관련 타입

export type LLMSuggestionStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export interface LLMGenerateRequest {
  nonConformityId: number
  evidenceIds: number[]
}

export interface LLMGenerateResponse {
  taskId: string
  suggestionId: number
  status: LLMSuggestionStatus
}

export interface LLMSuggestion {
  id: number
  nonConformityId: number
  taskId: string
  status: LLMSuggestionStatus
  modelName: string
  resultText: string | null
  errorMessage: string | null
  evidenceIds: number[]
  createdBy: number | null
  createdAt: string
  completedAt: string | null
}

export interface LLMSuggestionList {
  items: LLMSuggestion[]
  total: number
}

// 전역 '내 초안' 배지 전용 타입들.
export interface LLMMyDraftRow {
  id: number
  nonConformityId: number
  nonConformityTitle: string | null
  taskId: string
  status: LLMSuggestionStatus
  createdAt: string
  completedAt: string | null
  errorMessage: string | null
}

export interface LLMMyDraftsResponse {
  activeCount: number
  items: LLMMyDraftRow[]
}
