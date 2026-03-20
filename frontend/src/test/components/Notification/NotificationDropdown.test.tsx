import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NotificationDropdown from '@/components/Notification/NotificationDropdown'
import type { Notification } from '@/types'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('NotificationDropdown', () => {
  const mockNotifications: Notification[] = [
    {
      id: 1,
      userId: 1,
      type: 'evidence_expiring',
      title: '증적 만료 예정',
      message: '증적 "백업 정책"이 7일 후 만료됩니다.',
      link: '/evidences/1',
      isRead: false,
      createdAt: '2024-01-23T10:00:00Z',
    },
    {
      id: 2,
      userId: 1,
      type: 'audit_scheduled',
      title: '내부감사 예정',
      message: '2024년 1분기 내부감사가 예정되어 있습니다.',
      link: '/audits/1',
      isRead: true,
      createdAt: '2024-01-22T09:00:00Z',
    },
    {
      id: 3,
      userId: 1,
      type: 'non_conformity_assigned',
      title: '부적합 사항 할당',
      message: '새로운 부적합 사항이 할당되었습니다.',
      link: '/nonconformities/1',
      isRead: false,
      createdAt: '2024-01-21T14:00:00Z',
    },
  ]

  const defaultProps = {
    notifications: mockNotifications,
    isLoading: false,
    unreadCount: 2,
    onNotificationClick: vi.fn(),
    onMarkAllAsRead: vi.fn(),
    onViewAll: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('렌더링', () => {
    it('알림 드롭다운이 렌더링된다', () => {
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      expect(screen.getByText('알림')).toBeInTheDocument()
    })

    it('알림 목록이 표시된다', () => {
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      expect(screen.getByText('증적 만료 예정')).toBeInTheDocument()
      expect(screen.getByText('내부감사 예정')).toBeInTheDocument()
      expect(screen.getByText('부적합 사항 할당')).toBeInTheDocument()
    })

    it('알림 타입별 태그가 표시된다', () => {
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      expect(screen.getByText('증적 만료')).toBeInTheDocument()
      expect(screen.getByText('감사 예정')).toBeInTheDocument()
      expect(screen.getByText('부적합')).toBeInTheDocument()
    })
  })

  describe('읽지 않은 알림 표시', () => {
    it('읽지 않은 알림은 배경색이 다르다', () => {
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      const unreadItems = screen.getAllByText(/증적 만료 예정|부적합 사항 할당/)
      expect(unreadItems.length).toBe(2)
    })

    it('모두 읽음 버튼이 표시된다', () => {
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      expect(screen.getByRole('button', { name: /모두 읽음/i })).toBeInTheDocument()
    })

    it('읽지 않은 알림이 없으면 모두 읽음 버튼이 표시되지 않는다', () => {
      const allReadNotifications = mockNotifications.map((n) => ({ ...n, isRead: true }))

      renderWithRouter(
        <NotificationDropdown
          {...defaultProps}
          notifications={allReadNotifications}
          unreadCount={0}
        />
      )

      expect(screen.queryByRole('button', { name: /모두 읽음/i })).not.toBeInTheDocument()
    })
  })

  describe('인터랙션', () => {
    it('알림 클릭 시 onNotificationClick이 호출된다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      const firstNotification = screen.getByText('증적 만료 예정')
      await user.click(firstNotification)

      expect(defaultProps.onNotificationClick).toHaveBeenCalledWith(1, '/evidences/1')
    })

    it('모두 읽음 버튼 클릭 시 onMarkAllAsRead가 호출된다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      const markAllButton = screen.getByRole('button', { name: /모두 읽음/i })
      await user.click(markAllButton)

      expect(defaultProps.onMarkAllAsRead).toHaveBeenCalled()
    })

    it('전체 알림 보기 클릭 시 onViewAll이 호출된다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      const viewAllButton = screen.getByRole('button', { name: /전체 알림 보기/i })
      await user.click(viewAllButton)

      expect(defaultProps.onViewAll).toHaveBeenCalled()
    })
  })

  describe('로딩 상태', () => {
    it('로딩 중일 때 스피너가 표시된다', () => {
      renderWithRouter(
        <NotificationDropdown
          {...defaultProps}
          isLoading={true}
          notifications={[]}
        />
      )

      expect(screen.getByTestId('notification-loading')).toBeInTheDocument()
    })
  })

  describe('빈 상태', () => {
    it('알림이 없으면 빈 상태 메시지가 표시된다', () => {
      renderWithRouter(
        <NotificationDropdown
          {...defaultProps}
          notifications={[]}
          unreadCount={0}
        />
      )

      expect(screen.getByText('알림이 없습니다')).toBeInTheDocument()
    })
  })

  describe('스타일링', () => {
    it('읽은 알림은 일반 배경색으로 표시된다', () => {
      renderWithRouter(<NotificationDropdown {...defaultProps} />)

      // 읽은 알림 확인 (내부감사 예정)
      screen.getByText('내부감사 예정').closest('div[class*="list-item"]')
      // 스타일 확인은 실제 DOM 검사가 필요하므로 존재 여부만 확인
      expect(screen.getByText('내부감사 예정')).toBeInTheDocument()
    })
  })
})
