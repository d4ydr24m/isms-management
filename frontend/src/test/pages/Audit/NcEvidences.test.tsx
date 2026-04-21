import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router-dom'

import NcEvidences from '@/pages/Audit/NcEvidences'
import { auditService } from '@/services/audits'
import type { NcEvidenceListPage, NcEvidenceRow } from '@/types'

const renderPage = (initialEntries: string[] = ['/nc-evidences']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <App>
        <NcEvidences />
      </App>
    </MemoryRouter>,
  )

vi.mock('@/services/audits', () => ({
  auditService: {
    listAllNcEvidences: vi.fn(),
  },
}))

const mockList = vi.mocked(auditService.listAllNcEvidences)

const makeRow = (
  mappingId: number,
  ncId: number,
  overrides?: Partial<NcEvidenceRow>,
): NcEvidenceRow => ({
  mappingId,
  evidenceId: 1000 + mappingId,
  title: `증적 ${mappingId}`,
  fileName: `file${mappingId}.png`,
  fileSize: 1024,
  mimeType: 'image/png',
  mappingNote: null,
  role: 'reference',
  mappedBy: 1,
  mappedAt: '2026-04-20T10:00:00Z',
  uploaderName: 'admin',
  nonConformityId: ncId,
  nonConformityTitle: `NC 제목 ${ncId}`,
  ...overrides,
})

const emptyPage: NcEvidenceListPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue(emptyPage)
})

describe('NcEvidencesPage', () => {
  it('fetches the cross-NC evidence list on mount', async () => {
    renderPage()
    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        nonConformityId: undefined,
        search: undefined,
      }),
    )
  })

  it('renders rows with NC title and file name', async () => {
    mockList.mockResolvedValueOnce({
      ...emptyPage,
      items: [makeRow(1, 42), makeRow(2, 99)],
      total: 2,
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('증적 1')).toBeInTheDocument(),
    )
    expect(screen.getByText('file2.png')).toBeInTheDocument()
    expect(screen.getByText('NC 제목 42')).toBeInTheDocument()
  })

  it('reads nonConformityId from the URL query and passes it to the service', async () => {
    renderPage(['/nc-evidences?ncId=77'])
    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ nonConformityId: 77 }),
      ),
    )
  })

  it('passes the search term from the URL to the service', async () => {
    renderPage(['/nc-evidences?q=auth'])
    await waitFor(() =>
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'auth' }),
      ),
    )
  })

  it('shows an error message when the list fetch fails', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    await waitFor(() =>
      expect(
        screen.getByText('결함 증적 목록을 불러오지 못했습니다.'),
      ).toBeInTheDocument(),
    )
  })

  it('updates the URL with the search term when user searches', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(mockList).toHaveBeenCalled())

    const searchBox = screen.getByPlaceholderText('증적 제목 또는 파일명 검색')
    await user.type(searchBox, 'abc')
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'abc', page: 1 }),
      ),
    )
  })
})
