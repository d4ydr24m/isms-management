import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
      expect(screen.getByLabelText(/이름/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/비밀번호/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/역할/i)).toBeInTheDocument()
    })
  })

  it('유효한 데이터로 사용자를 생성할 수 있다', async () => {
    const newUser = {
      id: 1,
      email: 'newuser@example.com',
      name: 'New User',
      departmentId: 1,
      roles: [mockRoles[0]],
      isActive: true,
      isMfaEnabled: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }

    vi.mocked(userService.createUser).mockResolvedValue(newUser)
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/이름/i)).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText(/이름/i)
    const emailInput = screen.getByLabelText(/이메일/i)
    const passwordInput = screen.getByLabelText(/비밀번호/i)

    await user.type(nameInput, 'New User')
    await user.type(emailInput, 'newuser@example.com')
    await user.type(passwordInput, 'SecureP@ssw0rd!')

    const roleSelect = screen.getByLabelText(/역할/i)
    await user.click(roleSelect)
    const roleOption = screen.getByText('CISO')
    await user.click(roleOption)

    const submitButton = screen.getByRole('button', { name: /생성/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(userService.createUser).toHaveBeenCalledWith({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'SecureP@ssw0rd!',
        roleIds: [1],
      })
    })
  })

  it('이메일 형식 검증이 작동한다', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument()
    })

    const emailInput = screen.getByLabelText(/이메일/i)
    await user.type(emailInput, 'invalid-email')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText(/올바른 이메일 형식/i)).toBeInTheDocument()
    })
  })

  it('비밀번호 정책 검증이 작동한다', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/비밀번호/i)).toBeInTheDocument()
    })

    const passwordInput = screen.getByLabelText(/비밀번호/i)
    await user.type(passwordInput, 'weak')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText(/최소 8자/i)).toBeInTheDocument()
    })
  })

  it('필수 필드 검증이 작동한다', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/이름/i)).toBeInTheDocument()
    })

    const submitButton = screen.getByRole('button', { name: /생성/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/이름을 입력/i)).toBeInTheDocument()
      expect(screen.getByText(/이메일을 입력/i)).toBeInTheDocument()
      expect(screen.getByText(/비밀번호를 입력/i)).toBeInTheDocument()
    })
  })

  it('다중 역할 선택이 가능하다', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <UserCreate />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/역할/i)).toBeInTheDocument()
    })

    const roleSelect = screen.getByLabelText(/역할/i)
    await user.click(roleSelect)

    const role1 = screen.getByText('CISO')
    await user.click(role1)

    await user.click(roleSelect)
    const role2 = screen.getByText('보안담당자')
    await user.click(role2)

    const nameInput = screen.getByLabelText(/이름/i)
    const emailInput = screen.getByLabelText(/이메일/i)
    const passwordInput = screen.getByLabelText(/비밀번호/i)

    await user.type(nameInput, 'Multi Role User')
    await user.type(emailInput, 'multi@example.com')
    await user.type(passwordInput, 'SecureP@ssw0rd!')

    const submitButton = screen.getByRole('button', { name: /생성/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(userService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          roleIds: expect.arrayContaining([1, 2]),
        })
      )
    })
  })
})
