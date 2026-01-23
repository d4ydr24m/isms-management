import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import SecuritySettings from './SecuritySettings'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'

vi.mock('@/services/auth')
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

  it('2FA 활성화 버튼 클릭 시 모달이 열림', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '활성화' })).toBeInTheDocument()
    })

    const enableButton = screen.getByRole('button', { name: '활성화' })
    fireEvent.click(enableButton)

    await waitFor(() => {
      expect(screen.getByText('2단계 인증 설정')).toBeInTheDocument()
    })
  })

  it('2FA 설정 모달에 QR 코드가 표시됨', async () => {
    vi.mocked(authService.setupMfa).mockResolvedValue({
      secret: 'TEST_SECRET',
      qrCode: 'data:image/png;base64,TEST_QR',
      backupCodes: ['CODE1', 'CODE2'],
    })

    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '활성화' })).toBeInTheDocument()
    })

    const enableButton = screen.getByRole('button', { name: '활성화' })
    fireEvent.click(enableButton)

    await waitFor(() => {
      const qrImage = screen.getByAltText('QR Code')
      expect(qrImage).toBeInTheDocument()
      expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,TEST_QR')
    })
  })

  it('백업 코드가 표시됨', async () => {
    vi.mocked(authService.setupMfa).mockResolvedValue({
      secret: 'TEST_SECRET',
      qrCode: 'data:image/png;base64,TEST_QR',
      backupCodes: ['CODE1', 'CODE2', 'CODE3'],
    })

    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '활성화' })).toBeInTheDocument()
    })

    const enableButton = screen.getByRole('button', { name: '활성화' })
    fireEvent.click(enableButton)

    await waitFor(() => {
      expect(screen.getByText(/백업 코드/)).toBeInTheDocument()
      expect(screen.getByText('CODE1')).toBeInTheDocument()
      expect(screen.getByText('CODE2')).toBeInTheDocument()
      expect(screen.getByText('CODE3')).toBeInTheDocument()
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

  it('비밀번호 변경 버튼 클릭 시 모달이 열림', async () => {
    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const changePasswordButton = screen.getByRole('button', { name: '비밀번호 변경' })
      fireEvent.click(changePasswordButton)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument()
      expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument()
      expect(screen.getByLabelText('새 비밀번호 확인')).toBeInTheDocument()
    })
  })

  it('비밀번호 변경 성공 시 성공 메시지가 표시됨', async () => {
    vi.mocked(authService.changePassword).mockResolvedValue()

    render(
      <BrowserRouter>
        <SecuritySettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const changePasswordButton = screen.getByRole('button', { name: '비밀번호 변경' })
      fireEvent.click(changePasswordButton)
    })

    await waitFor(() => {
      const currentPasswordInput = screen.getByLabelText('현재 비밀번호')
      const newPasswordInput = screen.getByLabelText('새 비밀번호')
      const confirmPasswordInput = screen.getByLabelText('새 비밀번호 확인')

      fireEvent.change(currentPasswordInput, { target: { value: 'OldPassword123!' } })
      fireEvent.change(newPasswordInput, { target: { value: 'NewPassword123!' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPassword123!' } })
    })

    const submitButton = screen.getByRole('button', { name: '변경' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 성공적으로 변경되었습니다')).toBeInTheDocument()
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
})
