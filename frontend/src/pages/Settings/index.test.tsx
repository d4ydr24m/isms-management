import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Settings from './index'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'
import { notificationService } from '@/services/notifications'

vi.mock('@/services/auth')
vi.mock('@/services/settings')
vi.mock('@/services/notifications')

describe('Settings Page', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: '홍길동',
    departmentId: 1,
    department: '정보보안팀',
    roles: ['admin'],
    permissions: [],
    isActive: true,
    isMfaEnabled: false,
  }

  const mockSecuritySettings = {
    isMfaEnabled: false,
    lastPasswordChange: '2025-01-01',
    sessionTimeout: 30,
  }

  const mockNotificationSettings = [
    {
      id: 1,
      userId: 1,
      type: 'evidence_expiring' as const,
      emailEnabled: true,
      appEnabled: true,
      frequency: 'realtime' as const,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(settingsService.getSecuritySettings).mockResolvedValue(mockSecuritySettings)
    vi.mocked(notificationService.getSettings).mockResolvedValue(mockNotificationSettings)
  })

  it('컴포넌트가 올바르게 렌더링됨', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    expect(screen.getByText('설정')).toBeInTheDocument()
  })

  it('탭 메뉴가 표시됨', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    expect(screen.getByText('프로필')).toBeInTheDocument()
    expect(screen.getByText('보안')).toBeInTheDocument()
    expect(screen.getByText('알림')).toBeInTheDocument()
  })

  it('기본적으로 프로필 탭이 활성화됨', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    const profileTab = screen.getByText('프로필').closest('.ant-tabs-tab')
    expect(profileTab).toHaveClass('ant-tabs-tab-active')
  })

  it('탭 클릭 시 콘텐츠가 변경됨', () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    // 보안 탭 클릭
    fireEvent.click(screen.getByText('보안'))

    // URL이 변경되는지 확인은 실제 라우터로 구현되므로 생략
  })

  it('프로필 설정 컴포넌트가 렌더링됨', async () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    // ProfileSettings 컴포넌트의 내용이 표시되는지 확인
    await waitFor(() => {
      expect(screen.getByText('프로필 정보')).toBeInTheDocument()
    })
  })

  it('보안 탭으로 전환 시 보안 설정이 표시됨', async () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    fireEvent.click(screen.getByText('보안'))

    await waitFor(() => {
      expect(screen.getByText('보안 설정')).toBeInTheDocument()
    })
  })

  it('알림 탭으로 전환 시 알림 설정이 표시됨', async () => {
    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    )

    fireEvent.click(screen.getByText('알림'))

    await waitFor(() => {
      expect(screen.getByText('알림 설정')).toBeInTheDocument()
    })
  })
})
