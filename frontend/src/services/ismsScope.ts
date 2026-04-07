import { apiClient } from './api'

export interface ScopeStats {
  entityType: string
  total: number
  inScope: number
  outOfScope: number
}

export interface ScopeSummary {
  assets: ScopeStats
  personnel: ScopeStats
  departments: ScopeStats
}

export interface AssetScopeItem {
  id: number
  assetCode: string
  name: string
  assetTypeName: string | null
  departmentName: string | null
  status: string | null
  inIsmsScope: boolean
  scopeReason: string | null
}

export interface PersonnelScopeItem {
  id: number
  name: string
  email: string | null
  position: string | null
  departmentName: string | null
  inIsmsScope: boolean
  scopeReason: string | null
}

export interface DepartmentScopeItem {
  id: number
  name: string
  code: string
  parentName: string | null
  inIsmsScope: boolean
  scopeReason: string | null
}

export interface ScopeChangeItem {
  id: number
  entityType: string
  entityId: number
  entityName: string | null
  oldScope: boolean
  newScope: boolean
  reason: string | null
  changedByName: string | null
  changedAt: string
}

export interface ScopeListResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ScopeUpdateRequest {
  inIsmsScope: boolean
  reason?: string
}

export interface BulkScopeUpdateRequest {
  ids: number[]
  inIsmsScope: boolean
  reason?: string
}

export const ismsScopeService = {
  // 통계
  getStats: () =>
    apiClient.get<ScopeSummary>('/isms-scope/stats'),

  // 자산
  getAssets: (params: Record<string, any>) =>
    apiClient.get<ScopeListResponse<AssetScopeItem>>('/isms-scope/assets', { params }),

  updateAssetScope: (id: number, data: ScopeUpdateRequest) =>
    apiClient.put(`/isms-scope/assets/${id}`, data),

  bulkUpdateAssetScope: (data: BulkScopeUpdateRequest) =>
    apiClient.put('/isms-scope/bulk/assets', data),

  // 담당자
  getPersonnel: (params: Record<string, any>) =>
    apiClient.get<ScopeListResponse<PersonnelScopeItem>>('/isms-scope/personnel', { params }),

  updatePersonnelScope: (id: number, data: ScopeUpdateRequest) =>
    apiClient.put(`/isms-scope/personnel/${id}`, data),

  bulkUpdatePersonnelScope: (data: BulkScopeUpdateRequest) =>
    apiClient.put('/isms-scope/bulk/personnel', data),

  // 부서
  getDepartments: (params: Record<string, any>) =>
    apiClient.get<ScopeListResponse<DepartmentScopeItem>>('/isms-scope/departments', { params }),

  updateDepartmentScope: (id: number, data: ScopeUpdateRequest) =>
    apiClient.put(`/isms-scope/departments/${id}`, data),

  bulkUpdateDepartmentScope: (data: BulkScopeUpdateRequest) =>
    apiClient.put('/isms-scope/bulk/departments', data),

  // 변경 이력
  getChanges: (params: Record<string, any>) =>
    apiClient.get<ScopeListResponse<ScopeChangeItem>>('/isms-scope/changes', { params }),
}
