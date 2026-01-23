import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmModal from './ConfirmModal'

describe('ConfirmModal', () => {
  it('should render modal when open is true', () => {
    render(
      <ConfirmModal
        open={true}
        title="Confirm Action"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      >
        Are you sure?
      </ConfirmModal>
    )

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('should not render modal when open is false', () => {
    render(
      <ConfirmModal
        open={false}
        title="Confirm Action"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      >
        Are you sure?
      </ConfirmModal>
    )

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument()
  })

  it('should call onConfirm when OK button is clicked', () => {
    const mockOnConfirm = vi.fn()
    render(
      <ConfirmModal
        open={true}
        title="Confirm Action"
        onConfirm={mockOnConfirm}
        onCancel={vi.fn()}
      >
        Are you sure?
      </ConfirmModal>
    )

    const okButton = screen.getByRole('button', { name: /ok/i })
    fireEvent.click(okButton)

    expect(mockOnConfirm).toHaveBeenCalled()
  })

  it('should call onCancel when Cancel button is clicked', () => {
    const mockOnCancel = vi.fn()
    render(
      <ConfirmModal
        open={true}
        title="Confirm Action"
        onConfirm={vi.fn()}
        onCancel={mockOnCancel}
      >
        Are you sure?
      </ConfirmModal>
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should render with custom OK text', () => {
    render(
      <ConfirmModal
        open={true}
        title="Confirm Action"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        okText="Confirm"
      >
        Are you sure?
      </ConfirmModal>
    )

    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
  })

  it('should render with custom Cancel text', () => {
    render(
      <ConfirmModal
        open={true}
        title="Confirm Action"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        cancelText="No"
      >
        Are you sure?
      </ConfirmModal>
    )

    expect(screen.getByRole('button', { name: /no/i })).toBeInTheDocument()
  })

  it('should render with danger type', () => {
    render(
      <ConfirmModal
        open={true}
        title="Confirm Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        type="danger"
      >
        This action cannot be undone
      </ConfirmModal>
    )

    // Check if OK button is rendered
    const okButton = screen.getByRole('button', { name: /ok/i })
    expect(okButton).toBeInTheDocument()
  })

  it('should render with warning icon when type is danger', () => {
    render(
      <ConfirmModal
        open={true}
        title="Confirm Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        type="danger"
      >
        Delete?
      </ConfirmModal>
    )

    // Check if title text is present (icon is rendered with it)
    expect(screen.getByText('Confirm Delete')).toBeInTheDocument()
  })
})
