import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import MainLayout from './MainLayout'
import { useAuthStore } from '@/stores'

// Mock stores
vi.mock('@/stores', () => ({
  useAuthStore: vi.fn(),
}))

// Mock child components
vi.mock('./Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}))

vi.mock('./Header', () => ({
  default: () => <div data-testid="header">Header</div>,
}))

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuthStore as any).mockReturnValue({
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: ['admin'],
      },
      isAuthenticated: true,
    })
  })

  it('should render MainLayout with sidebar and header', () => {
    render(
      <BrowserRouter>
        <MainLayout>
          <div>Test Content</div>
        </MainLayout>
      </BrowserRouter>
    )

    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render children content', () => {
    render(
      <BrowserRouter>
        <MainLayout>
          <div data-testid="child-content">Child Component</div>
        </MainLayout>
      </BrowserRouter>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('should have correct layout structure', () => {
    render(
      <BrowserRouter>
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      </BrowserRouter>
    )

    // Check for sidebar and header components
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should apply correct content padding', () => {
    const { container } = render(
      <BrowserRouter>
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      </BrowserRouter>
    )

    const content = container.querySelector('.ant-layout-content')
    expect(content).toBeInTheDocument()
  })
})
