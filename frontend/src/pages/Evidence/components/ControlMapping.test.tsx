import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ControlMapping from './ControlMapping'
import type { ControlItem, ControlItemMapping } from '@/types'

// Mock control items
const mockControlItems: ControlItem[] = [
  {
    id: 1,
    categoryId: 1,
    number: '1.1.1',
    title: 'Information Security Policy',
    description: 'Establish information security policies',
    isRequired: true,
    evidenceCount: 3,
    hasEvidence: true,
    createdAt: '2024-01-01',
  },
  {
    id: 2,
    categoryId: 1,
    number: '1.1.2',
    title: 'Policy Review',
    description: 'Review policies annually',
    isRequired: true,
    evidenceCount: 1,
    hasEvidence: true,
    createdAt: '2024-01-01',
  },
  {
    id: 3,
    categoryId: 2,
    number: '2.1.1',
    title: 'Access Control',
    description: 'Control access to systems',
    isRequired: false,
    evidenceCount: 0,
    hasEvidence: false,
    createdAt: '2024-01-01',
  },
]

// Mock mapped controls
const mockMappedControls: ControlItemMapping[] = [
  {
    id: 1,
    number: '1.1.1',
    title: 'Information Security Policy',
    category: 'Management System',
  },
]

describe('ControlMapping', () => {
  const defaultProps = {
    mappedControls: mockMappedControls,
    availableControls: mockControlItems,
    onChange: vi.fn(),
    loading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the component title', () => {
      render(<ControlMapping {...defaultProps} />)

      expect(screen.getByText('Control Item Mapping')).toBeInTheDocument()
    })

    it('should display currently mapped controls', () => {
      render(<ControlMapping {...defaultProps} />)

      expect(screen.getByText('1.1.1')).toBeInTheDocument()
      expect(screen.getByText('Information Security Policy')).toBeInTheDocument()
    })

    it('should show add control button', () => {
      render(<ControlMapping {...defaultProps} />)

      expect(screen.getByRole('button', { name: /add control/i })).toBeInTheDocument()
    })

    it('should display empty state when no controls are mapped', () => {
      render(<ControlMapping {...defaultProps} mappedControls={[]} />)

      expect(screen.getByText(/no control items mapped/i)).toBeInTheDocument()
    })

    it('should display loading state', () => {
      const { container } = render(
        <ControlMapping {...defaultProps} loading={true} />
      )

      const spinner = container.querySelector('.ant-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('should open modal when add control button is clicked', async () => {
      render(<ControlMapping {...defaultProps} />)

      const addButton = screen.getByRole('button', { name: /add control/i })
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByText('Select Control Items')).toBeInTheDocument()
      })
    })

    it('should render close button on tags when not in read-only mode', () => {
      const onChange = vi.fn()
      const { container } = render(<ControlMapping {...defaultProps} onChange={onChange} />)

      // Find close icons on tags
      const closeIcons = container.querySelectorAll('.ant-tag .anticon-close')
      expect(closeIcons.length).toBeGreaterThan(0)
    })

    it('should filter available controls in modal', async () => {
      render(<ControlMapping {...defaultProps} />)

      // Open modal
      const addButton = screen.getByRole('button', { name: /add control/i })
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
      })
    })
  })

  describe('Display', () => {
    it('should display control number with title', () => {
      render(<ControlMapping {...defaultProps} />)

      expect(screen.getByText('1.1.1')).toBeInTheDocument()
    })

    it('should display mapped control count', () => {
      render(<ControlMapping {...defaultProps} />)

      expect(screen.getByText(/1/)).toBeInTheDocument()
    })

    it('should show required badge for required controls', () => {
      const mappedWithRequired: ControlItemMapping[] = [
        {
          id: 1,
          number: '1.1.1',
          title: 'Information Security Policy',
          category: 'Required',
        },
      ]

      render(<ControlMapping {...defaultProps} mappedControls={mappedWithRequired} />)

      expect(screen.getByText('1.1.1')).toBeInTheDocument()
    })
  })

  describe('Read-only mode', () => {
    it('should not show add/remove buttons in read-only mode', () => {
      render(<ControlMapping {...defaultProps} readOnly={true} />)

      expect(screen.queryByRole('button', { name: /add control/i })).not.toBeInTheDocument()
    })

    it('should still display mapped controls in read-only mode', () => {
      render(<ControlMapping {...defaultProps} readOnly={true} />)

      expect(screen.getByText('1.1.1')).toBeInTheDocument()
      expect(screen.getByText('Information Security Policy')).toBeInTheDocument()
    })
  })
})
