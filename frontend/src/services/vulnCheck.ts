/**
 * 취약점 점검 스크립트 API 서비스
 */

import { apiClient, handleApiError } from './api'
import type {
  VulnCheckScript,
  VulnCheckScriptList,
  VulnCheckScriptUpdate,
  VulnCheckSchedule,
  VulnCheckScheduleCreate,
  VulnCheckScheduleUpdate,
  VulnCheckScheduleList,
  VulnCheckExecution,
  VulnCheckExecutionCreate,
  VulnCheckExecutionList,
  VulnCheckStats,
} from '@/types/vulnCheck'

const BASE = '/vuln-check'

// =============================================================================
// 스크립트 API
// =============================================================================

export const getVulnCheckScripts = async (params?: {
  scriptType?: string
  isActive?: boolean
  categoryId?: number
  search?: string
}): Promise<VulnCheckScriptList> => {
  try {
    const res = await apiClient.get(`${BASE}/scripts`, { params })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const getVulnCheckScript = async (id: number): Promise<VulnCheckScript> => {
  try {
    const res = await apiClient.get(`${BASE}/scripts/${id}`)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const createVulnCheckScript = async (
  file: File,
  data: {
    name: string
    scriptType: string
    description?: string
    version?: string
    categoryId?: number
    targetAssetTypeId?: number
  }
): Promise<VulnCheckScript> => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', data.name)
    formData.append('script_type', data.scriptType)
    if (data.description) formData.append('description', data.description)
    if (data.version) formData.append('version', data.version)
    if (data.categoryId) formData.append('category_id', String(data.categoryId))
    if (data.targetAssetTypeId) formData.append('target_asset_type_id', String(data.targetAssetTypeId))

    const res = await apiClient.post(`${BASE}/scripts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const updateVulnCheckScript = async (
  id: number,
  data: VulnCheckScriptUpdate
): Promise<VulnCheckScript> => {
  try {
    const res = await apiClient.put(`${BASE}/scripts/${id}`, data)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const deleteVulnCheckScript = async (id: number): Promise<void> => {
  try {
    await apiClient.delete(`${BASE}/scripts/${id}`)
  } catch (error) {
    throw handleApiError(error)
  }
}

export const downloadVulnCheckScript = async (id: number): Promise<void> => {
  try {
    const res = await apiClient.get(`${BASE}/scripts/${id}/download`, {
      responseType: 'blob',
    })
    const contentDisposition = res.headers['content-disposition'] || ''
    const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/)
    const fileName = filenameMatch ? filenameMatch[1] : `script-${id}`

    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 스케줄 API
// =============================================================================

export const getVulnCheckSchedules = async (params?: {
  scriptId?: number
  isActive?: boolean
}): Promise<VulnCheckScheduleList> => {
  try {
    const res = await apiClient.get(`${BASE}/schedules`, { params })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const getVulnCheckSchedule = async (id: number): Promise<VulnCheckSchedule> => {
  try {
    const res = await apiClient.get(`${BASE}/schedules/${id}`)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const createVulnCheckSchedule = async (
  data: VulnCheckScheduleCreate
): Promise<VulnCheckSchedule> => {
  try {
    const res = await apiClient.post(`${BASE}/schedules`, data)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const updateVulnCheckSchedule = async (
  id: number,
  data: VulnCheckScheduleUpdate
): Promise<VulnCheckSchedule> => {
  try {
    const res = await apiClient.put(`${BASE}/schedules/${id}`, data)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const deleteVulnCheckSchedule = async (id: number): Promise<void> => {
  try {
    await apiClient.delete(`${BASE}/schedules/${id}`)
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 실행 API
// =============================================================================

export const getVulnCheckExecutions = async (params?: {
  scriptId?: number
  scheduleId?: number
  assetId?: number
  status?: string
  page?: number
  size?: number
}): Promise<VulnCheckExecutionList> => {
  try {
    const res = await apiClient.get(`${BASE}/executions`, { params })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const getVulnCheckExecution = async (id: number): Promise<VulnCheckExecution> => {
  try {
    const res = await apiClient.get(`${BASE}/executions/${id}`)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const updateVulnCheckExecution = async (
  id: number,
  data: {
    status: string
    resultSummary?: string
    resultDetail?: string
    vulnerabilitiesFound?: number
    severityHigh?: number
    severityMedium?: number
    severityLow?: number
    errorMessage?: string
  }
): Promise<VulnCheckExecution> => {
  try {
    const res = await apiClient.put(`${BASE}/executions/${id}`, data)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const uploadVulnCheckResult = async (
  executionId: number,
  file: File
): Promise<VulnCheckExecution> => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post(`${BASE}/executions/${executionId}/upload-result`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const createVulnCheckExecution = async (
  data: VulnCheckExecutionCreate
): Promise<VulnCheckExecution[]> => {
  try {
    const res = await apiClient.post(`${BASE}/executions`, data)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 통계 API
// =============================================================================

export const getVulnCheckStats = async (): Promise<VulnCheckStats> => {
  try {
    const res = await apiClient.get(`${BASE}/stats`)
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}
