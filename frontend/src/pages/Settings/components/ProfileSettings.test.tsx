import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import ProfileSettings from './ProfileSettings'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'

vi.mock('@/services/auth')
vi.mock('@/services/settings')

describe('ProfileSettings Component', () => {
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

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser)
  })

  it('컴포넌트가 올바르게 렌더링됨', async () => {
    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('프로필 정보')).toBeInTheDocument()
    })
  })

  it('사용자 정보를 로드하여 표시함', async () => {
    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument()
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
    })
  })

  it('이메일 필드는 비활성화됨', async () => {
    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const emailInput = screen.getByDisplayValue('test@example.com')
      expect(emailInput).toBeDisabled()
    })
  })

  it('이름 필드를 수정할 수 있음', async () => {
    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('홍길동')
      expect(nameInput).not.toBeDisabled()
    })
  })

  it('저장 버튼이 표시됨', async () => {
    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: '저장' })
      expect(saveButton).toBeInTheDocument()
    })
  })

  it('프로필 업데이트 시 API가 호출됨', async () => {
    vi.mocked(settingsService.updateProfile).mockResolvedValue()

    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('홍길동')
    fireEvent.change(nameInput, { target: { value: '김철수' } })

    const saveButton = screen.getByRole('button', { name: '저장' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(settingsService.updateProfile).toHaveBeenCalledWith({
        name: '김철수',
        departmentId: 1,
      })
    })
  })

  it('프로필 업데이트 성공 시 성공 메시지가 표시됨', async () => {
    vi.mocked(settingsService.updateProfile).mockResolvedValue()

    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: '저장' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('프로필이 성공적으로 업데이트되었습니다')).toBeInTheDocument()
    })
  })

  it('프로필 업데이트 실패 시 에러 메시지가 표시됨', async () => {
    vi.mocked(settingsService.updateProfile).mockRejectedValue(new Error('업데이트 실패'))

    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: '저장' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/업데이트 실패/)).toBeInTheDocument()
    })
  })

  it('로딩 중일 때 스피너가 표시됨', () => {
    vi.mocked(authService.getCurrentUser).mockImplementation(
      () => new Promise(() => {}) // 영원히 대기
    )

    render(
      <BrowserRouter>
        <ProfileSettings />
      </BrowserRouter>
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
