import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import UserDetail from '@/pages/Users/UserDetail'
import { userService } from '@/services/users'

vi.mock('@/services/users')

const mockUser = {
  id: 1,
  email: 'user1@example.com',
  name: 'User One',
  departmentId: 1,
  department: {
    id: 1,
    name: 'IT',
    code: 'IT',
    parentId: null,
    managerId: null,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  roles: [
    { id: 1, name: 'CISO', description: 'Chief Information Security Officer', permissions: [] },
    { id: 2, name: '보안담당자', description: 'Security Officer', permissions: [] },
  ],
  isActive: true,
  isMfaEnabled: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
}

const mockRoles = [
  { id: 1, name: 'CISO', description: 'Chief Information Security Officer', permissions: [] },
  { id: 2, name: '보안담당자', description: 'Security Officer', permissions: [] },
  { id: 3, name: '일반직원', description: 'Regular Employee', permissions: [] },
]

describe('UserDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userService.getUser).mockResolvedValue(mockUser)
    vi.mocked(userService.getRoles).mockResolvedValue(mockRoles)
  })

  it('사용자 상세 정보를 렌더링한다', async () => {
    render(
      <BrowserRouter>
        <Routes>
          <Route path="/users/:id" element={<UserDetail />} />
        </Routes>
      </BrowserRouter>,
      { initialEntries: ['/users/1'] }
    )

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
      expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      expect(screen.getByText('IT')).toBeInTheDocument()
      expect(screen.getByText('CISO')).toBeInTheDocument()
      expect(screen.getByText('보안담당자')).toBeInTheDocument()
    })
  })

  it('사용자 정보를 수정할 수 있다', async () => {
    vi.mocked(userService.updateUser).mockResolvedValue({ ...mockUser, name: 'Updated User' })
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/users/:id" element={<UserDetail />} />
        </Routes>
      </BrowserRouter>,
      { initialEntries: ['/users/1'] }
    )

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /수정/i })
    await user.click(editButton)

    const nameInput = screen.getByLabelText(/이름/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated User')

    const saveButton = screen.getByRole('button', { name: /저장/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(userService.updateUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Updated User' })
      )
    })
  })

  it('사용자 역할을 추가할 수 있다', async () => {
    vi.mocked(userService.assignRoles).mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/users/:id" element={<UserDetail />} />
        </Routes>
      </BrowserRouter>,
      { initialEntries: ['/users/1'] }
    )

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    const addRoleButton = screen.getByRole('button', { name: /역할 추가/i })
    await user.click(addRoleButton)

    const roleSelect = screen.getByLabelText(/역할 선택/i)
    await user.click(roleSelect)

    const roleOption = screen.getByText('일반직원')
    await user.click(roleOption)

    const confirmButton = screen.getByRole('button', { name: /확인/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(userService.assignRoles).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([1, 2, 3])
      )
    })
  })

  it('사용자를 비활성화할 수 있다', async () => {
    vi.mocked(userService.updateUser).mockResolvedValue({ ...mockUser, isActive: false })
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/users/:id" element={<UserDetail />} />
        </Routes>
      </BrowserRouter>,
      { initialEntries: ['/users/1'] }
    )

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    const deactivateButton = screen.getByRole('button', { name: /비활성화/i })
    await user.click(deactivateButton)

    const confirmButton = screen.getByRole('button', { name: /확인/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(userService.updateUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ isActive: false })
      )
    })
  })
})
