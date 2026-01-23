import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('should render active status', () => {
    render(<StatusBadge status="active" />)

    const badge = screen.getByText('Active')
    expect(badge).toBeInTheDocument()
  })

  it('should render inactive status', () => {
    render(<StatusBadge status="inactive" />)

    const badge = screen.getByText('Inactive')
    expect(badge).toBeInTheDocument()
  })

  it('should render pending status', () => {
    render(<StatusBadge status="pending" />)

    const badge = screen.getByText('Pending')
    expect(badge).toBeInTheDocument()
  })

  it('should render completed status', () => {
    render(<StatusBadge status="completed" />)

    const badge = screen.getByText('Completed')
    expect(badge).toBeInTheDocument()
  })

  it('should render failed status', () => {
    render(<StatusBadge status="failed" />)

    const badge = screen.getByText('Failed')
    expect(badge).toBeInTheDocument()
  })

  it('should render draft status', () => {
    render(<StatusBadge status="draft" />)

    const badge = screen.getByText('Draft')
    expect(badge).toBeInTheDocument()
  })

  it('should render with custom text', () => {
    render(<StatusBadge status="active" text="Custom Active" />)

    expect(screen.getByText('Custom Active')).toBeInTheDocument()
  })

  it('should have success color for active status', () => {
    const { container } = render(<StatusBadge status="active" />)

    const badge = container.querySelector('.ant-badge-status-success')
    expect(badge).toBeInTheDocument()
  })

  it('should have default color for inactive status', () => {
    const { container } = render(<StatusBadge status="inactive" />)

    const badge = container.querySelector('.ant-badge-status-default')
    expect(badge).toBeInTheDocument()
  })

  it('should have processing color for pending status', () => {
    const { container } = render(<StatusBadge status="pending" />)

    const badge = container.querySelector('.ant-badge-status-processing')
    expect(badge).toBeInTheDocument()
  })

  it('should have success color for completed status', () => {
    const { container } = render(<StatusBadge status="completed" />)

    const badge = container.querySelector('.ant-badge-status-success')
    expect(badge).toBeInTheDocument()
  })

  it('should have error color for failed status', () => {
    const { container } = render(<StatusBadge status="failed" />)

    const badge = container.querySelector('.ant-badge-status-error')
    expect(badge).toBeInTheDocument()
  })

  it('should have warning color for draft status', () => {
    const { container } = render(<StatusBadge status="draft" />)

    const badge = container.querySelector('.ant-badge-status-warning')
    expect(badge).toBeInTheDocument()
  })
})
