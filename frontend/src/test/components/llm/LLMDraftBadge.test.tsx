import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { MemoryRouter } from 'react-router-dom'

import LLMDraftBadge from '@/components/llm/LLMDraftBadge'
import { llmCorrectiveActionService } from '@/services/llmCorrectiveActions'
import type { LLMMyDraftRow, LLMMyDraftsResponse } from '@/types'

vi.mock('@/services/llmCorrectiveActions', () => ({
  llmCorrectiveActionService: {
    listMine: vi.fn(),
    deleteSuggestion: vi.fn(),
  },
}))

const mockListMine = vi.mocked(llmCorrectiveActionService.listMine)
const mockDelete = vi.mocked(llmCorrectiveActionService.deleteSuggestion)

const renderBadge = () =>
  render(
    <MemoryRouter>
      <App>
        <LLMDraftBadge />
      </App>
    </MemoryRouter>,
  )

const makeRow = (
  id: number,
  overrides?: Partial<LLMMyDraftRow>,
): LLMMyDraftRow => ({
  id,
  nonConformityId: 100 + id,
  nonConformityTitle: `NC 제목 ${id}`,
  taskId: `task-${id}`,
  status: 'succeeded',
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  completedAt: new Date(Date.now() - 30_000).toISOString(),
  errorMessage: null,
  ...overrides,
})

const emptyResp: LLMMyDraftsResponse = { activeCount: 0, items: [] }

beforeEach(() => {
  vi.clearAllMocks()
  mockListMine.mockResolvedValue(emptyResp)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LLMDraftBadge', () => {
  it('fetches my drafts on mount', async () => {
    renderBadge()
    await waitFor(() => expect(mockListMine).toHaveBeenCalled())
  })

  it('shows a count badge when active drafts exist', async () => {
    mockListMine.mockResolvedValue({
      activeCount: 3,
      items: [
        makeRow(1, { status: 'running' }),
        makeRow(2, { status: 'pending' }),
        makeRow(3, { status: 'pending' }),
      ],
    })
    renderBadge()
    // antd Badge 는 sup 요소에 숫자를 렌더한다.
    await waitFor(() =>
      expect(screen.getByTitle('3')).toBeInTheDocument(),
    )
  })

  it('opens a popover with the list of drafts when clicked', async () => {
    const user = userEvent.setup()
    mockListMine.mockResolvedValue({
      activeCount: 1,
      items: [
        makeRow(5, { status: 'running', nonConformityTitle: '중복 로그인 미흡' }),
        makeRow(6, { status: 'succeeded', nonConformityTitle: 'MFA 미적용' }),
      ],
    })
    renderBadge()
    await waitFor(() => expect(mockListMine).toHaveBeenCalled())

    await user.click(screen.getByLabelText('AI 초안 현황 열기'))

    // 팝오버가 열리면 두 NC 제목이 보여야 한다.
    await waitFor(() =>
      expect(screen.getByText('중복 로그인 미흡')).toBeInTheDocument(),
    )
    expect(screen.getByText('MFA 미적용')).toBeInTheDocument()
    // 상태 태그도 노출된다.
    expect(screen.getByText('생성 중')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('shows an empty hint when no drafts exist', async () => {
    const user = userEvent.setup()
    renderBadge()
    await waitFor(() => expect(mockListMine).toHaveBeenCalled())

    await user.click(screen.getByLabelText('AI 초안 현황 열기'))
    await waitFor(() =>
      expect(
        screen.getByText('최근 생성 기록이 없습니다'),
      ).toBeInTheDocument(),
    )
  })

  it('toasts success when a previously-active row transitions to succeeded', async () => {
    // 첫 폴링: running. 두 번째 폴링: succeeded. 토스트가 한 번 떠야 한다.
    // 'activeCount>0 → 5초 폴링' 스케줄을 타려면 fake timers 로 시간을 진행시킨다.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockListMine
      .mockResolvedValueOnce({
        activeCount: 1,
        items: [
          makeRow(9, { status: 'running', nonConformityTitle: '테스트 NC' }),
        ],
      })
      .mockResolvedValue({
        activeCount: 0,
        items: [
          makeRow(9, {
            status: 'succeeded',
            nonConformityTitle: '테스트 NC',
          }),
        ],
      })

    renderBadge()
    // 첫 즉시-fetch
    await vi.waitFor(() => expect(mockListMine).toHaveBeenCalledTimes(1))
    // active 상태에서의 다음 tick (5초) 을 진행시켜 두 번째 폴링 유도.
    // 2번째 호출 이상이면 충분 — 정확한 호출 횟수는 tick drift 로 흔들릴 수 있다.
    await vi.advanceTimersByTimeAsync(5_500)
    await vi.waitFor(() =>
      expect(mockListMine.mock.calls.length).toBeGreaterThanOrEqual(2),
    )

    // antd message 토스트가 NC 제목을 포함하여 노출.
    await vi.waitFor(() =>
      expect(screen.getByText(/AI 초안 생성 완료/)).toBeInTheDocument(),
    )
  })

  it('deletes a draft from the popover when user confirms', async () => {
    const user = userEvent.setup()
    mockListMine.mockResolvedValue({
      activeCount: 0,
      items: [
        makeRow(11, {
          status: 'succeeded',
          nonConformityTitle: '삭제 대상',
        }),
      ],
    })
    mockDelete.mockResolvedValue(undefined)

    renderBadge()
    await waitFor(() => expect(mockListMine).toHaveBeenCalled())
    await user.click(screen.getByLabelText('AI 초안 현황 열기'))

    // 팝오버가 열리면 삭제 버튼이 보여야 한다 (aria-label 로 조회).
    await waitFor(() =>
      expect(
        screen.getByLabelText('삭제 대상 초안 삭제'),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByLabelText('삭제 대상 초안 삭제'))
    // Popconfirm '삭제' 버튼 클릭.
    await user.click(await screen.findByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(11))
  })

  it('does not show a delete button for active (pending/running) rows', async () => {
    const user = userEvent.setup()
    mockListMine.mockResolvedValue({
      activeCount: 1,
      items: [
        makeRow(22, {
          status: 'running',
          nonConformityTitle: '진행 중',
        }),
      ],
    })
    renderBadge()
    await waitFor(() => expect(mockListMine).toHaveBeenCalled())
    await user.click(screen.getByLabelText('AI 초안 현황 열기'))

    await waitFor(() => expect(screen.getByText('진행 중')).toBeInTheDocument())
    // 진행 중 건은 삭제 버튼이 없어야 한다.
    expect(
      screen.queryByLabelText('진행 중 초안 삭제'),
    ).not.toBeInTheDocument()
  })

  it('optimistically bumps activeCount when another component emits "created"', async () => {
    // 초기 상태: 활성 0.
    // 이벤트 수신 후 실행될 후속 poll 은 서버가 실제로 1건 활성임을 응답하는 상황을 모사.
    mockListMine
      .mockResolvedValueOnce({ activeCount: 0, items: [] })
      .mockResolvedValue({
        activeCount: 1,
        items: [makeRow(1, { status: 'pending', nonConformityTitle: '새 초안' })],
      })
    renderBadge()
    await waitFor(() => expect(mockListMine).toHaveBeenCalledTimes(1))

    // 다른 컴포넌트가 초안 생성 직후 이벤트를 쏜다.
    window.dispatchEvent(
      new CustomEvent('llm-draft-changed', { detail: { kind: 'created' } }),
    )

    // 배지의 활성 카운트가 1 로 보여야 한다 (낙관적 즉시 반영 + 서버 응답 보정).
    await waitFor(() => expect(screen.getByTitle('1')).toBeInTheDocument())
  })
})
