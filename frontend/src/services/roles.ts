import { apiClient, handleApiError } from './api'

export interface Permission {
  code: string
  name: string
  description: string
  category: string
}

export interface RoleDetail {
  id: number
  name: string
  description: string
  permissions: string[]
  isSystemRole: boolean
  userCount: number
  createdAt: string
}

export interface RoleListResponse {
  items: RoleDetail[]
  total: number
}

export interface PermissionListResponse {
  items: Permission[]
}

export const roleService = {
  async getRoles(): Promise<RoleDetail[]> {
    try {
      const response = await apiClient.get<RoleListResponse>('/roles')
      return response.data.items
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getAllPermissions(): Promise<Permission[]> {
    try {
      const response = await apiClient.get<PermissionListResponse>('/roles/permissions/all')
      return response.data.items
    } catch (error) {
      return handleApiError(error)
    }
  },

  async updateRolePermissions(roleId: number, permissions: string[]): Promise<RoleDetail> {
    try {
      const response = await apiClient.put<RoleDetail>(`/roles/${roleId}`, { permissions })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },
}
