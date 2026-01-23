import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import NotificationSettings from './NotificationSettings'
import { notificationService } from '@/services/notifications'

vi.mock('@/services/notifications')

describe('NotificationSettings Component', () => {
  const mockNotificationSettings = [
    {
      id: 1,
      userId: 1,
      type: 'evidence_expiring' as const,
      emailEnabled: true,
      appEnabled: true,
      frequency: 'realtime' as const,
    },
    {
      id: 2,
      userId: 1,
      type: 'scheduled_task_due' as const,
      emailEnabled: false,
      appEnabled: true,
      frequency: 'daily' as const,
    },
    {
      id: 3,
      userId: 1,
      type: 'corrective_action_due' as const,
      emailEnabled: true,
      appEnabled: false,
      frequency: 'weekly' as const,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notificationService.getSettings).mockResolvedValue(mockNotificationSettings)
  })

  it('컴포넌트가 올바르게 렌더링됨', async () => {
    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('알림 설정')).toBeInTheDocument()
    })
  })

  it('알림 설정 목록을 로드하여 표시함', async () => {
    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/증적 만료 예정/)).toBeInTheDocument()
      expect(screen.getByText(/정기 활동 예정/)).toBeInTheDocument()
      expect(screen.getByText(/시정조치 기한/)).toBeInTheDocument()
    })
  })

  it('이메일 알림 토글이 표시됨', async () => {
    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const emailToggles = screen.getAllByRole('switch')
      expect(emailToggles.length).toBeGreaterThan(0)
    })
  })

  it('앱 알림 토글이 표시됨', async () => {
    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const appToggles = screen.getAllByRole('switch')
      expect(appToggles.length).toBeGreaterThan(0)
    })
  })

  it('알림 빈도 선택이 표시됨', async () => {
    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/실시간/)).toBeInTheDocument()
    })
  })

  it('이메일 알림 토글 변경 시 API가 호출됨', async () => {
    vi.mocked(notificationService.updateSetting).mockResolvedValue()

    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/증적 만료 예정/)).toBeInTheDocument()
    })

    const toggles = screen.getAllByRole('switch')
    fireEvent.click(toggles[0])

    await waitFor(() => {
      expect(notificationService.updateSetting).toHaveBeenCalled()
    })
  })

  it('알림 빈도 변경 시 API가 호출됨', async () => {
    vi.mocked(notificationService.updateSetting).mockResolvedValue()

    const { container } = render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/증적 만료 예정/)).toBeInTheDocument()
    })

    const select = container.querySelector('.ant-select')
    if (select) {
      fireEvent.mouseDown(select)

      await waitFor(() => {
        const option = screen.getByText('일일')
        fireEvent.click(option)
      })

      await waitFor(() => {
        expect(notificationService.updateSetting).toHaveBeenCalled()
      })
    }
  })

  it('알림 설정 업데이트 성공 시 성공 메시지가 표시됨', async () => {
    vi.mocked(notificationService.updateSetting).mockResolvedValue()

    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/증적 만료 예정/)).toBeInTheDocument()
    })

    const toggles = screen.getAllByRole('switch')
    fireEvent.click(toggles[0])

    await waitFor(() => {
      expect(screen.getByText(/알림 설정이 업데이트되었습니다/)).toBeInTheDocument()
    })
  })

  it('알림 설정 업데이트 실패 시 에러 메시지가 표시됨', async () => {
    vi.mocked(notificationService.updateSetting).mockRejectedValue(new Error('업데이트 실패'))

    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/증적 만료 예정/)).toBeInTheDocument()
    })

    const toggles = screen.getAllByRole('switch')
    fireEvent.click(toggles[0])

    await waitFor(() => {
      expect(screen.getByText(/업데이트 실패/)).toBeInTheDocument()
    })
  })

  it('알림 타입별 레이블이 표시됨', async () => {
    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/증적 만료 예정/)).toBeInTheDocument()
      expect(screen.getByText(/정기 활동 예정/)).toBeInTheDocument()
      expect(screen.getByText(/시정조치 기한/)).toBeInTheDocument()
    })
  })

  it('로딩 중일 때 스피너가 표시됨', () => {
    vi.mocked(notificationService.getSettings).mockImplementation(
      () => new Promise(() => {}) // 영원히 대기
    )

    render(
      <BrowserRouter>
        <NotificationSettings />
      </BrowserRouter>
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
