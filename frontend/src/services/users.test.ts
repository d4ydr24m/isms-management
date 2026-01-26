import { describe, it, expect, beforeEach, vi } from 'vitest'
import { userService } from './users'
import { apiClient } from './api'

vi.mock('./api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  handleApiError: vi.fn((error) => {
    throw error
  }),
}))

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUsers', () => {
    it('사용자 목록을 조회한다', async () => {
      const mockResponse = {
        data: {
          items: [
            { id: 1, name: 'User 1', email: 'user1@example.com' },
            { id: 2, name: 'User 2', email: 'user2@example.com' },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

      const result = await userService.getUsers({ page: 1, limit: 10 })

      expect(apiClient.get).toHaveBeenCalledWith('/users', {
        params: { page: 1, limit: 10 },
      })
      expect(result.items).toHaveLength(2)
    })

    it('검색 파라미터를 전달한다', async () => {
      const mockResponse = {
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

      await userService.getUsers({ page: 1, limit: 10, search: 'test' })

      expect(apiClient.get).toHaveBeenCalledWith('/users', {
        params: { page: 1, limit: 10, search: 'test' },
      })
    })
  })

  describe('getUser', () => {
    it('사용자 상세 정보를 조회한다', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        roles: ['CISO'],
      }

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: mockUser },
      })

      const result = await userService.getUser(1)

      expect(apiClient.get).toHaveBeenCalledWith('/users/1')
      expect(result).toEqual(mockUser)
    })
  })

  describe('createUser', () => {
    it('사용자를 생성한다', async () => {
      const newUser = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        roleIds: [1],
      }

      const mockResponse = {
        id: 1,
        ...newUser,
      }

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: mockResponse },
      })

      const result = await userService.createUser(newUser)

      expect(apiClient.post).toHaveBeenCalledWith('/users', newUser)
      expect(result.email).toBe(newUser.email)
    })
  })

  describe('updateUser', () => {
    it('사용자를 수정한다', async () => {
      const updateData = {
        name: 'Updated User',
        isActive: false,
      }

      const mockResponse = {
        id: 1,
        ...updateData,
      }

      vi.mocked(apiClient.put).mockResolvedValue({
        data: { data: mockResponse },
      })

      const result = await userService.updateUser(1, updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/users/1', updateData)
      expect(result.name).toBe('Updated User')
    })
  })

  describe('deleteUser', () => {
    it('사용자를 삭제(비활성화)한다', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({})

      await userService.deleteUser(1)

      expect(apiClient.delete).toHaveBeenCalledWith('/users/1')
    })
  })

  describe('assignRoles', () => {
    it('사용자에게 역할을 할당한다', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({})

      await userService.assignRoles(1, [1, 2, 3])

      expect(apiClient.put).toHaveBeenCalledWith('/users/1/roles', {
        roleIds: [1, 2, 3],
      })
    })
  })

  describe('getRoles', () => {
    it('역할 목록을 조회한다', async () => {
      const mockRoles = [
        { id: 1, name: 'CISO', description: 'Chief Information Security Officer' },
        { id: 2, name: '보안담당자', description: 'Security Officer' },
      ]

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: mockRoles },
      })

      const result = await userService.getRoles()

      expect(apiClient.get).toHaveBeenCalledWith('/roles')
      expect(result).toEqual(mockRoles)
    })
  })
})
