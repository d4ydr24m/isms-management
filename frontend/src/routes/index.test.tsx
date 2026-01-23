import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppRouter from './index'
import { useAuthStore } from '@/stores/authStore'

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

// Mock all page components
vi.mock('@/pages/auth/LoginPage', () => ({
  default: () => <div>Login Page</div>,
}))

vi.mock('@/pages/DashboardPage', () => ({
  default: () => <div>Dashboard Page</div>,
}))

vi.mock('@/pages/NotFoundPage', () => ({
  default: () => <div>404 Not Found</div>,
}))

describe('AppRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Public Routes', () => {
    it('should render login page at /login', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        user: null,
      })

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AppRouter />
        </MemoryRouter>
      )

      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route unauthenticated', async () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        user: null,
      })

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppRouter />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument()
      })
    })

    it('should render dashboard when authenticated', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['USER'],
          permissions: [],
        },
      })

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppRouter />
        </MemoryRouter>
      )

      expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    })

    it('should redirect to dashboard when accessing login while authenticated', async () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['USER'],
          permissions: [],
        },
      })

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AppRouter />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
      })
    })
  })

  describe('404 Not Found', () => {
    it('should render 404 page for unknown routes', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        user: null,
      })

      render(
        <MemoryRouter initialEntries={['/unknown-route']}>
          <AppRouter />
        </MemoryRouter>
      )

      expect(screen.getByText('404 Not Found')).toBeInTheDocument()
    })
  })

  describe('Root Route', () => {
    it('should redirect to dashboard when authenticated at root', async () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          roles: ['USER'],
          permissions: [],
        },
      })

      render(
        <MemoryRouter initialEntries={['/']}>
          <AppRouter />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
      })
    })

    it('should redirect to login when unauthenticated at root', async () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        user: null,
      })

      render(
        <MemoryRouter initialEntries={['/']}>
          <AppRouter />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument()
      })
    })
  })
})
