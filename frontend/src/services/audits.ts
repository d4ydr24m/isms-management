import { apiClient, handleApiError } from './api'
import type {
  AuditPlan,
  AuditPlanCreate,
  AuditPlanUpdate,
  AuditChecklist,
  ChecklistResultCreate,
  NonConformity,
  NonConformityCreate,
  NonConformityUpdate,
  CorrectiveAction,
  CorrectiveActionCreate,
  CorrectiveActionUpdate,
  CorrectiveActionVerify,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '@/types'

export const auditService = {
  // 감사 계획 목록 조회
  async getAudits(params?: PaginationParams & { status?: string; search?: string }): Promise<PaginatedResponse<AuditPlan>> {
    try {
      const response = await apiClient.get<PaginatedResponse<AuditPlan>>('/audits', { params })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // 감사 계획 상세 조회
  async getAudit(id: number): Promise<AuditPlan> {
    try {
      const response = await apiClient.get<ApiResponse<AuditPlan>>(`/audits/${id}`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 감사 계획 생성
  async createAudit(data: AuditPlanCreate): Promise<AuditPlan> {
    try {
      const response = await apiClient.post<ApiResponse<AuditPlan>>('/audits', data)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 감사 계획 수정
  async updateAudit(id: number, data: AuditPlanUpdate): Promise<AuditPlan> {
    try {
      const response = await apiClient.put<ApiResponse<AuditPlan>>(`/audits/${id}`, data)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 감사 계획 삭제
  async deleteAudit(id: number): Promise<void> {
    try {
      await apiClient.delete(`/audits/${id}`)
    } catch (error) {
      handleApiError(error)
    }
  },

  // 감사팀 구성
  async assignTeam(id: number, auditorIds: number[]): Promise<void> {
    try {
      await apiClient.put(`/audits/${id}/team`, { auditorIds })
    } catch (error) {
      handleApiError(error)
    }
  },

  // 체크리스트 조회
  async getChecklist(auditId: number): Promise<AuditChecklist[]> {
    try {
      const response = await apiClient.get<ApiResponse<AuditChecklist[]>>(`/audits/${auditId}/checklist`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 체크리스트 자동 생성
  async generateChecklist(auditId: number): Promise<void> {
    try {
      await apiClient.post(`/audits/${auditId}/checklist/generate`)
    } catch (error) {
      handleApiError(error)
    }
  },

  // 점검 결과 입력
  async updateChecklistItem(auditId: number, itemId: number, data: ChecklistResultCreate): Promise<void> {
    try {
      await apiClient.put(`/audits/${auditId}/checklist/${itemId}`, data)
    } catch (error) {
      handleApiError(error)
    }
  },

  // 체크리스트 항목에 증적 연결
  async attachEvidence(auditId: number, itemId: number, evidenceIds: number[]): Promise<void> {
    try {
      await apiClient.post(`/audits/${auditId}/checklist/${itemId}/evidence`, { evidenceIds })
    } catch (error) {
      handleApiError(error)
    }
  },

  // 부적합 목록 조회
  async getNonConformities(params?: PaginationParams & { auditId?: number; status?: string }): Promise<PaginatedResponse<NonConformity>> {
    try {
      const response = await apiClient.get<PaginatedResponse<NonConformity>>('/nonconformities', { params })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // 부적합 상세 조회
  async getNonConformity(id: number): Promise<NonConformity> {
    try {
      const response = await apiClient.get<ApiResponse<NonConformity>>(`/nonconformities/${id}`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 부적합 등록
  async createNonConformity(data: NonConformityCreate): Promise<NonConformity> {
    try {
      const response = await apiClient.post<ApiResponse<NonConformity>>('/nonconformities', data)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 부적합 수정
  async updateNonConformity(id: number, data: NonConformityUpdate): Promise<NonConformity> {
    try {
      const response = await apiClient.put<ApiResponse<NonConformity>>(`/nonconformities/${id}`, data)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 시정조치 요청
  async createCorrectiveAction(nonConformityId: number, data: CorrectiveActionCreate): Promise<CorrectiveAction> {
    try {
      const response = await apiClient.post<ApiResponse<CorrectiveAction>>(
        `/nonconformities/${nonConformityId}/corrective-actions`,
        data
      )
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 시정조치 수정
  async updateCorrectiveAction(
    nonConformityId: number,
    actionId: number,
    data: CorrectiveActionUpdate
  ): Promise<CorrectiveAction> {
    try {
      const response = await apiClient.put<ApiResponse<CorrectiveAction>>(
        `/nonconformities/${nonConformityId}/corrective-actions/${actionId}`,
        data
      )
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 시정조치 검증
  async verifyCorrectiveAction(nonConformityId: number, actionId: number, data: CorrectiveActionVerify): Promise<void> {
    try {
      await apiClient.post(`/nonconformities/${nonConformityId}/corrective-actions/${actionId}/verify`, data)
    } catch (error) {
      handleApiError(error)
    }
  },
}
