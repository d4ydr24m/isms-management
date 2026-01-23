import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RoleRoute from './RoleRoute'
import { useAuthStore } from '@/stores/authStore'

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

describe('RoleRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication Check', () => {
    it('should redirect to login when not authenticated', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        user: null,
      })

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <div>Admin Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Login Page')).toBeInTheDocument()
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    })
  })

  describe('Role Authorization', () => {
    it('should render children when user has required role', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          roles: ['ADMIN'],
        },
      })

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <div>Admin Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Admin Content')).toBeInTheDocument()
    })

    it('should render children when user has one of multiple allowed roles', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'manager@example.com',
          name: 'Manager User',
          roles: ['MANAGER'],
        },
      })

      render(
        <MemoryRouter initialEntries={['/management']}>
          <Routes>
            <Route
              path="/management"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'MANAGER']}>
                  <div>Management Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Management Content')).toBeInTheDocument()
    })

    it('should show forbidden page when user does not have required role', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'user@example.com',
          name: 'Regular User',
          roles: ['USER'],
        },
      })

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <div>Admin Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText(/access denied/i)).toBeInTheDocument()
      expect(screen.getByText(/you do not have permission/i)).toBeInTheDocument()
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    })

    it('should handle user with multiple roles', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'superuser@example.com',
          name: 'Super User',
          roles: ['ADMIN', 'MANAGER', 'USER'],
        },
      })

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <div>Admin Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Admin Content')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should show forbidden when user has no roles', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'norole@example.com',
          name: 'No Role User',
          roles: [],
        },
      })

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <div>Admin Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText(/access denied/i)).toBeInTheDocument()
    })

    it('should show loading spinner while checking authentication', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        user: null,
        isLoading: true,
      })

      const { container } = render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <div>Admin Content</div>
                </RoleRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      )

      const spinner = container.querySelector('.ant-spin')
      expect(spinner).toBeInTheDocument()
      expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    })
  })
})
