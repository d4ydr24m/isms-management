import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('심사원 계정을 생성할 수 있다', async () => {
    const newAccount = {
      id: 3,
      username: 'auditor3',
      email: 'auditor3@example.com',
      name: 'Auditor Three',
      organization: 'Audit Firm C',
      validFrom: '2024-01-01T00:00:00Z',
      validUntil: '2024-12-31T23:59:59Z',
      scope: ['증적관리', '감사관리'],
      canDownload: true,
      isActive: true,
      createdBy: 1,
      createdByName: 'Admin',
      createdAt: '2024-01-01T00:00:00Z',
    }

    vi.mocked(auditorAccountService.createAuditorAccount).mockResolvedValue(newAccount)
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Auditor One')).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: /계정 생성/i })
    await user.click(createButton)

    // Form should appear
    const nameInput = screen.getByLabelText(/이름/i)
    const emailInput = screen.getByLabelText(/이메일/i)
    const organizationInput = screen.getByLabelText(/소속/i)

    await user.type(nameInput, 'Auditor Three')
    await user.type(emailInput, 'auditor3@example.com')
    await user.type(organizationInput, 'Audit Firm C')

    const scopeCheckbox = screen.getByLabelText(/증적관리/i)
    await user.click(scopeCheckbox)

    const downloadCheckbox = screen.getByLabelText(/다운로드 권한/i)
    await user.click(downloadCheckbox)

    const submitButton = screen.getByRole('button', { name: /확인/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(auditorAccountService.createAuditorAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Auditor Three',
          email: 'auditor3@example.com',
          organization: 'Audit Firm C',
          canDownload: true,
        })
      )
    })
  })

  it('유효기간을 설정할 수 있다', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Auditor One')).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: /계정 생성/i })
    await user.click(createButton)

    const validFromInput = screen.getByLabelText(/시작일/i)
    const validUntilInput = screen.getByLabelText(/종료일/i)

    await user.type(validFromInput, '2024-01-01')
    await user.type(validUntilInput, '2024-12-31')

    // Verify date inputs are set
    expect(validFromInput).toHaveValue('2024-01-01')
    expect(validUntilInput).toHaveValue('2024-12-31')
  })

  it('접근 범위를 지정할 수 있다', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Auditor One')).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: /계정 생성/i })
    await user.click(createButton)

    const evidenceScope = screen.getByLabelText(/증적관리/i)
    const auditScope = screen.getByLabelText(/감사관리/i)

    await user.click(evidenceScope)
    await user.click(auditScope)

    expect(evidenceScope).toBeChecked()
    expect(auditScope).toBeChecked()
  })

  it('심사원 계정을 수정할 수 있다', async () => {
    const updatedAccount = { ...mockAuditorAccounts.items[0], canDownload: false }
    vi.mocked(auditorAccountService.updateAuditorAccount).mockResolvedValue(updatedAccount)
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Auditor One')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /수정/i })
    await user.click(editButtons[0])

    const downloadCheckbox = screen.getByLabelText(/다운로드 권한/i)
    await user.click(downloadCheckbox)

    const saveButton = screen.getByRole('button', { name: /저장/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(auditorAccountService.updateAuditorAccount).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ canDownload: false })
      )
    })
  })

  it('심사원 계정을 만료시킬 수 있다', async () => {
    vi.mocked(auditorAccountService.deleteAuditorAccount).mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Auditor One')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /만료/i })
    await user.click(deleteButtons[0])

    const confirmButton = screen.getByRole('button', { name: /확인/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(auditorAccountService.deleteAuditorAccount).toHaveBeenCalledWith(1)
    })
  })

  it('활성/만료 상태를 표시한다', async () => {
    render(
      <BrowserRouter>
        <AuditorAccounts />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Auditor One')).toBeInTheDocument()
    })

    // Check for status badges
    const activeBadges = screen.getAllByText(/활성/i)
    const inactiveBadges = screen.getAllByText(/만료|비활성/i)

    expect(activeBadges.length).toBeGreaterThan(0)
    expect(inactiveBadges.length).toBeGreaterThan(0)
  })
})
