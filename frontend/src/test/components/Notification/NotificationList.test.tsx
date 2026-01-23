import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import NotificationList from '@/components/Notification/NotificationList'
import type { Notification, NotificationType } from '@/types'

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

describe('NotificationList', () => {
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
    {
      id: 4,
      userId: 1,
      type: 'scheduled_task_due',
      title: '정기 활동 예정',
      message: '월간 보안 점검이 예정되어 있습니다.',
      link: '/tasks/1',
      isRead: true,
      createdAt: '2024-01-20T11:00:00Z',
    },
    {
      id: 5,
      userId: 1,
      type: 'system',
      title: '시스템 공지',
      message: '시스템 점검이 예정되어 있습니다.',
      link: null,
      isRead: true,
      createdAt: '2024-01-19T08:00:00Z',
    },
  ]

  const defaultProps = {
    notifications: mockNotifications,
    isLoading: false,
    totalCount: 20,
    currentPage: 1,
    pageSize: 10,
    onNotificationClick: vi.fn(),
    onMarkAsRead: vi.fn(),
    onDelete: vi.fn(),
    onPageChange: vi.fn(),
    onFilterChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('렌더링', () => {
    it('알림 목록이 렌더링된다', () => {
      renderWithRouter(<NotificationList {...defaultProps} />)

      expect(screen.getByText('증적 만료 예정')).toBeInTheDocument()
      expect(screen.getByText('내부감사 예정')).toBeInTheDocument()
      expect(screen.getByText('부적합 사항 할당')).toBeInTheDocument()
    })

    it('필터 드롭다운이 표시된다', () => {
      renderWithRouter(<NotificationList {...defaultProps} />)

      expect(screen.getByText('전체')).toBeInTheDocument()
    })

    it('페이지네이션이 표시된다', () => {
      renderWithRouter(<NotificationList {...defaultProps} />)

      // Ant Design Pagination은 ant-pagination 클래스를 가진 ul로 렌더링됨
      const pagination = document.querySelector('.ant-pagination')
      expect(pagination).toBeInTheDocument()
    })
  })

  describe('필터링', () => {
    it('읽지 않음 필터 선택 시 onFilterChange가 호출된다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationList {...defaultProps} />)

      // 필터 드롭다운 클릭 (첫 번째 Select)
      const filterSelects = screen.getAllByRole('combobox')
      await user.click(filterSelects[0])

      // 읽지 않음 옵션 선택
      await waitFor(() => {
        const dropdown = document.querySelector('.ant-select-dropdown')
        expect(dropdown).toBeInTheDocument()
      })

      const unreadOption = await screen.findByText('읽지 않음')
      await user.click(unreadOption)

      expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ readStatus: 'unread' })
      )
    })

    it('알림 타입 필터 선택 시 onFilterChange가 호출된다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationList {...defaultProps} />)

      // 타입 필터 드롭다운 클릭 (두 번째 Select)
      const filterSelects = screen.getAllByRole('combobox')
      await user.click(filterSelects[1])

      // 드롭다운이 열릴 때까지 대기
      await waitFor(() => {
        const dropdown = document.querySelector('.ant-select-dropdown')
        expect(dropdown).toBeInTheDocument()
      })

      // 증적 만료 옵션 선택 (드롭다운에서 찾기)
      const options = document.querySelectorAll('.ant-select-item-option')
      const evidenceOption = Array.from(options).find(
        (opt) => opt.textContent === '증적 만료'
      )
      expect(evidenceOption).toBeTruthy()

      if (evidenceOption) {
        await user.click(evidenceOption)
      }

      expect(defaultProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'evidence_expiring' })
      )
    })
  })

  describe('인터랙션', () => {
    it('알림 클릭 시 onNotificationClick이 호출된다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationList {...defaultProps} />)

      const firstNotification = screen.getByText('증적 만료 예정')
      await user.click(firstNotification)

      expect(defaultProps.onNotificationClick).toHaveBeenCalledWith(1, '/evidences/1')
    })

    it('페이지 변경 시 onPageChange가 호출된다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<NotificationList {...defaultProps} />)

      // 페이지 2 버튼 클릭
      const page2Button = screen.getByTitle('2')
      await user.click(page2Button)

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(2, 10)
    })
  })

  describe('로딩 상태', () => {
    it('로딩 중일 때 스피너가 표시된다', () => {
      renderWithRouter(
        <NotificationList
          {...defaultProps}
          isLoading={true}
          notifications={[]}
        />
      )

      expect(screen.getByTestId('notification-list-loading')).toBeInTheDocument()
    })
  })

  describe('빈 상태', () => {
    it('알림이 없으면 빈 상태 메시지가 표시된다', () => {
      renderWithRouter(
        <NotificationList
          {...defaultProps}
          notifications={[]}
          totalCount={0}
        />
      )

      expect(screen.getByText('알림이 없습니다')).toBeInTheDocument()
    })

    it('필터링 결과가 없으면 필터 관련 빈 상태 메시지가 표시된다', () => {
      renderWithRouter(
        <NotificationList
          {...defaultProps}
          notifications={[]}
          totalCount={0}
          currentFilter={{ readStatus: 'unread' }}
        />
      )

      expect(screen.getByText(/조건에 맞는 알림이 없습니다/i)).toBeInTheDocument()
    })
  })

  describe('읽음/읽지않음 상태 표시', () => {
    it('읽지 않은 알림 개수가 표시된다', () => {
      renderWithRouter(<NotificationList {...defaultProps} unreadCount={2} />)

      expect(screen.getByText(/읽지 않은 알림: 2개/i)).toBeInTheDocument()
    })
  })
})
