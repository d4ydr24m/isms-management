import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NonConformityDetail from './NonConformityDetail'

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
    getNonConformity: vi.fn().mockResolvedValue({
      id: 1,
      auditId: 1,
      auditTitle: '2024년 상반기 내부감사',
      controlItemId: 2,
      controlItem: { number: '1.1.2', title: '정책의 승인' },
      type: 'major',
      title: '최고경영자 승인 미비',
      description: '정보보호 정책에 대한 최고경영자의 승인이 확인되지 않음',
      evidence: '정보보호 정책서 검토 결과',
      rootCause: '승인 프로세스가 명확하게 정의되어 있지 않음',
      assigneeId: 1,
      assigneeName: '박담당',
      status: 'in_progress',
      dueDate: '2024-04-15',
      createdBy: 1,
      createdByName: '김심사',
      createdAt: '2024-03-05',
      updatedAt: '2024-03-10',
    }),
    updateNonConformity: vi.fn().mockResolvedValue({
      id: 1,
      title: '최고경영자 승인 미비',
    }),
    createCorrectiveAction: vi.fn().mockResolvedValue({ id: 1 }),
    updateCorrectiveAction: vi.fn().mockResolvedValue({ id: 1 }),
    verifyCorrectiveAction: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/services/users', () => ({
  userService: {
    getUsers: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: '박담당', email: 'park@test.com', roles: ['user'], isActive: true, createdAt: '2024-01-01' },
        { id: 2, name: '김심사', email: 'kim@test.com', roles: ['auditor'], isActive: true, createdAt: '2024-01-01' },
      ],
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    }),
  },
}))

const renderComponent = () => {
  return render(
    <MemoryRouter initialEntries={['/non-conformities/1']}>
      <Routes>
        <Route path="/non-conformities/:id" element={<NonConformityDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('NonConformityDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render non-conformity title', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText('최고경영자 승인 미비')).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render basic information', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check control item number is displayed
          expect(screen.getByText(/1\.1\.2/)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render detailed description', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/정보보호 정책에 대한 최고경영자의 승인이 확인되지 않음/)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render root cause analysis', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/승인 프로세스가 명확하게 정의되어 있지 않음/)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render assignee label', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check that Assignee label exists in the descriptions
          expect(screen.getByText(/Assignee/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should render audit reference', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/2024년 상반기 내부감사/)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Corrective Actions', () => {
    it('should render corrective actions section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Card title "Corrective Actions" should exist
          const elements = screen.getAllByText(/Corrective Action/i)
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 15000 }
      )
    })

    it('should have add corrective action button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /add corrective action/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Status Management', () => {
    it('should render change status button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /change status/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Status History', () => {
    it('should render status history section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/Status History/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Evidence Attachment', () => {
    it('should render attachments section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByText(/Attachments/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should have upload button for evidence', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /upload evidence/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Navigation', () => {
    it('should navigate back when back button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /back/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/non-conformities')
    })

    it('should have edit button', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })

  describe('Edit Mode', () => {
    it('should enter edit mode when edit button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /edit/i }))

      await waitFor(
        () => {
          // In edit mode, Save and Cancel buttons should appear
          expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
          expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('should exit edit mode when cancel button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /edit/i }))

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(
        () => {
          // Back to view mode, Edit and Change Status buttons should appear
          expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
          expect(screen.getByRole('button', { name: /change status/i })).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Status Change Modal', () => {
    it('should open status change modal when change status is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /change status/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /change status/i }))

      await waitFor(
        () => {
          // Modal title should appear
          expect(screen.getByText(/Select new status/i)).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Add Corrective Action', () => {
    it('should open add corrective action modal when button is clicked', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /add corrective action/i })).toBeInTheDocument()
        },
        { timeout: 15000 }
      )

      fireEvent.click(screen.getByRole('button', { name: /add corrective action/i }))

      await waitFor(
        () => {
          // Modal should appear with form fields
          expect(screen.getByText(/Implementation Plan/i)).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Data Display', () => {
    it('should display control item info', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check control item is displayed
          expect(screen.getByText(/Control Item/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display description section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check description label exists
          expect(screen.getByText(/Description/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })

    it('should display root cause section', { timeout: 20000 }, async () => {
      renderComponent()

      await waitFor(
        () => {
          // Check root cause label exists
          expect(screen.getByText(/Root Cause/i)).toBeInTheDocument()
        },
        { timeout: 15000 }
      )
    })
  })
})
