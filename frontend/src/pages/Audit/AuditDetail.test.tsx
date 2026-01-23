import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuditDetail from './AuditDetail'

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  }
})

// Mock the audit service - mock data is defined inline to avoid hoisting issues
vi.mock('@/services/audits', () => ({
  auditService: {
    getAudit: vi.fn().mockResolvedValue({
      id: 1,
      title: '2024년 상반기 내부감사',
      description: '조직의 정보보호 관리체계 전반에 대한 내부감사',
      auditType: 'internal',
      status: 'in_progress',
      startDate: '2024-03-01',
      endDate: '2024-03-15',
      scope: '전 부서 대상 정보보호 관리체계 점검',
      auditorIds: [1, 2],
      auditors: [
        { id: 1, name: '김심사', email: 'kim@test.com', department: '감사팀' },
        { id: 2, name: '이심사', email: 'lee@test.com', department: '감사팀' },
      ],
      checklistCount: 50,
      nonConformityCount: 3,
      createdBy: 1,
      createdByName: '관리자',
      createdAt: '2024-01-15',
      updatedAt: '2024-02-20',
    }),
    getChecklist: vi.fn().mockResolvedValue([
      {
        id: 1,
        auditId: 1,
        controlItemId: 1,
        controlItem: { number: '1.1.1', title: '정보보호 정책 수립', description: '' },
        order: 1,
        result: 'conforming',
        findings: null,
        evidenceIds: [1],
        evidences: [],
        auditorId: 1,
        auditorName: '김심사',
        checkedAt: '2024-03-05',
        createdAt: '2024-03-01',
      },
      {
        id: 2,
        auditId: 1,
        controlItemId: 2,
        controlItem: { number: '1.1.2', title: '정책의 승인', description: '' },
        order: 2,
        result: null,
        findings: null,
        evidenceIds: [],
        evidences: [],
        auditorId: null,
        auditorName: null,
        checkedAt: null,
        createdAt: '2024-03-01',
      },
    ]),
    getNonConformities: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          auditId: 1,
          auditTitle: '2024년 상반기 내부감사',
          controlItemId: 2,
          controlItem: { number: '1.1.2', title: '정책의 승인' },
          type: 'major',
          title: '최고경영자 승인 미비',
          description: '정보보호 정책에 대한 최고경영자의 승인이 확인되지 않음',
          evidence: '정책 문서 검토 결과',
          rootCause: null,
          assigneeId: null,
          assigneeName: null,
          status: 'pending',
          dueDate: '2024-04-15',
          createdBy: 1,
          createdByName: '김심사',
          createdAt: '2024-03-05',
          updatedAt: '2024-03-05',
        },
      ],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    }),
    updateAudit: vi.fn().mockResolvedValue({
      id: 1,
      title: '2024년 상반기 내부감사',
    }),
  },
}))

const renderComponent = () => {
  return render(
    <MemoryRouter initialEntries={['/audits/1']}>
      <Routes>
        <Route path="/audits/:id" element={<AuditDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AuditDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render audit title', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('2024년 상반기 내부감사')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render audit basic information', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('Internal')).toBeInTheDocument()
          expect(screen.getByText('In Progress')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render audit scope', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/전 부서 대상 정보보호 관리체계 점검/)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render auditors section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check that auditors label exists
          expect(screen.getByText(/Auditors/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render checklist progress', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/Checklist Progress/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render non-conformity statistics', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Verify audit title is loaded first, indicating data is available
          expect(screen.getByText('2024년 상반기 내부감사')).toBeInTheDocument()
          // Then check for statistics labels on the statistic cards
          expect(screen.getByText('Total')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render edit button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render checklist navigation button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /view checklist/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render register non-conformity button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /register non-conformity/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Navigation', () => {
    it('should navigate to edit page when edit button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/audits/1/edit')
    })

    it('should navigate to checklist page when view checklist is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /view checklist/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /view checklist/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/audits/1/checklist')
    })

    it('should navigate back when back button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /back/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/audits')
    })
  })
})
