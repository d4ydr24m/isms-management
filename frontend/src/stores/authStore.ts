import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CurrentUser, LoginRequest, LoginResponse } from '@/types'
import { authService } from '@/services'

interface AuthState {
  user: CurrentUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  login: (credentials: LoginRequest) => Promise<LoginResponse>
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
            })
          } else {
            set({ isLoading: false })
          }

          return response
        } catch (error: any) {
          set({
            error: error.message || 'Login failed',
            isLoading: false,
            isAuthenticated: false,
          })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
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
