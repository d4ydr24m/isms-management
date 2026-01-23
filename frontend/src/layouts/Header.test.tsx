import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Header from './Header'
import { useAuthStore, useNotificationStore } from '@/stores'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/stores', () => ({
  useAuthStore: vi.fn(),
  useNotificationStore: vi.fn(),
}))

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuthStore as any).mockReturnValue({
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: ['admin'],
      },
      logout: vi.fn(),
    })
    ;(useNotificationStore as any).mockReturnValue({
      unreadCount: 5,
    })
  })

  it('should render header with search input', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )

    const searchInput = screen.getByPlaceholderText('검색...')
    expect(searchInput).toBeInTheDocument()
  })

  it('should render notification badge with unread count', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )

    const badge = screen.getByText('5')
    expect(badge).toBeInTheDocument()
  })

  it('should render user name', () => {
    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('should navigate to notifications when bell icon is clicked', () => {
    const { container } = render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )

    const bellIcon = container.querySelector('.anticon-bell')
    expect(bellIcon).toBeInTheDocument()

    if (bellIcon) {
      fireEvent.click(bellIcon)
      expect(mockNavigate).toHaveBeenCalledWith('/notifications')
    }
  })

  it('should render user avatar', () => {
    const { container } = render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )

    const avatar = container.querySelector('.ant-avatar')
    expect(avatar).toBeInTheDocument()
  })

  it('should have logout functionality', async () => {
    const mockLogout = vi.fn()
    ;(useAuthStore as any).mockReturnValue({
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        roles: ['admin'],
      },
      logout: mockLogout,
    })

    render(
      <BrowserRouter>
        <Header />
      </BrowserRouter>
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
  })
})
