import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import UserCreate from '@/pages/Users/UserCreate'
import { userService } from '@/services/users'

vi.mock('@/services/users')

const mockRoles = [
  { id: 1, name: 'CISO', description: 'Chief Information Security Officer', permissions: [] },
  { id: 2, name: '보안담당자', description: 'Security Officer', permissions: [] },
  { id: 3, name: '일반직원', description: 'Regular Employee', permissions: [] },
]

describe('UserCreate Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userService.getRoles).mockResolvedValue(mockRoles)
  })

  it('사용자 생성 폼을 렌더링한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('이름')).toBeInTheDocument()
      expect(screen.getByText('이메일')).toBeInTheDocument()
      expect(screen.getByText('비밀번호')).toBeInTheDocument()
      expect(screen.getByText('역할')).toBeInTheDocument()
    })
  })

  it('입력 필드가 존재한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText('홍길동')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('비밀번호')).toBeInTheDocument()
    })
  })

  it('역할 목록을 로드한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(userService.getRoles).toHaveBeenCalled()
    })
  })

  it('생성 버튼이 존재한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /생성/i })).toBeInTheDocument()
    })
  })

  it('취소 버튼이 존재한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /취소/i })).toBeInTheDocument()
    })
  })

  it('목록으로 버튼이 존재한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /목록으로/i })).toBeInTheDocument()
    })
  })

  it('비밀번호 확인 필드가 존재한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('비밀번호 확인')).toBeInTheDocument()
    })
  })

  it('부서 ID 필드가 존재한다', async () => {
    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('부서')).toBeInTheDocument()
    })
  })
})
