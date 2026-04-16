import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuditCreate from './AuditCreate'

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock services
vi.mock('@/services/audits', () => ({
  auditService: {
    createAudit: vi.fn().mockResolvedValue({
      id: 1,
      title: 'New Audit',
      auditType: 'internal',
      status: 'planned',
      startDate: '2024-03-01',
      endDate: '2024-03-15',
      scope: 'Test scope',
      auditorIds: [1],
      auditors: [],
      checklistCount: 0,
      nonConformityCount: 0,
      createdBy: 1,
      createdByName: 'Admin',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15',
    }),
  },
}))

vi.mock('@/services/users', () => ({
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: '김심사', email: 'kim@test.com', roles: ['auditor'], isActive: true, createdAt: '2024-01-01' },
        { id: 2, name: '이심사', email: 'lee@test.com', roles: ['auditor'], isActive: true, createdAt: '2024-01-01' },
        { id: 3, name: '관리자', email: 'admin@test.com', roles: ['admin'], isActive: true, createdAt: '2024-01-01' },
      ],
      meta: { total: 3, page: 1, limit: 100, totalPages: 1 },
    }),
  },
}))

vi.mock('@/services/auditorAccounts', () => ({
  auditorAccountService: {
    getAuditorAccounts: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          username: 'external1',
          email: 'ext@audit.com',
          name: '외부심사원',
          organization: 'KISA',
          validFrom: '2024-01-01',
          validUntil: '2024-12-31',
          scope: ['ISMS-P'],
          canDownload: true,
          isActive: true,
          createdBy: 1,
          createdByName: 'Admin',
          createdAt: '2024-01-01',
        },
      ],
      meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
    }),
  },
}))

vi.mock('@/services/controls', () => ({
  controlService: {
    getControls: vi.fn().mockResolvedValue({
      data: [
        { id: 1, number: '1.1.1', title: '경영진의 참여', isRequired: true },
        { id: 2, number: '1.1.2', title: '정책의 승인', isRequired: true },
        { id: 3, number: '1.1.3', title: '정책의 공표', isRequired: false },
      ],
      meta: { total: 3, page: 1, limit: 100, totalPages: 1 },
    }),
    getDomains: vi.fn().mockResolvedValue([
      { id: 1, code: '1', name: '관리체계 수립 및 운영', description: '', order: 1 },
    ]),
  },
}))

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <AuditCreate />
    </MemoryRouter>
  )
}

describe('AuditCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/Create Audit Plan/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render title input field', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByLabelText(/Audit Title/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render audit type selector', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByLabelText(/Audit Type/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render date range picker', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByLabelText(/Audit Period/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render scope textarea', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByLabelText(/Audit Scope/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render internal auditors section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // It's rendered as a label, need to find it differently
          const labels = screen.getAllByText(/Internal Auditors/i)
          expect(labels.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })

    it('should render external auditors section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // It's rendered as a label, need to find it differently
          const labels = screen.getAllByText(/External Auditors/i)
          expect(labels.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })

    it('should render submit and cancel buttons', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /Create$/i })).toBeInTheDocument()
          expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Form Validation', () => {
    it('should show error when title is empty', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /Create$/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /Create$/i }))

      await waitFor(
        () => {
          expect(screen.getByText(/Title is required/i)).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Navigation', () => {
    it('should navigate back when cancel is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  describe('Form Input', () => {
    it('should update title input value', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByLabelText(/Audit Title/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      const titleInput = screen.getByLabelText(/Audit Title/i)
      fireEvent.change(titleInput, { target: { value: 'Test Audit Title' } })
      expect(titleInput).toHaveValue('Test Audit Title')
    })

    it('should update scope textarea value', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByLabelText(/Audit Scope/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      const scopeInput = screen.getByLabelText(/Audit Scope/i)
      fireEvent.change(scopeInput, { target: { value: 'Test Scope Description' } })
      expect(scopeInput).toHaveValue('Test Scope Description')
    })
  })

  describe('Auditor Selection', () => {
    it('should have internal auditor selection', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check that Internal Auditors label exists
          const labels = screen.getAllByText(/Internal Auditors/i)
          expect(labels.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })

    it('should have external auditor selection', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check that External Auditors label exists
          const labels = screen.getAllByText(/External Auditors/i)
          expect(labels.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })
  })
})
