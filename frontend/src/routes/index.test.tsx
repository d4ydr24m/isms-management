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
vi.mock('@/pages/Auth/LoginPage', () => ({
  default: () => <div>Login Page</div>,
}))

vi.mock('@/pages/DashboardPage', () => ({
  default: () => <div>Dashboard Page</div>,
}))

vi.mock('@/pages/NotFoundPage', () => ({
  default: () => <div>404 Not Found</div>,
}))

// Mock PrivateRoute to just check auth and render children or redirect
vi.mock('./PrivateRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = (useAuthStore as any)()
    if (!isAuthenticated) {
      const { Navigate } = require('react-router-dom')
      return <Navigate to="/login" replace />
    }
    return <>{children}</>
  },
}))

// Mock all other page imports to prevent import errors
vi.mock('@/pages/Users', () => ({ default: () => <div>Users</div> }))
vi.mock('@/pages/Users/UserDetail', () => ({ default: () => <div>UserDetail</div> }))
vi.mock('@/pages/Users/UserCreate', () => ({ default: () => <div>UserCreate</div> }))
vi.mock('@/pages/Users/AuditorAccounts', () => ({ default: () => <div>AuditorAccounts</div> }))
vi.mock('@/pages/Evidence', () => ({ default: () => <div>Evidence</div> }))
vi.mock('@/pages/Evidence/EvidenceDetail', () => ({ default: () => <div>EvidenceDetail</div> }))
vi.mock('@/pages/Evidence/EvidenceCreate', () => ({ default: () => <div>EvidenceCreate</div> }))
vi.mock('@/pages/Audit', () => ({ default: () => <div>Audit</div> }))
vi.mock('@/pages/Audit/AuditDetail', () => ({ default: () => <div>AuditDetail</div> }))
vi.mock('@/pages/Audit/AuditCreate', () => ({ default: () => <div>AuditCreate</div> }))
vi.mock('@/pages/Audit/Checklist', () => ({ default: () => <div>Checklist</div> }))
vi.mock('@/pages/Audit/NonConformities', () => ({ default: () => <div>NonConformities</div> }))
vi.mock('@/pages/Audit/NonConformityDetail', () => ({ default: () => <div>NonConformityDetail</div> }))
vi.mock('@/pages/SearchResults', () => ({ default: () => <div>SearchResults</div> }))
vi.mock('@/pages/Assets', () => ({ default: () => <div>Assets</div> }))
vi.mock('@/pages/Assets/AssetDetail', () => ({ default: () => <div>AssetDetail</div> }))
vi.mock('@/pages/Assets/AssetCreate', () => ({ default: () => <div>AssetCreate</div> }))
vi.mock('@/pages/Assets/AssetImport', () => ({ default: () => <div>AssetImport</div> }))
vi.mock('@/pages/Risk', () => ({ default: () => <div>Risk</div> }))
vi.mock('@/pages/Risk/RiskScenarioDetail', () => ({ default: () => <div>RiskScenarioDetail</div> }))
vi.mock('@/pages/Risk/RiskAssessment', () => ({ default: () => <div>RiskAssessment</div> }))
vi.mock('@/pages/Risk/ThreatDB', () => ({ default: () => <div>ThreatDB</div> }))
vi.mock('@/pages/Risk/VulnerabilityDB', () => ({ default: () => <div>VulnerabilityDB</div> }))
vi.mock('@/pages/Risk/DoASettings', () => ({ default: () => <div>DoASettings</div> }))
vi.mock('@/pages/Risk/RiskTreatment', () => ({ default: () => <div>RiskTreatment</div> }))
vi.mock('@/pages/Risk/SOAManagement', () => ({ default: () => <div>SOAManagement</div> }))
vi.mock('@/pages/Risk/RiskReport', () => ({ default: () => <div>RiskReport</div> }))

describe('AppRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Public Routes', () => {
    it('should render login page at /login', () => {
      ;(useAuthStore as any).mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
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
        isLoading: false,
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
        isLoading: false,
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
        isLoading: false,
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
        isLoading: false,
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
        isLoading: false,
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
        isLoading: false,
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
