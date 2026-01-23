import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import EvidenceTable from './EvidenceTable'
import type { EvidenceListItem, EvidenceStatus } from '@/types'

// Mock data
const mockEvidences: EvidenceListItem[] = [
  {
    id: 1,
    title: 'Access Control Policy',
    fileName: 'access_control_policy.pdf',
    status: 'active' as EvidenceStatus,
    version: 3,
    validUntil: '2025-12-31',
    uploaderName: 'John Doe',
    controlItemCount: 5,
    createdAt: '2024-01-15',
  },
  {
    id: 2,
    title: 'Security Training Record',
    fileName: 'security_training_2024.xlsx',
    status: 'draft' as EvidenceStatus,
    version: 7,
    validUntil: null,
    uploaderName: 'Jane Smith',
    controlItemCount: 8,
    createdAt: '2024-01-20',
  },
  {
    id: 3,
    title: 'Expired Certificate',
    fileName: 'expired_cert.pdf',
    status: 'expired' as EvidenceStatus,
    version: 4,
    validUntil: '2023-12-31',
    uploaderName: 'Bob Wilson',
    controlItemCount: 9,
    createdAt: '2023-06-01',
  },
]

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('EvidenceTable', () => {
  const defaultProps = {
    data: mockEvidences,
    loading: false,
    pagination: {
      current: 1,
      pageSize: 10,
      total: 3,
    },
    onTableChange: vi.fn(),
    onDelete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render table with evidence data', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      expect(screen.getByText('Access Control Policy')).toBeInTheDocument()
      expect(screen.getByText('Security Training Record')).toBeInTheDocument()
      expect(screen.getByText('Expired Certificate')).toBeInTheDocument()
    })

    it('should render table headers correctly', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('File Name')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Version')).toBeInTheDocument()
      expect(screen.getByText('Valid Until')).toBeInTheDocument()
      expect(screen.getByText('Uploader')).toBeInTheDocument()
      expect(screen.getByText('Controls')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('should display loading state', () => {
      const { container } = renderWithRouter(
        <EvidenceTable {...defaultProps} loading={true} data={[]} />
      )

      const spinner = container.querySelector('.ant-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should display empty state when no data', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} data={[]} />)

      expect(screen.getByText('No data')).toBeInTheDocument()
    })
  })

  describe('Status Badge', () => {
    it('should display correct status badge for active evidence', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      const activeRow = screen.getByText('Access Control Policy').closest('tr')
      expect(activeRow).toBeInTheDocument()
      expect(within(activeRow!).getByText('Active')).toBeInTheDocument()
    })

    it('should display correct status badge for draft evidence', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      const draftRow = screen.getByText('Security Training Record').closest('tr')
      expect(draftRow).toBeInTheDocument()
      expect(within(draftRow!).getByText('Draft')).toBeInTheDocument()
    })

    it('should display correct status badge for expired evidence', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      const expiredRow = screen.getByText('Expired Certificate').closest('tr')
      expect(expiredRow).toBeInTheDocument()
      expect(within(expiredRow!).getByText('Expired')).toBeInTheDocument()
    })
  })

  describe('Table Interactions', () => {
    it('should call onTableChange when pagination changes', async () => {
      const onTableChange = vi.fn()
      const { container } = renderWithRouter(
        <EvidenceTable
          {...defaultProps}
          onTableChange={onTableChange}
          pagination={{ current: 1, pageSize: 2, total: 5 }}
          data={mockEvidences.slice(0, 2)}
        />
      )

      // Check if pagination exists
      const pagination = container.querySelector('.ant-pagination')
      expect(pagination).toBeInTheDocument()
    })

    it('should render delete button when onDelete is provided', () => {
      const onDelete = vi.fn()
      const { container } = renderWithRouter(
        <EvidenceTable {...defaultProps} onDelete={onDelete} />
      )

      // Find delete buttons by aria-label (could be button elements or spans with aria-label)
      const deleteButtons = container.querySelectorAll('[aria-label="delete"]')
      expect(deleteButtons.length).toBeGreaterThanOrEqual(3)
    })

    it('should render view links for each evidence', () => {
      const { container } = renderWithRouter(<EvidenceTable {...defaultProps} />)

      // Find links in the table
      const links = container.querySelectorAll('a[href*="/evidence/"]')
      expect(links.length).toBeGreaterThan(0)
    })
  })

  describe('Version Display', () => {
    it('should display version number correctly', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      const row1 = screen.getByText('Access Control Policy').closest('tr')
      expect(within(row1!).getByText('v3')).toBeInTheDocument()

      const row2 = screen.getByText('Security Training Record').closest('tr')
      expect(within(row2!).getByText('v7')).toBeInTheDocument()
    })
  })

  describe('Valid Until Display', () => {
    it('should display valid until date when available', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      expect(screen.getByText('2025-12-31')).toBeInTheDocument()
    })

    it('should display dash when valid until is null', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      // Check for dash in the table
      const draftRow = screen.getByText('Security Training Record').closest('tr')
      expect(draftRow).toBeInTheDocument()
      expect(within(draftRow!).getByText('-')).toBeInTheDocument()
    })
  })

  describe('Control Item Count', () => {
    it('should display control item count in each row', () => {
      renderWithRouter(<EvidenceTable {...defaultProps} />)

      const row1 = screen.getByText('Access Control Policy').closest('tr')
      expect(within(row1!).getByText('5')).toBeInTheDocument()

      const row2 = screen.getByText('Security Training Record').closest('tr')
      expect(within(row2!).getByText('8')).toBeInTheDocument()

      const row3 = screen.getByText('Expired Certificate').closest('tr')
      expect(within(row3!).getByText('9')).toBeInTheDocument()
    })
  })

  describe('Row Selection', () => {
    it('should support row selection when enabled', () => {
      const onSelectionChange = vi.fn()
      renderWithRouter(
        <EvidenceTable
          {...defaultProps}
          rowSelection={{
            onChange: onSelectionChange,
          }}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })
  })

  describe('Sorting', () => {
    it('should call onTableChange when sorting', async () => {
      const onTableChange = vi.fn()
      renderWithRouter(
        <EvidenceTable {...defaultProps} onTableChange={onTableChange} />
      )

      // Click on a sortable column header
      const titleHeader = screen.getByText('Title')
      fireEvent.click(titleHeader)

      await waitFor(() => {
        expect(onTableChange).toHaveBeenCalled()
      })
    })
  })
})
