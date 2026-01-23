import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VersionHistory from './VersionHistory'
import type { EvidenceVersion } from '@/types'

// Mock version data
const mockVersions: EvidenceVersion[] = [
  {
    id: 1,
    evidenceId: 100,
    version: 3,
    filePath: '/files/evidence_v3.pdf',
    fileName: 'evidence_v3.pdf',
    fileSize: 1024 * 1024 * 2, // 2MB
    fileHash: 'abc123hash',
    uploaderId: 1,
    uploaderName: 'John Doe',
    changes: 'Updated policy section 3.1',
    createdAt: '2024-01-20T10:30:00Z',
  },
  {
    id: 2,
    evidenceId: 100,
    version: 2,
    filePath: '/files/evidence_v2.pdf',
    fileName: 'evidence_v2.pdf',
    fileSize: 1024 * 1024, // 1MB
    fileHash: 'def456hash',
    uploaderId: 2,
    uploaderName: 'Jane Smith',
    changes: 'Added compliance requirements',
    createdAt: '2024-01-15T14:00:00Z',
  },
  {
    id: 3,
    evidenceId: 100,
    version: 1,
    filePath: '/files/evidence_v1.pdf',
    fileName: 'evidence_v1.pdf',
    fileSize: 512 * 1024, // 512KB
    fileHash: 'ghi789hash',
    uploaderId: 1,
    uploaderName: 'John Doe',
    changes: 'Initial version',
    createdAt: '2024-01-10T09:00:00Z',
  },
]

describe('VersionHistory', () => {
  const defaultProps = {
    versions: mockVersions,
    currentVersion: 3,
    onDownload: vi.fn(),
    loading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the component title', () => {
      render(<VersionHistory {...defaultProps} />)

      expect(screen.getByText('Version History')).toBeInTheDocument()
    })

    it('should display all versions', () => {
      render(<VersionHistory {...defaultProps} />)

      expect(screen.getByText('v3')).toBeInTheDocument()
      expect(screen.getByText('v2')).toBeInTheDocument()
      expect(screen.getByText('v1')).toBeInTheDocument()
    })

    it('should display version changes', () => {
      render(<VersionHistory {...defaultProps} />)

      expect(screen.getByText('Updated policy section 3.1')).toBeInTheDocument()
      expect(screen.getByText('Added compliance requirements')).toBeInTheDocument()
      expect(screen.getByText('Initial version')).toBeInTheDocument()
    })

    it('should display uploader names', () => {
      render(<VersionHistory {...defaultProps} />)

      expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('should highlight current version', () => {
      render(<VersionHistory {...defaultProps} />)

      // Current version should have a special indicator
      expect(screen.getByText('Current')).toBeInTheDocument()
    })

    it('should display loading state', () => {
      const { container } = render(
        <VersionHistory {...defaultProps} loading={true} />
      )

      const spinner = container.querySelector('.ant-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should display empty state when no versions', () => {
      render(<VersionHistory {...defaultProps} versions={[]} />)

      expect(screen.getByText(/no version history/i)).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should call onDownload when download button is clicked', async () => {
      const onDownload = vi.fn()
      render(<VersionHistory {...defaultProps} onDownload={onDownload} />)

      const downloadButtons = screen.getAllByRole('button', { name: /download/i })
      expect(downloadButtons.length).toBe(3)

      fireEvent.click(downloadButtons[0])

      await waitFor(() => {
        expect(onDownload).toHaveBeenCalledWith(1, 'evidence_v3.pdf')
      })
    })
  })

  describe('File Size Display', () => {
    it('should format file size correctly', () => {
      render(<VersionHistory {...defaultProps} />)

      // Check for formatted file sizes
      expect(screen.getByText(/2.*MB/i)).toBeInTheDocument()
      expect(screen.getByText(/1.*MB/i)).toBeInTheDocument()
      expect(screen.getByText(/512.*KB/i)).toBeInTheDocument()
    })
  })

  describe('Date Display', () => {
    it('should display formatted dates', () => {
      render(<VersionHistory {...defaultProps} />)

      // Should display dates in a readable format
      const dateElements = screen.getAllByText(/2024/)
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })

  describe('Timeline Display', () => {
    it('should render versions in timeline format', () => {
      const { container } = render(<VersionHistory {...defaultProps} />)

      // Check for timeline structure
      const timeline = container.querySelector('.ant-timeline')
      expect(timeline).toBeInTheDocument()
    })

    it('should order versions from newest to oldest', () => {
      render(<VersionHistory {...defaultProps} />)

      const versionLabels = screen.getAllByText(/^v\d+$/)
      expect(versionLabels[0].textContent).toBe('v3')
      expect(versionLabels[1].textContent).toBe('v2')
      expect(versionLabels[2].textContent).toBe('v1')
    })
  })
})
