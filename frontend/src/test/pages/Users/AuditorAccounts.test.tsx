import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import AuditorAccounts from '@/pages/Users/AuditorAccounts'
import { auditorAccountService } from '@/services/auditorAccounts'

vi.mock('@/services/auditorAccounts')

const mockAuditorAccounts = {
  items: [
    {
      id: 1,
      username: 'auditor1',
      email: 'auditor1@example.com',
      name: 'Auditor One',
      organization: 'Audit Firm A',
      validFrom: '2024-01-01T00:00:00Z',
      validUntil: '2024-12-31T23:59:59Z',
      scope: ['증적관리', '감사관리'],
      canDownload: true,
      isActive: true,
      createdBy: 1,
      createdByName: 'Admin',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      username: 'auditor2',
      email: 'auditor2@example.com',
      name: 'Auditor Two',
      organization: 'Audit Firm B',
      validFrom: '2024-01-01T00:00:00Z',
      validUntil: '2024-06-30T23:59:59Z',
      scope: ['증적관리'],
      canDownload: false,
      isActive: false,
      createdBy: 1,
      createdByName: 'Admin',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  total: 2,
  page: 1,
  pageSize: 10,
  totalPages: 1,
}

describe('AuditorAccounts Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auditorAccountService.getAuditorAccounts).mockResolvedValue(mockAuditorAccounts)
  })

  it('심사원 계정 목록을 렌더링한다', async () => {
    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Auditor One')).toBeInTheDocument()
      expect(screen.getByText('Auditor Two')).toBeInTheDocument()
      expect(screen.getByText('Audit Firm A')).toBeInTheDocument()
    })
  })

  it('계정 생성 버튼이 존재한다', async () => {
    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /계정 생성/i })).toBeInTheDocument()
    })
  })

  it('검색 입력 필드가 존재한다', async () => {
    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/이름 또는 소속으로 검색/i)).toBeInTheDocument()
    })
  })

  it('API를 호출하여 데이터를 로드한다', async () => {
    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(auditorAccountService.getAuditorAccounts).toHaveBeenCalled()
    })
  })
})
