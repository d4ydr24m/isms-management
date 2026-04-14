import { apiClient, handleApiError } from './api'
import type {
  ControlItem,
  ControlItemDetail,
  ControlDomain,
  ControlProgress,
  ControlEvidenceLink,
  ControlEvidenceLinkCreate,
  ControlEvidenceLinkUpdate,
  EvidenceLinkSource,
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
      return handleApiError(error)
    }
  },

  // 통제항목 상세 조회 — backend returns ControlItemResponse directly
  async getControl(id: number): Promise<ControlItemDetail> {
    try {
      const response = await apiClient.get<ControlItemDetail>(`/controls/${id}`)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 통제항목별 증적 목록 조회 — backend returns EvidenceList directly
  async getControlEvidences(id: number): Promise<any[]> {
    try {
      const response = await apiClient.get<{ items: any[]; total: number }>(`/controls/${id}/evidences`)
      return response.data.items
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 통제영역 목록 조회 — backend returns List[ControlDomainResponse] directly
  async getDomains(): Promise<ControlDomain[]> {
    try {
      const response = await apiClient.get<ControlDomain[]>('/controls/domains')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 증적 확보율 조회 — backend returns ControlProgressResponse directly
  async getProgress(): Promise<ControlProgress> {
    try {
      const response = await apiClient.get<ControlProgress>('/controls/progress')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 증적출처 연결 목록 조회
  async getEvidenceLinks(controlId: number): Promise<{ items: ControlEvidenceLink[]; total: number }> {
    try {
      const response = await apiClient.get<{ items: ControlEvidenceLink[]; total: number }>(
        `/controls/${controlId}/evidence-links`
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 증적출처 연결 추가
  async createEvidenceLink(controlId: number, data: ControlEvidenceLinkCreate): Promise<ControlEvidenceLink> {
    try {
      const response = await apiClient.post<ControlEvidenceLink>(
        `/controls/${controlId}/evidence-links`,
        data
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 증적출처 연결 수정
  async updateEvidenceLink(
    controlId: number,
    linkId: number,
    data: ControlEvidenceLinkUpdate
  ): Promise<ControlEvidenceLink> {
    try {
      const response = await apiClient.put<ControlEvidenceLink>(
        `/controls/${controlId}/evidence-links/${linkId}`,
        data
      )
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 증적출처 연결 삭제
  async deleteEvidenceLink(controlId: number, linkId: number): Promise<void> {
    try {
      await apiClient.delete(`/controls/${controlId}/evidence-links/${linkId}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 연결 가능한 증적출처 모듈 목록
  async getAvailableSources(): Promise<EvidenceLinkSource[]> {
    try {
      const response = await apiClient.get<EvidenceLinkSource[]>('/controls/evidence-link-sources')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },
}
