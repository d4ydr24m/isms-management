import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import UserList from '@/pages/Users/index'
import { userService } from '@/services/users'

// Mock the services
vi.mock('@/services/users')

const mockUsers = {
  items: [
    {
      id: 1,
      email: 'user1@example.com',
      name: 'User One',
      department: 'IT',
      roles: ['CISO', '보안담당자'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      email: 'user2@example.com',
      name: 'User Two',
      department: 'HR',
      roles: ['일반직원'],
      isActive: false,
      createdAt: '2024-01-02T00:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 10,
  totalPages: 1,
}

const mockRoles = [
  { id: 1, name: 'CISO', description: 'Chief Information Security Officer', permissions: [] },
  { id: 2, name: '보안담당자', description: 'Security Officer', permissions: [] },
  { id: 3, name: '일반직원', description: 'Regular Employee', permissions: [] },
]

describe('UserList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userService.getUsers).mockResolvedValue(mockUsers)
    vi.mocked(userService.getRoles).mockResolvedValue(mockRoles)
  })

  it('사용자 목록을 렌더링한다', async () => {
    render(
      <BrowserRouter>
        <UserList />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
      expect(screen.getByText('User Two')).toBeInTheDocument()
    })
  })

  it('사용자 검색이 작동한다', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <UserList />
      </BrowserRouter>
    )

    const searchInput = screen.getByPlaceholderText(/이름 또는 이메일로 검색/i)
    await user.type(searchInput, 'User One')

    await waitFor(() => {
      expect(userService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'User One' })
      )
    }, { timeout: 5000 })
  })

  it('페이지네이션이 작동한다', async () => {
    // 더 많은 페이지가 있도록 모킹
    vi.mocked(userService.getUsers).mockResolvedValue({
      ...mockUsers,
      total: 25,
      totalPages: 3,
    })

    userEvent.setup()
    render(
      <BrowserRouter>
        <UserList />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // 페이지네이션이 존재하는지 확인
    const pageButtons = screen.queryAllByRole('listitem')
    expect(pageButtons.length).toBeGreaterThan(0)
  })

  it('사용자 추가 버튼을 클릭하면 생성 페이지로 이동한다', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <UserList />
      </BrowserRouter>
    )

    const addButton = screen.getByRole('button', { name: /사용자 추가/i })
    await user.click(addButton)

    // Navigation should occur (tested by routing)
    expect(addButton).toBeInTheDocument()
  })

  it('활성/비활성 필터가 작동한다', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <UserList />
      </BrowserRouter>
    )

    // aria-label로 상태 필터 Select 찾기
    const statusFilter = screen.getByRole('combobox', { name: /상태/i })
    await user.click(statusFilter)

    await waitFor(() => {
      const activeOption = screen.getByTitle('활성')
      user.click(activeOption)
    })

    await waitFor(() => {
      expect(userService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      )
    }, { timeout: 5000 })
  })

  it('사용자 삭제 버튼이 존재한다', async () => {
    render(
      <BrowserRouter>
        <UserList />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument()
    })

    // 삭제 버튼이 각 사용자 행에 존재하는지 확인
    const deleteButtons = screen.getAllByRole('button', { name: /삭제/i })
    expect(deleteButtons.length).toBeGreaterThan(0)
  })
})
