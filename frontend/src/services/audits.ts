import { apiClient, handleApiError, uploadFile } from './api'
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
  NcEvidenceAttachRequest,
  NcEvidenceItem,
  NcEvidenceList,
  NcEvidenceListPage,
  NcEvidenceListParams,
  NcEvidenceRole,
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
      return handleApiError(error)
    }
  },

  // 감사 계획 상세 조회
  async getAudit(id: number): Promise<AuditPlan> {
    try {
      const response = await apiClient.get<AuditPlan>(`/audits/${id}`)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 감사 계획 생성
  async createAudit(data: AuditPlanCreate): Promise<AuditPlan> {
    try {
      const response = await apiClient.post<AuditPlan>('/audits', data)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 감사 계획 수정
  async updateAudit(id: number, data: AuditPlanUpdate): Promise<AuditPlan> {
    try {
      const response = await apiClient.put<AuditPlan>(`/audits/${id}`, data)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 감사 계획 삭제
  async deleteAudit(id: number): Promise<void> {
    try {
      await apiClient.delete(`/audits/${id}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 감사팀 구성
  async assignTeam(id: number, auditorIds: number[]): Promise<void> {
    try {
      await apiClient.put(`/audits/${id}/team`, { auditorIds })
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 체크리스트 조회
  async getChecklist(auditId: number): Promise<AuditChecklist[]> {
    try {
      const response = await apiClient.get<{ items: AuditChecklist[]; total: number }>(`/audits/${auditId}/checklist`)
      return response.data.items || []
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 체크리스트 자동 생성
  async generateChecklist(auditId: number): Promise<void> {
    try {
      await apiClient.post(`/audits/${auditId}/checklist/generate`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 점검 결과 입력
  async updateChecklistItem(auditId: number, itemId: number, data: ChecklistResultCreate): Promise<void> {
    try {
      await apiClient.put(`/audits/${auditId}/checklist/${itemId}`, data)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 체크리스트 항목에 증적 연결
  async attachEvidence(auditId: number, itemId: number, evidenceIds: number[]): Promise<void> {
    try {
      await apiClient.post(`/audits/${auditId}/checklist/${itemId}/evidence`, { evidenceIds })
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 부적합 목록 조회
  async getNonConformities(params?: PaginationParams & { auditPlanId?: number; status?: string[]; ncType?: string; dueDateFilter?: string; search?: string; responsiblePersonId?: number }): Promise<PaginatedResponse<NonConformity>> {
    try {
      const response = await apiClient.get<PaginatedResponse<NonConformity>>('/nonconformities', { params })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 부적합 상세 조회
  async getNonConformity(id: number): Promise<NonConformity> {
    try {
      const response = await apiClient.get<NonConformity>(`/nonconformities/${id}`)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 부적합 등록
  async createNonConformity(data: NonConformityCreate): Promise<NonConformity> {
    try {
      const response = await apiClient.post<NonConformity>('/nonconformities', data)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 부적합 수정
  async updateNonConformity(id: number, data: NonConformityUpdate): Promise<NonConformity> {
    try {
      const response = await apiClient.put<NonConformity>(`/nonconformities/${id}`, data)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 시정조치 목록 조회
  async getCorrectiveActions(nonConformityId: number): Promise<CorrectiveAction[]> {
    try {
      const response = await apiClient.get<{ items: CorrectiveAction[]; total: number }>(
        `/nonconformities/${nonConformityId}/corrective-actions`
      )
      return response.data.items || []
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 시정조치 요청
  async createCorrectiveAction(nonConformityId: number, data: CorrectiveActionCreate): Promise<CorrectiveAction> {
    try {
      const response = await apiClient.post<CorrectiveAction>(
        `/nonconformities/${nonConformityId}/corrective-actions`,
        data
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 시정조치 수정
  async updateCorrectiveAction(
    nonConformityId: number,
    actionId: number,
    data: CorrectiveActionUpdate
  ): Promise<CorrectiveAction> {
    try {
      const response = await apiClient.put<CorrectiveAction>(
        `/nonconformities/${nonConformityId}/corrective-actions/${actionId}`,
        data
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 시정조치 검증
  async verifyCorrectiveAction(nonConformityId: number, actionId: number, data: CorrectiveActionVerify): Promise<void> {
    try {
      await apiClient.post(`/nonconformities/${nonConformityId}/corrective-actions/${actionId}/verify`, data)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 시정조치 삭제
  async deleteCorrectiveAction(nonConformityId: number, actionId: number): Promise<void> {
    try {
      await apiClient.delete(`/nonconformities/${nonConformityId}/corrective-actions/${actionId}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ========== 부적합 증적 매핑 ==========

  // 부적합에 연결된 증적 목록 조회
  async listNcEvidences(ncId: number): Promise<NcEvidenceList> {
    try {
      const response = await apiClient.get<NcEvidenceList>(`/nonconformities/${ncId}/evidences`)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 기존 증적 ID들을 부적합에 연결 (중복은 무시됨)
  async attachExistingEvidences(
    ncId: number,
    payload: NcEvidenceAttachRequest,
  ): Promise<NcEvidenceList> {
    try {
      const response = await apiClient.post<NcEvidenceList>(
        `/nonconformities/${ncId}/evidences/attach`,
        payload,
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 새 파일 업로드 + 즉시 NC에 연결
  async uploadAndAttachEvidence(
    ncId: number,
    file: File,
    meta: { title: string; mappingNote?: string | null; role?: NcEvidenceRole },
  ): Promise<NcEvidenceItem> {
    try {
      return await uploadFile(
        `/nonconformities/${ncId}/evidences/upload`,
        file,
        meta,
      )
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 매핑 role 만 수정
  async updateNcEvidenceRole(
    ncId: number,
    evidenceId: number,
    role: NcEvidenceRole,
  ): Promise<NcEvidenceItem> {
    try {
      const response = await apiClient.patch<NcEvidenceItem>(
        `/nonconformities/${ncId}/evidences/${evidenceId}/role`,
        { role },
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 매핑 메모만 수정
  async updateNcEvidenceNote(
    ncId: number,
    evidenceId: number,
    mappingNote: string | null,
  ): Promise<NcEvidenceItem> {
    try {
      const response = await apiClient.patch<NcEvidenceItem>(
        `/nonconformities/${ncId}/evidences/${evidenceId}/note`,
        { mappingNote },
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 증적 연결 해제 (증적 자체는 유지)
  async detachEvidence(ncId: number, evidenceId: number): Promise<void> {
    try {
      await apiClient.delete(`/nonconformities/${ncId}/evidences/${evidenceId}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 결함 증적 관리 페이지: 전체 NC 의 결함 증적 매핑 페이지네이션 조회
  async listAllNcEvidences(
    params?: NcEvidenceListParams,
  ): Promise<NcEvidenceListPage> {
    try {
      const response = await apiClient.get<NcEvidenceListPage>('/nc-evidences', {
        params,
      })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },
}
