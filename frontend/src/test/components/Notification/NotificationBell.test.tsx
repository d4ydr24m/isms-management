import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NotificationBell from '@/components/Notification/NotificationBell'
import { useNotificationStore } from '@/stores'

// Mock stores
vi.mock('@/stores', () => ({
  useNotificationStore: vi.fn(),
}))

const mockUseNotificationStore = useNotificationStore as unknown as ReturnType<typeof vi.fn>

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('NotificationBell', () => {
  const mockFetchNotifications = vi.fn()
  const defaultStoreState = {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    fetchNotifications: mockFetchNotifications,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNotificationStore.mockReturnValue(defaultStoreState)
  })

  describe('렌더링', () => {
    it('알림 벨 아이콘이 렌더링된다', () => {
      renderWithRouter(<NotificationBell />)

      expect(screen.getByRole('button', { name: /알림/i })).toBeInTheDocument()
    })

    it('읽지 않은 알림이 없으면 배지가 표시되지 않는다', () => {
      mockUseNotificationStore.mockReturnValue({
        ...defaultStoreState,
        unreadCount: 0,
      })

      renderWithRouter(<NotificationBell />)

      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('읽지 않은 알림 개수가 배지로 표시된다', () => {
      mockUseNotificationStore.mockReturnValue({
        ...defaultStoreState,
        unreadCount: 5,
      })

      renderWithRouter(<NotificationBell />)

      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('읽지 않은 알림이 99개 이상이면 99+로 표시된다', () => {
      mockUseNotificationStore.mockReturnValue({
        ...defaultStoreState,
        unreadCount: 150,
      })

      renderWithRouter(<NotificationBell />)

      expect(screen.getByText('99+')).toBeInTheDocument()
    })
  })

  describe('드롭다운 토글', () => {
    it('클릭 시 알림 드롭다운이 열린다', async () => {
      mockUseNotificationStore.mockReturnValue({
        ...defaultStoreState,
        notifications: [
          {
            id: 1,
            userId: 1,
            type: 'evidence_expiring',
            title: '증적 만료 예정',
            message: '증적이 7일 후 만료됩니다.',
            link: '/evidences/1',
            isRead: false,
            createdAt: '2024-01-23T10:00:00Z',
          },
        ],
        unreadCount: 1,
      })

      const user = userEvent.setup()
      renderWithRouter(<NotificationBell />)

      const bellButton = screen.getByRole('button', { name: /알림/i })
      await user.click(bellButton)

      await waitFor(() => {
        expect(screen.getByText('증적 만료 예정')).toBeInTheDocument()
      })
    })

    it('드롭다운이 열린 상태에서 다시 클릭하면 닫힌다', async () => {
      mockUseNotificationStore.mockReturnValue({
        ...defaultStoreState,
        notifications: [
          {
            id: 1,
            userId: 1,
            type: 'evidence_expiring',
            title: '증적 만료 예정',
            message: '증적이 7일 후 만료됩니다.',
            link: '/evidences/1',
            isRead: false,
            createdAt: '2024-01-23T10:00:00Z',
          },
        ],
        unreadCount: 1,
      })

      const user = userEvent.setup()
      renderWithRouter(<NotificationBell />)

      const bellButton = screen.getByRole('button', { name: /알림/i })

      // 열기
      await user.click(bellButton)
      await waitFor(() => {
        expect(screen.getByText('증적 만료 예정')).toBeInTheDocument()
      })

      // 닫기
      await user.click(bellButton)
      await waitFor(() => {
        expect(screen.queryByText('증적 만료 예정')).not.toBeInTheDocument()
      })
    })
  })

  describe('알림 로딩', () => {
    it('드롭다운이 열릴 때 알림을 가져온다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationBell />)

      const bellButton = screen.getByRole('button', { name: /알림/i })
      await user.click(bellButton)

      expect(mockFetchNotifications).toHaveBeenCalled()
    })

    it('로딩 중일 때 로딩 스피너가 표시된다', async () => {
      mockUseNotificationStore.mockReturnValue({
        ...defaultStoreState,
        isLoading: true,
      })

      const user = userEvent.setup()
      renderWithRouter(<NotificationBell />)

      const bellButton = screen.getByRole('button', { name: /알림/i })
      await user.click(bellButton)

      await waitFor(() => {
        expect(screen.getByTestId('notification-loading')).toBeInTheDocument()
      })
    })
  })

  describe('외부 클릭', () => {
    it('드롭다운 외부를 클릭하면 닫힌다', async () => {
      mockUseNotificationStore.mockReturnValue({
        ...defaultStoreState,
        notifications: [
          {
            id: 1,
            userId: 1,
            type: 'evidence_expiring',
            title: '증적 만료 예정',
            message: '증적이 7일 후 만료됩니다.',
            link: '/evidences/1',
            isRead: false,
            createdAt: '2024-01-23T10:00:00Z',
          },
        ],
      })

      const user = userEvent.setup()
      renderWithRouter(
        <div>
          <NotificationBell />
          <div data-testid="outside">외부 영역</div>
        </div>
      )

      // 드롭다운 열기
      const bellButton = screen.getByRole('button', { name: /알림/i })
      await user.click(bellButton)

      await waitFor(() => {
        expect(screen.getByText('증적 만료 예정')).toBeInTheDocument()
      })

      // 외부 클릭
      await user.click(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByText('증적 만료 예정')).not.toBeInTheDocument()
      })
    })
  })
})
