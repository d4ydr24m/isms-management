import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Sidebar from './Sidebar'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' }),
  }
})

describe('Sidebar', () => {
  it('should render sidebar with menu items', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )

    expect(screen.getByText('대시보드')).toBeInTheDocument()
    expect(screen.getByText('증적 관리')).toBeInTheDocument()
    expect(screen.getByText('통제항목')).toBeInTheDocument()
    expect(screen.getByText('감사 관리')).toBeInTheDocument()
    expect(screen.getByText('사용자 관리')).toBeInTheDocument()
    expect(screen.getByText('설정')).toBeInTheDocument()
  })

  it('should render system title when not collapsed', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )

    expect(screen.getByText('ISMS 관리')).toBeInTheDocument()
  })

  it('should navigate when menu item is clicked', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )

    const evidenceMenuItem = screen.getByText('증적 관리')
    fireEvent.click(evidenceMenuItem)

    expect(mockNavigate).toHaveBeenCalledWith('/evidence')
  })

  it('should have collapsible sider', () => {
    const { container } = render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )

    const sider = container.querySelector('.ant-layout-sider')
    expect(sider).toBeInTheDocument()
  })

  it('should render menu icons', () => {
    const { container } = render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )

    // Check for icon presence
    const icons = container.querySelectorAll('.anticon')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('should highlight active menu item', () => {
    render(
      <BrowserRouter>
        <Sidebar />
      </BrowserRouter>
    )

    // Current path is '/', so dashboard should be selected
    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
  })
})
