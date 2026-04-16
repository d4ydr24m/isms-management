import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CurrentUser, LoginRequest, LoginResponse } from '@/types'
import { authService } from '@/services'
import { scheduleProactiveRefresh, cancelProactiveRefresh } from '@/services/api'

interface AuthState {
  user: CurrentUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  pendingMfaCredentials: { email: string; password: string } | null

  // Actions
  login: (credentials: LoginRequest) => Promise<LoginResponse>
  loginWithMfa: (otpCode: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  fetchCurrentUser: () => Promise<void>
  clearError: () => void
  setUser: (user: CurrentUser | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      pendingMfaCredentials: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authService.login(credentials)

          if (!response.requiresMfa) {
            set({
              user: {
                id: response.user.id,
                email: response.user.email,
                name: response.user.name,
                departmentId: null,
                department: null,
                roles: response.user.roles,
                permissions: [],
                isActive: true,
                isMfaEnabled: false,
              },
              isAuthenticated: true,
              isLoading: false,
              pendingMfaCredentials: null,
            })
            // 만료 전 선제적 토큰 갱신 예약
            if (response.expiresIn) {
              scheduleProactiveRefresh(response.expiresIn)
            }
          } else {
            set({
              isLoading: false,
              pendingMfaCredentials: { email: credentials.email, password: credentials.password },
            })
          }

          return response
        } catch (error: any) {
          set({
            error: error.message || '로그인에 실패했습니다',
            isLoading: false,
            isAuthenticated: false,
          })
          throw error
        }
      },

      loginWithMfa: async (otpCode: string) => {
        const state = useAuthStore.getState()
        const creds = state.pendingMfaCredentials
        if (!creds) {
          throw new Error('로그인 정보가 없습니다. 다시 로그인해주세요.')
        }

        set({ isLoading: true, error: null })
        try {
          const response = await authService.login({
            email: creds.email,
            password: creds.password,
            otpCode,
          })

          set({
            user: {
              id: response.user.id,
              email: response.user.email,
              name: response.user.name,
              departmentId: null,
              department: null,
              roles: response.user.roles,
              permissions: [],
              isActive: true,
              isMfaEnabled: true,
            },
            isAuthenticated: true,
            isLoading: false,
            pendingMfaCredentials: null,
          })
          // 만료 전 선제적 토큰 갱신 예약
          if (response.expiresIn) {
            scheduleProactiveRefresh(response.expiresIn)
          }

          return response
        } catch (error: any) {
          set({
            error: error.message || 'MFA 인증에 실패했습니다',
            isLoading: false,
          })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
        cancelProactiveRefresh()
        try {
          await authService.logout()
        } finally {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
        }
      },

      fetchCurrentUser: async () => {
        set({ isLoading: true, error: null })
        try {
          const user = await authService.getCurrentUser()
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: any) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || 'Failed to fetch user',
          })
        }
      },

      clearError: () => {
        set({ error: null })
      },

      setUser: (user) => {
        set({
          user,
          isAuthenticated: user !== null,
        })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
