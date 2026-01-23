import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ControlListPage from './index'

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the control service
vi.mock('@/services/controls', () => ({
  controlService: {
    getControls: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          categoryId: 1,
          number: '1.1.1',
          title: '정보보호 정책 수립',
          description: '조직의 정보보호 정책을 수립한다',
          isRequired: true,
          evidenceCount: 3,
          hasEvidence: true,
          createdAt: '2024-01-15',
        },
        {
          id: 2,
          categoryId: 1,
          number: '1.1.2',
          title: '정책의 승인',
          description: '최고경영자의 승인을 받는다',
          isRequired: true,
          evidenceCount: 0,
          hasEvidence: false,
          createdAt: '2024-01-15',
        },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    }),
    getDomains: vi.fn().mockResolvedValue([
      {
        id: 1,
        code: '1',
        name: '관리체계 수립 및 운영',
        description: '관리체계 기반 마련',
        order: 1,
      },
    ]),
    getProgress: vi.fn().mockResolvedValue({
      totalControls: 100,
      controlsWithEvidence: 75,
      progressPercentage: 75,
      requiredControls: 80,
      requiredCompleted: 60,
      requiredProgressPercentage: 75,
      byDomain: [],
    }),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <ControlListPage />
    </MemoryRouter>
  )
}

describe('ControlListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Control Items')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render search input', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should display control items in table', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('1.1.1')).toBeInTheDocument()
          expect(screen.getByText('정보보호 정책 수립')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should show required badge for required controls', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          const requiredBadges = screen.getAllByText(/Required/i)
          expect(requiredBadges.length).toBeGreaterThan(0)
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Filtering', () => {
    it('should have domain filter in tree', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByRole('tree')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should filter by search term', { timeout: 20000 }, async () => {
      const { controlService } = await import('@/services/controls')

      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('정보보호 정책 수립')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )

      const searchInput = screen.getByPlaceholderText(/search/i)
      fireEvent.change(searchInput, { target: { value: '정책' } })

      // Wait for API call with search parameter
      await waitFor(
        () => {
          expect(controlService.getControls).toHaveBeenCalledWith(
            expect.objectContaining({ search: '정책' })
          )
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Progress Display', () => {
    it('should show progress card', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Progress')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Navigation', () => {
    it('should navigate to detail page when view button is clicked', { timeout: 20000 }, async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('정보보호 정책 수립')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )

      const viewButtons = screen.getAllByRole('button', { name: /view/i })
      fireEvent.click(viewButtons[0])

      expect(mockNavigate).toHaveBeenCalledWith('/controls/1')
    })
  })
})
