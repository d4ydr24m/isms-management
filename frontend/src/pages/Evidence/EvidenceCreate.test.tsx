import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EvidenceCreate from './EvidenceCreate'

// Mock navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the evidence service
vi.mock('@/services/evidences', () => ({
  evidenceService: {
    createEvidence: vi.fn().mockResolvedValue({
      id: 1,
      title: 'New Evidence',
      status: 'draft',
    }),
  },
}))

// Mock control service
vi.mock('@/services/controls', () => ({
  controlService: {
    getControls: vi.fn().mockResolvedValue({
      data: [
        { id: 1, number: '1.1.1', title: 'Info Security Policy', isRequired: true },
      ],
      meta: { total: 1 },
    }),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <EvidenceCreate />
    </MemoryRouter>
  )
}

describe('EvidenceCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', () => {
      renderWithRouter()

      expect(screen.getByText('Create Evidence')).toBeInTheDocument()
    })

    it('should render title input field', () => {
      renderWithRouter()

      expect(screen.getByPlaceholderText('Enter evidence title')).toBeInTheDocument()
    })

    it('should render description textarea', () => {
      renderWithRouter()

      expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument()
    })

    it('should render file upload area', () => {
      renderWithRouter()

      expect(screen.getByText(/Click or drag file to this area to upload/i)).toBeInTheDocument()
    })

    it('should render date picker labels', () => {
      renderWithRouter()

      expect(screen.getByText('Valid From')).toBeInTheDocument()
      expect(screen.getByText('Valid Until')).toBeInTheDocument()
    })

    it('should render control items field', () => {
      renderWithRouter()

      expect(screen.getByText('Control Items')).toBeInTheDocument()
    })

    it('should render submit and cancel buttons', () => {
      renderWithRouter()

      expect(screen.getByRole('button', { name: /Create/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show error when title is empty on submit', async () => {
      renderWithRouter()

      const submitButton = screen.getByRole('button', { name: /Create/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Title is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate back when cancel is clicked', async () => {
      renderWithRouter()

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/evidence')
      })
    })
  })

  describe('File Upload', () => {
    it('should display file upload hint', () => {
      renderWithRouter()

      expect(screen.getByText(/Support for a single file upload/i)).toBeInTheDocument()
    })
  })
})
