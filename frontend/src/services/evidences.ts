import { apiClient, handleApiError, uploadFile, downloadFile } from './api'
import type {
  Evidence,
  EvidenceCreate,
  EvidenceUpdate,
  EvidenceVersion,
  EvidenceListItem,
  EvidenceFilterParams,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '@/types'

export const evidenceService = {
  // 증적 목록 조회
  async getEvidences(params?: PaginationParams & EvidenceFilterParams): Promise<PaginatedResponse<EvidenceListItem>> {
    try {
      const response = await apiClient.get<PaginatedResponse<EvidenceListItem>>('/evidences', { params })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // 증적 상세 조회
  async getEvidence(id: number): Promise<Evidence> {
    try {
      const response = await apiClient.get<ApiResponse<Evidence>>(`/evidences/${id}`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 증적 생성
  async createEvidence(data: EvidenceCreate, onProgress?: (progress: number) => void): Promise<Evidence> {
    try {
      const { file, ...rest } = data
      const response = await uploadFile('/evidences', file, rest, (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // 증적 수정
  async updateEvidence(id: number, data: EvidenceUpdate): Promise<Evidence> {
    try {
      const response = await apiClient.put<ApiResponse<Evidence>>(`/evidences/${id}`, data)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 증적 삭제
  async deleteEvidence(id: number): Promise<void> {
    try {
      await apiClient.delete(`/evidences/${id}`)
    } catch (error) {
      handleApiError(error)
    }
  },

  // 새 버전 업로드
  async uploadVersion(id: number, file: File, changes: string, onProgress?: (progress: number) => void): Promise<EvidenceVersion> {
    try {
      const response = await uploadFile(`/evidences/${id}/versions`, file, { changes }, (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      })
      return response.data
    } catch (error) {
      handleApiError(error)
    }
  },

  // 버전 히스토리 조회
  async getVersions(id: number): Promise<EvidenceVersion[]> {
    try {
      const response = await apiClient.get<ApiResponse<EvidenceVersion[]>>(`/evidences/${id}/versions`)
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },

  // 파일 다운로드
  async downloadEvidence(id: number, fileName: string): Promise<void> {
    try {
      await downloadFile(`/evidences/${id}/download`, fileName)
    } catch (error) {
      handleApiError(error)
    }
  },

  // 미리보기 URL 조회
  async getPreviewUrl(id: number): Promise<string> {
    try {
      const response = await apiClient.get<ApiResponse<{ url: string }>>(`/evidences/${id}/preview`)
      return response.data.data!.url
    } catch (error) {
      handleApiError(error)
    }
  },

  // 통제항목 매핑
  async mapControls(id: number, controlItemIds: number[]): Promise<void> {
    try {
      await apiClient.post(`/evidences/${id}/controls`, { controlItemIds })
    } catch (error) {
      handleApiError(error)
    }
  },

  // 통제항목 매핑 해제
  async unmapControl(id: number, controlId: number): Promise<void> {
    try {
      await apiClient.delete(`/evidences/${id}/controls/${controlId}`)
    } catch (error) {
      handleApiError(error)
    }
  },

  // 만료 예정 증적 조회
  async getExpiringEvidences(days?: number): Promise<EvidenceListItem[]> {
    try {
      const response = await apiClient.get<ApiResponse<EvidenceListItem[]>>('/evidences/expiring', {
        params: { days },
      })
      return response.data.data!
    } catch (error) {
      handleApiError(error)
    }
  },
}
