import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import EvidenceDetail from './EvidenceDetail'

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
    getEvidence: vi.fn().mockResolvedValue({
      id: 1,
      title: 'Access Control Policy',
      description: 'Policy document for access control management',
      filePath: '/files/access_control.pdf',
      fileName: 'access_control.pdf',
      fileSize: 1024 * 1024,
      fileHash: 'abc123',
      mimeType: 'application/pdf',
      version: 3,
      status: 'active',
      validFrom: '2024-01-01',
      validUntil: '2025-12-31',
      uploaderId: 1,
      uploaderName: 'John Doe',
      controlItems: [
        { id: 1, number: '1.1.1', title: 'Info Security Policy', category: 'Management' },
      ],
      createdAt: '2024-01-15',
      updatedAt: '2024-01-20',
    }),
    getVersions: vi.fn().mockResolvedValue([
      {
        id: 1,
        evidenceId: 1,
        version: 3,
        filePath: '/files/v3.pdf',
        fileName: 'access_control_v3.pdf',
        fileSize: 1024 * 1024,
        fileHash: 'hash3',
        uploaderId: 1,
        uploaderName: 'John Doe',
        changes: 'Updated section 3',
        createdAt: '2024-01-20',
      },
    ]),
    getPreviewUrl: vi.fn().mockResolvedValue('https://example.com/preview.pdf'),
    downloadEvidence: vi.fn().mockResolvedValue(undefined),
    mapControls: vi.fn().mockResolvedValue(undefined),
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

const renderWithRouter = (id: string = '1') => {
  return render(
    <MemoryRouter initialEntries={[`/evidence/${id}`]}>
      <Routes>
        <Route path="/evidence/:id" element={<EvidenceDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('EvidenceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render evidence title after load', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Access Control Policy')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render status badge', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Active')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Components', () => {
    it('should render file preview section', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('File Preview')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render control mapping section', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Control Item Mapping')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render version history section', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Version History')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Actions', () => {
    it('should render back button', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('Back')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    }, 30000)
  })
})
