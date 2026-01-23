import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ControlTree from './ControlTree'
import type { ControlDomain } from '@/types'

// Mock control service
vi.mock('@/services/controls', () => ({
  controlService: {
    getDomains: vi.fn().mockResolvedValue([
      {
        id: 1,
        code: '1',
        name: '관리체계 수립 및 운영',
        description: '관리체계 기반 마련',
        order: 1,
      },
      {
        id: 2,
        code: '2',
        name: '보호대책 요구사항',
        description: '보호대책 수립',
        order: 2,
      },
    ]),
  },
}))

const mockDomains: ControlDomain[] = [
  {
    id: 1,
    code: '1',
    name: '관리체계 수립 및 운영',
    description: '관리체계 기반 마련',
    order: 1,
  },
  {
    id: 2,
    code: '2',
    name: '보호대책 요구사항',
    description: '보호대책 수립',
    order: 2,
  },
]

describe('ControlTree', () => {
  const mockOnSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render tree with domains', () => {
      render(<ControlTree domains={mockDomains} onSelect={mockOnSelect} />)

      // Check that domain names are rendered (they are inside tree nodes)
      expect(screen.getByTestId('tree-node-domain-1')).toBeInTheDocument()
      expect(screen.getByTestId('tree-node-domain-2')).toBeInTheDocument()
    })

    it('should render domain code prefix', () => {
      render(<ControlTree domains={mockDomains} onSelect={mockOnSelect} />)

      // Check the content includes both code and name
      const node1 = screen.getByTestId('tree-node-domain-1')
      const node2 = screen.getByTestId('tree-node-domain-2')

      expect(node1.textContent).toContain('1.')
      expect(node2.textContent).toContain('2.')
    })

    it('should render empty state when no domains', () => {
      render(<ControlTree domains={[]} onSelect={mockOnSelect} />)

      expect(screen.getByText(/no domains/i)).toBeInTheDocument()
    })

    it('should show loading state', () => {
      render(<ControlTree domains={[]} onSelect={mockOnSelect} loading={true} />)

      expect(screen.getByTestId('tree-loading')).toBeInTheDocument()
    })
  })

  describe('Selection', () => {
    it('should call onSelect when domain is clicked', () => {
      render(<ControlTree domains={mockDomains} onSelect={mockOnSelect} />)

      const domainNode = screen.getByTestId('tree-node-domain-1')
      fireEvent.click(domainNode)

      expect(mockOnSelect).toHaveBeenCalledWith({
        type: 'domain',
        id: 1,
        name: '관리체계 수립 및 운영',
      })
    })

    it('should highlight selected domain', () => {
      render(
        <ControlTree
          domains={mockDomains}
          onSelect={mockOnSelect}
          selectedKey="domain-1"
        />
      )

      // The selected key should be set in the tree
      const tree = screen.getByRole('tree')
      expect(tree).toBeInTheDocument()

      // Check if the node has selected state
      const node = screen.getByTestId('tree-node-domain-1')
      const treeNode = node.closest('.ant-tree-treenode')
      expect(treeNode).toHaveClass('ant-tree-treenode-selected')
    })
  })

  describe('Expand/Collapse', () => {
    it('should render tree structure correctly', () => {
      render(<ControlTree domains={mockDomains} onSelect={mockOnSelect} />)

      // Tree should be rendered with folder icons
      const folderIcons = screen.getAllByRole('img', { name: /folder/i })
      expect(folderIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ControlTree domains={mockDomains} onSelect={mockOnSelect} />)

      const tree = screen.getByRole('tree')
      expect(tree).toBeInTheDocument()
      expect(tree).toHaveAttribute('aria-label', 'Control domains tree')
    })
  })
})
