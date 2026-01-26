import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from './authStore'
import { authService } from '@/services'

vi.mock('@/services', () => ({
  authService: {
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}))

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 스토어 상태 초기화
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current.setUser(null)
    })
  })

  it('초기 상태가 올바르다', () => {
    const { result } = renderHook(() => useAuthStore())

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('setUser가 사용자를 설정한다', () => {
    const { result } = renderHook(() => useAuthStore())
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      departmentId: 1,
      department: { id: 1, name: 'IT', code: 'IT', parentId: null, managerId: null, isActive: true, createdAt: '2024-01-01' },
      roles: ['CISO'],
      permissions: [],
      isActive: true,
      isMfaEnabled: false,
    }

    act(() => {
      result.current.setUser(mockUser)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('setUser(null)이 사용자를 null로 설정한다', () => {
    const { result } = renderHook(() => useAuthStore())
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      departmentId: null,
      department: null,
      roles: ['CISO'],
      permissions: [],
      isActive: true,
      isMfaEnabled: false,
    }

    act(() => {
      result.current.setUser(mockUser)
    })

    expect(result.current.isAuthenticated).toBe(true)

    act(() => {
      result.current.setUser(null)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('clearError가 에러를 지운다', () => {
    const { result } = renderHook(() => useAuthStore())

    // clearError 함수가 존재하는지 확인
    expect(typeof result.current.clearError).toBe('function')

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeNull()
  })

  it('login 성공 시 사용자 정보를 저장한다', async () => {
    const { result } = renderHook(() => useAuthStore())
    const mockResponse = {
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      requiresMfa: false,
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: ['CISO'],
      },
    }

    vi.mocked(authService.login).mockResolvedValue(mockResponse)

    await act(async () => {
      await result.current.login({ email: 'test@example.com', password: 'password123' })
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).not.toBeNull()
    expect(result.current.user?.email).toBe('test@example.com')
  })

  it('login 실패 시 에러가 throw된다', async () => {
    const { result } = renderHook(() => useAuthStore())

    vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'))

    await expect(async () => {
      await act(async () => {
        await result.current.login({ email: 'test@example.com', password: 'wrong' })
      })
    }).rejects.toThrow('Invalid credentials')

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('logout이 사용자 정보를 지운다', async () => {
    const { result } = renderHook(() => useAuthStore())
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      departmentId: null,
      department: null,
      roles: ['CISO'],
      permissions: [],
      isActive: true,
      isMfaEnabled: false,
    }

    vi.mocked(authService.logout).mockResolvedValue(undefined)

    // 먼저 사용자 설정
    act(() => {
      result.current.setUser(mockUser)
    })

    expect(result.current.isAuthenticated).toBe(true)

    // 로그아웃
    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('fetchCurrentUser 성공 시 사용자 정보를 설정한다', async () => {
    const { result } = renderHook(() => useAuthStore())
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      departmentId: null,
      department: null,
      roles: ['CISO'],
      permissions: [],
      isActive: true,
      isMfaEnabled: false,
    }

    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser)

    await act(async () => {
      await result.current.fetchCurrentUser()
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('fetchCurrentUser 실패 시 에러를 설정한다', async () => {
    const { result } = renderHook(() => useAuthStore())

    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('Unauthorized'))

    await act(async () => {
      await result.current.fetchCurrentUser()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBe('Unauthorized')
  })

  it('MFA가 필요한 로그인 응답을 처리한다', async () => {
    const { result } = renderHook(() => useAuthStore())
    const mockResponse = {
      accessToken: '',
      refreshToken: '',
      requiresMfa: true,
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: ['CISO'],
      },
    }

    vi.mocked(authService.login).mockResolvedValue(mockResponse)

    await act(async () => {
      const response = await result.current.login({ email: 'test@example.com', password: 'password123' })
      expect(response.requiresMfa).toBe(true)
    })

    // MFA가 필요한 경우 isAuthenticated는 false 유지
    expect(result.current.isAuthenticated).toBe(false)
  })
})
