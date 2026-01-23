import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NonConformities from './NonConformities'

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the audit service - mock data is defined inline to avoid hoisting issues
vi.mock('@/services/audits', () => ({
  auditService: {
    getNonConformities: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          auditId: 1,
          auditTitle: '2024년 상반기 내부감사',
          controlItemId: 2,
          controlItem: { number: '1.1.2', title: '정책의 승인' },
          type: 'critical',
          title: '최고경영자 승인 미비',
          description: '정보보호 정책에 대한 최고경영자의 승인이 확인되지 않음',
          evidence: '정책 문서 검토 결과',
          rootCause: '승인 프로세스 미정립',
          assigneeId: 1,
          assigneeName: '박담당',
          status: 'pending',
          dueDate: '2024-04-15',
          createdBy: 1,
          createdByName: '김심사',
          createdAt: '2024-03-05',
          updatedAt: '2024-03-05',
        },
        {
          id: 2,
          auditId: 1,
          auditTitle: '2024년 상반기 내부감사',
          controlItemId: 5,
          controlItem: { number: '2.1.1', title: '위험 평가' },
          type: 'major',
          title: '위험 평가 미수행',
          description: '연간 위험 평가가 수행되지 않음',
          evidence: '위험평가 보고서 부재',
          rootCause: null,
          assigneeId: 2,
          assigneeName: '이담당',
          status: 'in_progress',
          dueDate: '2024-04-20',
          createdBy: 1,
          createdByName: '김심사',
          createdAt: '2024-03-06',
          updatedAt: '2024-03-10',
        },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    }),
    deleteNonConformity: vi.fn().mockResolvedValue(undefined),
  },
}))

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <NonConformities />
    </MemoryRouter>
  )
}

describe('NonConformities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/Non-conformities/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render create button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /register non-conformity/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render search input', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display non-conformities in table', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('최고경영자 승인 미비')).toBeInTheDocument()
          expect(screen.getByText('위험 평가 미수행')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display control item number', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('1.1.2')).toBeInTheDocument()
          expect(screen.getByText('2.1.1')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display due date', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/2024-04-15/)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Filtering', () => {
    it('should have severity filter dropdown', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Ant Design Select renders role="combobox"
          const selects = screen.getAllByRole('combobox')
          expect(selects.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })

    it('should have status filter dropdown', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Ant Design Select renders role="combobox"
          const selects = screen.getAllByRole('combobox')
          expect(selects.length).toBeGreaterThanOrEqual(2) // Severity and Status filters
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Navigation', () => {
    it('should navigate to create page when register button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /register non-conformity/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /register non-conformity/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/non-conformities/create')
    })

    it('should navigate to detail page when view button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('최고경영자 승인 미비')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      const viewButtons = screen.getAllByRole('button', { name: /view/i })
      fireEvent.click(viewButtons[0])

      expect(mockNavigate).toHaveBeenCalledWith('/non-conformities/1')
    })
  })

  describe('Pagination', () => {
    it('should display total count', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/total 2 items/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })
})
