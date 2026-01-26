import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import SecuritySettings from './SecuritySettings'
import { settingsService } from '@/services/settings'

vi.mock('@/services/settings')

describe('SecuritySettings Component', () => {
  const mockSecuritySettings = {
    isMfaEnabled: false,
    lastPasswordChange: '2025-01-01',
    sessionTimeout: 30,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(settingsService.getSecuritySettings).mockResolvedValue(mockSecuritySettings)
  })

  it('컴포넌트가 올바르게 렌더링됨', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('보안 설정')).toBeInTheDocument()
    })
  })

  it('보안 설정 정보를 로드하여 표시함', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/2단계 인증/).length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: '비밀번호 변경' })).toBeInTheDocument()
    })
  })

  it('2FA가 비활성화되어 있을 때 활성화 버튼이 표시됨', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '활성화' })).toBeInTheDocument()
    })
  })

  it('2FA가 활성화되어 있을 때 비활성화 버튼이 표시됨', async () => {
    vi.mocked(settingsService.getSecuritySettings).mockResolvedValue({
      ...mockSecuritySettings,
      isMfaEnabled: true,
    })

    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '비활성화' })).toBeInTheDocument()
    })
  })

  it('비밀번호 변경 버튼이 표시됨', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const button = screen.getByRole('button', { name: '비밀번호 변경' })
      expect(button).toBeInTheDocument()
    })
  })

  it('마지막 비밀번호 변경 날짜가 표시됨', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/마지막 비밀번호 변경: 2025-01-01/)).toBeInTheDocument()
    })
  })

  it('로딩 중일 때 스피너가 표시됨', () => {
    vi.mocked(settingsService.getSecuritySettings).mockImplementation(
      () => new Promise(() => {}) // 영원히 대기
    )

    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('보안 설정 API를 호출한다', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(settingsService.getSecuritySettings).toHaveBeenCalled()
    })
  })
})
