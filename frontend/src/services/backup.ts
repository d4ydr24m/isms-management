/**
 * 데이터베이스 백업/복원 API 서비스
 */
import { apiClient, handleApiError } from './api'

export interface BackupInfo {
  fileName: string
  filePath: string
  fileSize: number
  createdAt: string
  description: string
}

export interface BackupListResponse {
  items: BackupInfo[]
  total: number
}

export const getBackups = async (): Promise<BackupListResponse> => {
  try {
    const res = await apiClient.get('/backup')
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const createBackup = async (description: string = ''): Promise<BackupInfo> => {
  try {
    const res = await apiClient.post('/backup', { description })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const restoreBackup = async (filePath: string): Promise<{ message: string }> => {
  try {
    const res = await apiClient.post('/backup/restore', { filePath })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const restoreFromUpload = async (file: File): Promise<{ message: string }> => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await apiClient.post('/backup/restore-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    })
    return res.data
  } catch (error) {
    throw handleApiError(error)
  }
}

export const downloadBackup = async (fileName: string): Promise<void> => {
  try {
    const res = await apiClient.get(`/backup/download/${fileName}`, {
      responseType: 'blob',
    })
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

export const deleteBackup = async (fileName: string): Promise<void> => {
  try {
    await apiClient.delete(`/backup/${fileName}`)
  } catch (error) {
    throw handleApiError(error)
  }
}
