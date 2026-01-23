import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EvidenceListPage from './index'

// Mock navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

// Mock the evidence service
vi.mock('@/services/evidences', () => ({
  evidenceService: {
    getEvidences: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          title: 'Access Control Policy',
          fileName: 'access_control.pdf',
          status: 'active',
          version: 1,
          validUntil: '2025-12-31',
          uploaderName: 'John Doe',
          controlItemCount: 3,
          createdAt: '2024-01-15',
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    }),
    deleteEvidence: vi.fn().mockResolvedValue(undefined),
    downloadEvidence: vi.fn().mockResolvedValue(undefined),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <EvidenceListPage />
    </MemoryRouter>
  )
}

describe('EvidenceListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', async () => {
      renderWithRouter()

      // Title should be visible immediately
      expect(screen.getByText('Evidence Management')).toBeInTheDocument()
    })

    it('should render create button', () => {
      renderWithRouter()

      expect(screen.getByText(/create evidence/i)).toBeInTheDocument()
    })

    it('should render search input', () => {
      renderWithRouter()

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    })

    it('should render status filter', () => {
      renderWithRouter()

      expect(screen.getByText(/filter by status/i)).toBeInTheDocument()
    })

    it('should display evidence data in table after load', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Access Control Policy')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Table Structure', () => {
    it('should render table headers', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Title')).toBeInTheDocument()
          expect(screen.getByText('Actions')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })
})
