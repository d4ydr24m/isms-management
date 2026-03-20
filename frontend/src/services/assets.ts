/**
 * 정보자산 관리 API 서비스
 * Phase 2: FR-501 ~ FR-505
 */
import { apiClient, handleApiError, downloadFile, uploadFile } from './api'
import type {
  AssetType,
  AssetTypeCreate,
  AssetTypeList,
  AssetCategory,
  AssetCategoryCreate,
  AssetCategoryUpdate,
  AssetCategoryList,
  Asset,
  AssetCreate,
  AssetUpdate,
  AssetList,
  AssetValuation,
  AssetValuationCreate,
  AssetValuationHistory,
  AssetHistory,
  AssetDisposalCreate,
  AssetDisposal,
  AssetLifecycleStats,
  AssetAssignment,
  AssetAssignmentCreate,
  AssetAssignmentUpdate,
  AssetHandover,
  AssetImportResult,
  AssetStats,
  AssetByTypeStats,
  AssetByDepartmentStats,
  AssetByImportanceStats,
  AssetFilterParams,
  ApiResponse,
  PaginationParams,
} from '@/types'

export const assetService = {
  // ==========================================================================
  // 자산 유형 API (FR-501)
  // ==========================================================================

  /**
   * 자산 유형 목록 조회
   */
  async getAssetTypes(): Promise<AssetTypeList> {
    try {
      const response = await apiClient.get<AssetTypeList>('/assets/types')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 커스텀 자산 유형 생성
   */
  async createAssetType(data: AssetTypeCreate): Promise<AssetType> {
    try {
      const response = await apiClient.post<ApiResponse<AssetType>>('/assets/types', data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ==========================================================================
  // 자산 분류 API (FR-501)
  // ==========================================================================

  /**
   * 자산 분류 트리 조회
   */
  async getAssetCategories(): Promise<AssetCategoryList> {
    try {
      const response = await apiClient.get<AssetCategoryList>('/assets/categories')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 분류 생성
   */
  async createAssetCategory(data: AssetCategoryCreate): Promise<AssetCategory> {
    try {
      const response = await apiClient.post<ApiResponse<AssetCategory>>('/assets/categories', data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 분류 수정
   */
  async updateAssetCategory(id: number, data: AssetCategoryUpdate): Promise<AssetCategory> {
    try {
      const response = await apiClient.put<ApiResponse<AssetCategory>>(`/assets/categories/${id}`, data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ==========================================================================
  // 자산 CRUD API (FR-502)
  // ==========================================================================

  /**
   * 자산 목록 조회 (페이지네이션, 필터)
   */
  async getAssets(params?: PaginationParams & AssetFilterParams): Promise<AssetList> {
    try {
      const response = await apiClient.get<AssetList>('/assets', { params })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 상세 조회
   */
  async getAsset(id: number): Promise<Asset> {
    try {
      const response = await apiClient.get<ApiResponse<Asset>>(`/assets/${id}`)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 생성
   */
  async createAsset(data: AssetCreate): Promise<Asset> {
    try {
      const response = await apiClient.post<ApiResponse<Asset>>('/assets', data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 수정
   */
  async updateAsset(id: number, data: AssetUpdate): Promise<Asset> {
    try {
      const response = await apiClient.put<ApiResponse<Asset>>(`/assets/${id}`, data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 삭제 (비활성화)
   */
  async deleteAsset(id: number): Promise<void> {
    try {
      await apiClient.delete(`/assets/${id}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ==========================================================================
  // 자산 가치 평가 API (FR-503)
  // ==========================================================================

  /**
   * 현재 자산 가치 평가 조회
   */
  async getAssetValuation(assetId: number): Promise<AssetValuation> {
    try {
      const response = await apiClient.get<ApiResponse<AssetValuation>>(`/assets/${assetId}/valuation`)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 가치 평가 등록/수정
   */
  async createAssetValuation(assetId: number, data: AssetValuationCreate): Promise<AssetValuation> {
    try {
      const response = await apiClient.post<ApiResponse<AssetValuation>>(`/assets/${assetId}/valuation`, data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 가치 평가 이력 조회
   */
  async getAssetValuationHistory(assetId: number): Promise<AssetValuationHistory> {
    try {
      const response = await apiClient.get<ApiResponse<AssetValuationHistory>>(`/assets/${assetId}/valuation/history`)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ==========================================================================
  // 자산 이력 API (FR-504)
  // ==========================================================================

  /**
   * 자산 변경 이력 조회
   */
  async getAssetHistory(assetId: number): Promise<AssetHistory[]> {
    try {
      const response = await apiClient.get<ApiResponse<AssetHistory[]>>(`/assets/${assetId}/history`)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 폐기 처리
   */
  async disposeAsset(assetId: number, data: AssetDisposalCreate): Promise<AssetDisposal> {
    try {
      const response = await apiClient.post<ApiResponse<AssetDisposal>>(`/assets/${assetId}/dispose`, data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 생명주기 통계 조회
   */
  async getLifecycleStats(): Promise<AssetLifecycleStats> {
    try {
      const response = await apiClient.get<ApiResponse<AssetLifecycleStats>>('/assets/lifecycle-stats')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ==========================================================================
  // 자산 담당자 API (FR-505)
  // ==========================================================================

  /**
   * 자산 담당자 목록 조회
   */
  async getAssetAssignments(assetId: number): Promise<AssetAssignment[]> {
    try {
      const response = await apiClient.get<ApiResponse<AssetAssignment[]>>(`/assets/${assetId}/assignments`)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 담당자 할당
   */
  async createAssetAssignment(assetId: number, data: AssetAssignmentCreate): Promise<AssetAssignment> {
    try {
      const response = await apiClient.post<ApiResponse<AssetAssignment>>(`/assets/${assetId}/assignments`, data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 담당자 수정
   */
  async updateAssetAssignment(assetId: number, assignmentId: number, data: AssetAssignmentUpdate): Promise<AssetAssignment> {
    try {
      const response = await apiClient.put<ApiResponse<AssetAssignment>>(`/assets/${assetId}/assignments/${assignmentId}`, data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 담당자 해제
   */
  async deleteAssetAssignment(assetId: number, assignmentId: number): Promise<void> {
    try {
      await apiClient.delete(`/assets/${assetId}/assignments/${assignmentId}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 인수인계 체크리스트 조회
   */
  async getAssetHandover(assetId: number): Promise<AssetHandover> {
    try {
      const response = await apiClient.get<ApiResponse<AssetHandover>>(`/assets/${assetId}/handover`)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ==========================================================================
  // 자산 임포트/익스포트 API (FR-502)
  // ==========================================================================

  /**
   * 임포트 템플릿 다운로드
   */
  async downloadTemplate(): Promise<void> {
    try {
      await downloadFile('/assets/template', 'asset_import_template.xlsx')
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 엑셀 임포트
   */
  async importAssets(file: File, onProgress?: (progress: number) => void): Promise<AssetImportResult> {
    try {
      const response = await uploadFile('/assets/import', file, undefined, (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 자산 엑셀 익스포트
   */
  async exportAssets(filters?: AssetFilterParams): Promise<void> {
    try {
      const queryParams = filters
        ? '?' + Object.entries(filters)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `${key}=${value}`)
            .join('&')
        : ''
      await downloadFile(`/assets/export${queryParams}`, 'assets_export.xlsx')
    } catch (error) {
      return handleApiError(error)
    }
  },

  // ==========================================================================
  // 자산 통계 API
  // ==========================================================================

  /**
   * 자산 전체 통계 조회
   */
  async getAssetStats(): Promise<AssetStats> {
    try {
      const response = await apiClient.get<ApiResponse<AssetStats>>('/assets/stats')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 유형별 자산 통계 조회
   */
  async getAssetsByType(): Promise<AssetByTypeStats[]> {
    try {
      const response = await apiClient.get<ApiResponse<AssetByTypeStats[]>>('/assets/by-type')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 부서별 자산 통계 조회
   */
  async getAssetsByDepartment(): Promise<AssetByDepartmentStats[]> {
    try {
      const response = await apiClient.get<ApiResponse<AssetByDepartmentStats[]>>('/assets/by-department')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  /**
   * 중요도별 자산 통계 조회
   */
  async getAssetsByImportance(): Promise<AssetByImportanceStats[]> {
    try {
      const response = await apiClient.get<ApiResponse<AssetByImportanceStats[]>>('/assets/by-importance')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },
}
