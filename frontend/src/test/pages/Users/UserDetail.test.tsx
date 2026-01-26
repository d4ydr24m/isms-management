import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

const renderWithRouter = () => {
  return render(
    <MemoryRouter initialEntries={['/users/1']}>
      <Routes>
        <Route path="/users/:id" element={<UserDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('UserDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userService.getUser).mockResolvedValue(mockUser)
    vi.mocked(userService.getRoles).mockResolvedValue(mockRoles)
  })

  it('사용자 상세 정보를 렌더링한다', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
      expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      expect(screen.getByText('IT')).toBeInTheDocument()
      expect(screen.getByText('CISO')).toBeInTheDocument()
      expect(screen.getByText('보안담당자')).toBeInTheDocument()
    })
  })

  it('수정 버튼 클릭 시 모달이 열린다', async () => {
    const user = userEvent.setup()

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // 수정 버튼 클릭
    const editButton = screen.getByRole('button', { name: /수정/i })
    await user.click(editButton)

    // 모달이 열리는지 확인
    await waitFor(() => {
      expect(screen.getByText('사용자 정보 수정')).toBeInTheDocument()
    })
  })

  it('역할 추가 버튼이 존재한다', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // 역할 추가 버튼이 존재하는지 확인
    const addRoleButton = screen.getByRole('button', { name: /역할 추가/i })
    expect(addRoleButton).toBeInTheDocument()
  })

  it('비활성화 버튼이 존재한다', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // 비활성화 버튼이 존재하는지 확인
    const deactivateButton = screen.getByRole('button', { name: /비활성화/i })
    expect(deactivateButton).toBeInTheDocument()
  })
})
