import { apiClient, handleApiError } from './api'
import type {
  User,
  UserCreate,
  UserUpdate,
  UserListItem,
  Role,
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
} from '@/types'

export const userService = {
  // 사용자 목록 조회
  async getUsers(params?: PaginationParams & { search?: string; departmentId?: number; isActive?: boolean }): Promise<PaginatedResponse<UserListItem>> {
    try {
      const response = await apiClient.get<PaginatedResponse<UserListItem>>('/users', { params })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 사용자 상세 조회
  async getUser(id: number): Promise<User> {
    try {
      const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 사용자 생성
  async createUser(data: UserCreate): Promise<User> {
    try {
      const response = await apiClient.post<ApiResponse<User>>('/users', data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 사용자 수정
  async updateUser(id: number, data: UserUpdate): Promise<User> {
    try {
      const response = await apiClient.put<ApiResponse<User>>(`/users/${id}`, data)
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 사용자 삭제 (비활성화)
  async deleteUser(id: number): Promise<void> {
    try {
      await apiClient.delete(`/users/${id}`)
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 사용자 역할 할당
  async assignRoles(id: number, roleIds: number[]): Promise<void> {
    try {
      await apiClient.put(`/users/${id}/roles`, { roleIds })
    } catch (error) {
      return handleApiError(error)
    }
  },

  // 역할 목록 조회
  async getRoles(): Promise<Role[]> {
    try {
      const response = await apiClient.get<ApiResponse<Role[]>>('/roles')
      return response.data.data!
    } catch (error) {
      return handleApiError(error)
    }
  },
}
