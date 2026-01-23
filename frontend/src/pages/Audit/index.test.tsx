import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuditListPage from './index'

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the audit service
vi.mock('@/services/audits', () => ({
  auditService: {
    getAudits: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          title: '2024년 상반기 내부감사',
          auditType: 'internal',
          status: 'planned',
          startDate: '2024-03-01',
          endDate: '2024-03-15',
          scope: '전 부서 대상 정보보호 관리체계 점검',
          auditorIds: [1, 2],
          auditors: [
            { id: 1, name: '김심사', email: 'kim@test.com', department: '감사팀' },
          ],
          checklistCount: 50,
          nonConformityCount: 0,
          createdBy: 1,
          createdByName: '관리자',
          createdAt: '2024-01-15',
          updatedAt: '2024-01-15',
        },
        {
          id: 2,
          title: '2024년 ISMS-P 인증심사',
          auditType: 'certification',
          status: 'in_progress',
          startDate: '2024-04-01',
          endDate: '2024-04-30',
          scope: 'ISMS-P 인증 범위 전체',
          auditorIds: [3],
          auditors: [
            { id: 3, name: '외부심사원', email: 'external@audit.com', department: null },
          ],
          checklistCount: 80,
          nonConformityCount: 3,
          createdBy: 1,
          createdByName: '관리자',
          createdAt: '2024-02-01',
          updatedAt: '2024-02-10',
        },
        {
          id: 3,
          title: '2023년 하반기 내부감사',
          auditType: 'internal',
          status: 'completed',
          startDate: '2023-09-01',
          endDate: '2023-09-15',
          scope: '전 부서',
          auditorIds: [1],
          auditors: [],
          checklistCount: 45,
          nonConformityCount: 5,
          createdBy: 1,
          createdByName: '관리자',
          createdAt: '2023-08-01',
          updatedAt: '2023-09-20',
        },
      ],
      meta: {
        total: 3,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    }),
    deleteAudit: vi.fn().mockResolvedValue(undefined),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <AuditListPage />
    </MemoryRouter>
  )
}

describe('AuditListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Audit Management')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render create button', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /create audit plan/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render search input', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display audit items in table', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('2024년 상반기 내부감사')).toBeInTheDocument()
          expect(screen.getByText('2024년 ISMS-P 인증심사')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display audit type correctly', { timeout: 30000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          // Type is displayed in tags
          const internalTags = screen.getAllByText('Internal')
          expect(internalTags.length).toBeGreaterThan(0)
        },
        { timeout: 20000 }
      )
    })

    it('should display status with color coding', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          // Status tags should be present
          expect(screen.getByText(/planned/i)).toBeInTheDocument()
          expect(screen.getByText(/in progress/i)).toBeInTheDocument()
          expect(screen.getByText(/completed/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display audit period', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText(/2024-03-01/)).toBeInTheDocument()
          expect(screen.getByText(/2024-03-15/)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Filtering', () => {
    it('should have status filter dropdown', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          // Ant Design Select renders role="combobox"
          const selects = screen.getAllByRole('combobox')
          expect(selects.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })

    it('should have audit type filter dropdown', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          // Ant Design Select renders role="combobox"
          const selects = screen.getAllByRole('combobox')
          expect(selects.length).toBeGreaterThanOrEqual(2) // Status and Type filters
        },
        { timeout: 15000 }
      )
    })

    it('should filter by search term', { timeout: 20000 }, async () => {
      const { auditService } = await import('@/services/audits')

      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('2024년 상반기 내부감사')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )

      const searchInput = screen.getByPlaceholderText(/search/i)
      fireEvent.change(searchInput, { target: { value: 'ISMS' } })

      await waitFor(
        () => {
          expect(auditService.getAudits).toHaveBeenCalledWith(
            expect.objectContaining({ search: 'ISMS' })
          )
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Navigation', () => {
    it('should navigate to create page when create button is clicked', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /create audit plan/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      const createButton = screen.getByRole('button', { name: /create audit plan/i })
      fireEvent.click(createButton)

      expect(mockNavigate).toHaveBeenCalledWith('/audits/create')
    })

    it('should navigate to detail page when view button is clicked', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('2024년 상반기 내부감사')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )

      const viewButtons = screen.getAllByRole('button', { name: /view/i })
      fireEvent.click(viewButtons[0])

      expect(mockNavigate).toHaveBeenCalledWith('/audits/1')
    })

    it('should navigate to detail page when row is clicked', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('2024년 상반기 내부감사')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )

      fireEvent.click(screen.getByText('2024년 상반기 내부감사'))

      expect(mockNavigate).toHaveBeenCalledWith('/audits/1')
    })
  })

  describe('Pagination', () => {
    it('should display total count', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText(/total 3 items/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })
})
