import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { authService } from './auth'
import { apiClient } from './api'

vi.mock('./api', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  handleApiError: vi.fn((error) => {
    throw error
  }),
}))

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('login', () => {
    it('로그인 성공 시 토큰을 저장한다', async () => {
      const mockResponse = {
        data: {
          data: {
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            requiresMfa: false,
            user: {
              id: 1,
              email: 'test@example.com',
              name: 'Test User',
              roles: ['CISO'],
            },
          },
        },
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      })
      expect(localStorage.getItem('accessToken')).toBe('test-access-token')
      expect(localStorage.getItem('refreshToken')).toBe('test-refresh-token')
      expect(result.requiresMfa).toBe(false)
    })

    it('MFA가 필요한 경우 토큰을 저장하지 않는다', async () => {
      const mockResponse = {
        data: {
          data: {
            accessToken: '',
            refreshToken: '',
            requiresMfa: true,
            user: {
              id: 1,
              email: 'test@example.com',
              name: 'Test User',
              roles: ['CISO'],
            },
          },
        },
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
      expect(result.requiresMfa).toBe(true)
    })
  })

  describe('logout', () => {
    it('로그아웃 시 토큰을 제거한다', async () => {
      localStorage.setItem('accessToken', 'test-token')
      localStorage.setItem('refreshToken', 'test-refresh')

      vi.mocked(apiClient.post).mockResolvedValue({})

      await authService.logout()

      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
    })

    it('로그아웃 API 실패해도 토큰은 제거된다', async () => {
      localStorage.setItem('accessToken', 'test-token')
      localStorage.setItem('refreshToken', 'test-refresh')

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'))

      await authService.logout()

      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
    })
  })

  describe('refreshToken', () => {
    it('토큰 갱신 요청을 보낸다', async () => {
      const mockResponse = {
        data: {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await authService.refreshToken('old-refresh-token')

      expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'old-refresh-token',
      })
      expect(result.accessToken).toBe('new-access-token')
    })
  })

  describe('getCurrentUser', () => {
    it('현재 사용자 정보를 가져온다', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        departmentId: 1,
        department: { id: 1, name: 'IT', code: 'IT' },
        roles: ['CISO'],
        permissions: [],
        isActive: true,
        isMfaEnabled: false,
      }

      const mockResponse = {
        data: {
          data: mockUser,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

      const result = await authService.getCurrentUser()

      expect(apiClient.get).toHaveBeenCalledWith('/auth/me')
      expect(result).toEqual(mockUser)
    })
  })

  describe('changePassword', () => {
    it('비밀번호 변경 요청을 보낸다', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({})

      await authService.changePassword({
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      })

      expect(apiClient.post).toHaveBeenCalledWith('/auth/password/change', {
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      })
    })
  })

  describe('setupMfa', () => {
    it('MFA 설정 요청을 보낸다', async () => {
      const mockResponse = {
        data: {
          data: {
            secret: 'test-secret',
            qrCode: 'data:image/png;base64,TEST',
            backupCodes: ['CODE1', 'CODE2'],
          },
        },
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await authService.setupMfa()

      expect(apiClient.post).toHaveBeenCalledWith('/auth/mfa/setup')
      expect(result.secret).toBe('test-secret')
      expect(result.backupCodes).toHaveLength(2)
    })
  })

  describe('verifyMfa', () => {
    it('MFA 검증 성공 시 토큰을 저장한다', async () => {
      const mockResponse = {
        data: {
          data: {
            accessToken: 'mfa-access-token',
            refreshToken: 'mfa-refresh-token',
            requiresMfa: false,
            user: {
              id: 1,
              email: 'test@example.com',
              name: 'Test User',
              roles: ['CISO'],
            },
          },
        },
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await authService.verifyMfa({
        code: '123456',
      })

      expect(apiClient.post).toHaveBeenCalledWith('/auth/mfa/verify', {
        code: '123456',
      })
      expect(localStorage.getItem('accessToken')).toBe('mfa-access-token')
      expect(localStorage.getItem('refreshToken')).toBe('mfa-refresh-token')
    })
  })
})
