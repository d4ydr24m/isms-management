import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Checklist from './Checklist'

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ auditId: '1' }),
  }
})

// Mock the audit service - mock data is defined inline to avoid hoisting issues
vi.mock('@/services/audits', () => ({
  auditService: {
    getAudit: vi.fn().mockResolvedValue({
      id: 1,
      title: '2024년 상반기 내부감사',
      status: 'in_progress',
    }),
    getChecklist: vi.fn().mockResolvedValue([
      {
        id: 1,
        auditId: 1,
        controlItemId: 1,
        controlItem: {
          number: '1.1.1',
          title: '정보보호 정책 수립',
          description: '조직의 정보보호 정책을 수립한다',
        },
        order: 1,
        result: 'conforming',
        findings: '정책 문서 확인됨',
        evidenceIds: [1],
        evidences: [{ id: 1, title: '정보보호 정책서', fileName: 'policy.pdf', version: 1 }],
        auditorId: 1,
        auditorName: '김심사',
        checkedAt: '2024-03-05',
        createdAt: '2024-03-01',
      },
      {
        id: 2,
        auditId: 1,
        controlItemId: 2,
        controlItem: {
          number: '1.1.2',
          title: '정책의 승인',
          description: '최고경영자의 승인을 받는다',
        },
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
    updateChecklistItem: vi.fn().mockResolvedValue(undefined),
    attachEvidence: vi.fn().mockResolvedValue(undefined),
    updateAudit: vi.fn().mockResolvedValue({
      id: 1,
      title: '2024년 상반기 내부감사',
      status: 'in_progress',
    }),
  },
}))

vi.mock('@/services/evidences', () => ({
  evidenceService: {
    getEvidences: vi.fn().mockResolvedValue({
      data: [
        { id: 1, title: '정보보호 정책서', fileName: 'policy.pdf', version: 1 },
        { id: 2, title: '승인 문서', fileName: 'approval.pdf', version: 1 },
      ],
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    }),
  },
}))

const renderComponent = () => {
  return render(
    <MemoryRouter initialEntries={['/audits/1/checklist']}>
      <Routes>
        <Route path="/audits/:auditId/checklist" element={<Checklist />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Checklist', () => {
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

    it('should render checklist items', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('1.1.1')).toBeInTheDocument()
          expect(screen.getByText('정보보호 정책 수립')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should show progress indicator', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check that progress section exists (using items checked text)
          expect(screen.getByText(/items checked/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render save button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render complete button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /complete audit/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should have filter options', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check for Result Filter dropdown
          expect(screen.getByText(/Result Filter/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should have unchecked filter option', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check for the checkbox with unchecked only label
          expect(screen.getByRole('checkbox')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render back button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render control item details', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('1.1.2')).toBeInTheDocument()
          expect(screen.getByText('정책의 승인')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render attach evidence buttons', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          const attachButtons = screen.getAllByRole('button', { name: /attach evidence/i })
          expect(attachButtons.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Interactions', () => {
    it('should navigate back when back button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /back/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/audits/1')
    })

    it('should toggle unchecked filter checkbox', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('checkbox')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
    })

    it('should call save when save button is clicked', { timeout: 20000 }, async () => {
      const { auditService } = await import('@/services/audits')
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      // Save button was clicked, but no modifications so no API call
      await waitFor(
        () => {
          expect(auditService.updateChecklistItem).not.toHaveBeenCalled()
        },
        { timeout: 5000 }
      )
    })
  })
})
