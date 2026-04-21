import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'

import CorrectiveActionAssistant, {
  type AssistantEvidence,
} from '@/components/llm/CorrectiveActionAssistant'
import { llmCorrectiveActionService } from '@/services/llmCorrectiveActions'
import { evidenceService } from '@/services/evidences'

// antd의 App.useApp() 는 <App> 프로바이더 하위에서만 작동한다.
const renderWithApp = (ui: React.ReactElement) =>
  render(<App>{ui}</App>)

vi.mock('@/services/llmCorrectiveActions', () => ({
  llmCorrectiveActionService: {
    generate: vi.fn(),
    getByTaskId: vi.fn(),
    listByNonConformity: vi.fn(),
    deleteSuggestion: vi.fn(),
  },
}))

vi.mock('@/services/evidences', () => ({
  evidenceService: {
    getEvidences: vi.fn(),
  },
}))

const mockGenerate = vi.mocked(llmCorrectiveActionService.generate)
const mockGetByTaskId = vi.mocked(llmCorrectiveActionService.getByTaskId)
const mockListByNc = vi.mocked(llmCorrectiveActionService.listByNonConformity)
const mockDelete = vi.mocked(llmCorrectiveActionService.deleteSuggestion)
const mockGetEvidences = vi.mocked(evidenceService.getEvidences)

const sampleEvidences: AssistantEvidence[] = [
  { id: 101, title: '조치 전', mimeType: 'image/png', fileName: 'before.png' },
  { id: 102, title: '조치 후', mimeType: 'image/png', fileName: 'after.png' },
]

// 실제 타이머를 쓰되 폴링 간격을 10ms로 줄여 테스트가 빠르게 수렴하도록 한다.
// 가짜 타이머는 React 18 스케줄러와 충돌하여 "Should not already be working" 에러를 유발한다.
const FAST_POLL_MS = 10

const emptyEvidencePage = {
  items: [],
  total: 0,
  page: 1,
  size: 100,
  pages: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  // 컴포넌트는 availableEvidences가 비어 있으면 시스템 증적 목록을 조회하려 한다.
  // 테스트가 이 동작을 명시적으로 덮어쓰지 않는 한 빈 페이지로 응답한다.
  mockGetEvidences.mockResolvedValue(emptyEvidencePage)
  // 컴포넌트는 mount 시 과거 초안을 복원하려 listByNonConformity 를 호출한다.
  // 테스트가 덮어쓰지 않는 한 '이력 없음' 으로 응답해 새 초안 생성 경로를 막지 않는다.
  mockListByNc.mockResolvedValue({ items: [], total: 0 })
})

describe('CorrectiveActionAssistant', () => {
  it('renders the privacy notice and disclaimer', () => {
    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
      />,
    )
    expect(
      screen.getByText(/외부로 데이터가 전송되지 않습니다/),
    ).toBeInTheDocument()
    expect(screen.getByText(/반드시 검토 후 사용/)).toBeInTheDocument()
  })

  it('allows text-only generation when no image evidence is available', () => {
    renderWithApp(
      <CorrectiveActionAssistant nonConformityId={1} availableEvidences={[]} />,
    )
    // 이미지가 없어도 텍스트만으로 생성 가능하다는 안내가 노출된다.
    expect(
      screen.getByText(/이미지 증적이 없어도 텍스트만으로 초안을 생성할 수 있습니다/),
    ).toBeInTheDocument()
    // 생성 버튼도 여전히 보이고 클릭 가능해야 한다.
    const button = screen.getByLabelText('AI 초안 생성')
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('filters out non-image evidence', () => {
    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={[
          { id: 1, title: '이미지', mimeType: 'image/png', fileName: 'a.png' },
          { id: 2, title: 'PDF 문서', mimeType: 'application/pdf', fileName: 'b.pdf' },
        ]}
      />,
    )
    expect(screen.getByLabelText('AI 초안 생성')).toBeInTheDocument()
    // PDF는 선택 후보에 노출되지 않는다.
    expect(screen.queryByText(/PDF 문서/)).not.toBeInTheDocument()
  })

  it('falls back to evidenceService.getEvidences when availableEvidences is empty', async () => {
    mockGetEvidences.mockResolvedValueOnce({
      items: [
        {
          id: 301,
          title: '업로드한 스샷',
          fileName: 'console.png',
          status: 'active' as any,
          version: 1,
          validUntil: null,
          uploaderName: 'tester',
          controlItemCount: 0,
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      size: 100,
      pages: 1,
    })
    renderWithApp(<CorrectiveActionAssistant nonConformityId={42} />)
    await waitFor(() =>
      expect(mockGetEvidences).toHaveBeenCalledWith({ page: 1, size: 100 }),
    )
  })

  it('submits generate request with selected evidence IDs and polls to succeeded', async () => {
    const user = userEvent.setup()
    mockGenerate.mockResolvedValueOnce({
      taskId: 'task-abc',
      suggestionId: 7,
      status: 'pending',
    })
    mockGetByTaskId
      .mockResolvedValueOnce({
        id: 7,
        nonConformityId: 1,
        taskId: 'task-abc',
        status: 'running',
        modelName: 'qwen2.5vl:3b',
        resultText: null,
        errorMessage: null,
        evidenceIds: [101, 102],
        createdBy: 1,
        createdAt: '2025-01-01T00:00:00Z',
        completedAt: null,
      })
      .mockResolvedValue({
        id: 7,
        nonConformityId: 1,
        taskId: 'task-abc',
        status: 'succeeded',
        modelName: 'qwen2.5vl:3b',
        resultText: '# 1. 결함 현상\n테스트 결과 본문',
        errorMessage: null,
        evidenceIds: [101, 102],
        createdBy: 1,
        createdAt: '2025-01-01T00:00:00Z',
        completedAt: '2025-01-01T00:05:00Z',
      })

    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
        pollIntervalMs={FAST_POLL_MS}
      />,
    )
    await user.click(screen.getByLabelText('AI 초안 생성'))

    await waitFor(() =>
      expect(mockGenerate).toHaveBeenCalledWith({
        nonConformityId: 1,
        evidenceIds: [101, 102],
      }),
    )
    await waitFor(
      () => expect(screen.getByText(/테스트 결과 본문/)).toBeInTheDocument(),
      { timeout: 2000 },
    )
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('shows a Korean user-facing error when generation fails', async () => {
    const user = userEvent.setup()
    mockGenerate.mockResolvedValueOnce({
      taskId: 'task-xyz',
      suggestionId: 8,
      status: 'pending',
    })
    mockGetByTaskId.mockResolvedValue({
      id: 8,
      nonConformityId: 1,
      taskId: 'task-xyz',
      status: 'failed',
      modelName: 'qwen2.5vl:3b',
      resultText: null,
      errorMessage: 'LLM 서비스에 연결할 수 없습니다.',
      evidenceIds: [101, 102],
      createdBy: 1,
      createdAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T00:00:05Z',
    })

    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
        pollIntervalMs={FAST_POLL_MS}
      />,
    )
    await user.click(screen.getByLabelText('AI 초안 생성'))
    // 에러 문구는 Alert 설명과 antd message 토스트에 동시 노출될 수 있어 getAllByText 로 조회한다.
    await waitFor(
      () =>
        expect(
          screen.getAllByText('LLM 서비스에 연결할 수 없습니다.').length,
        ).toBeGreaterThan(0),
      { timeout: 2000 },
    )
    expect(screen.getByText('실패')).toBeInTheDocument()
  })

  it('invokes onApplyToCorrectiveAction with the draft text', async () => {
    const user = userEvent.setup()
    mockGenerate.mockResolvedValueOnce({
      taskId: 'task-apply',
      suggestionId: 9,
      status: 'pending',
    })
    mockGetByTaskId.mockResolvedValue({
      id: 9,
      nonConformityId: 1,
      taskId: 'task-apply',
      status: 'succeeded',
      modelName: 'qwen2.5vl:3b',
      resultText: 'DRAFT BODY',
      errorMessage: null,
      evidenceIds: [101, 102],
      createdBy: 1,
      createdAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T00:05:00Z',
    })

    const onApply = vi.fn()
    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
        onApplyToCorrectiveAction={onApply}
        pollIntervalMs={FAST_POLL_MS}
      />,
    )
    await user.click(screen.getByLabelText('AI 초안 생성'))
    await waitFor(
      () =>
        expect(screen.getByLabelText('조치 계획에 적용')).toBeInTheDocument(),
      { timeout: 2000 },
    )
    await user.click(screen.getByLabelText('조치 계획에 적용'))
    expect(onApply).toHaveBeenCalledWith('DRAFT BODY')
  })

  it('restores the latest succeeded draft on mount (navigate-away-and-back scenario)', async () => {
    // 10분 전 완료된 초안이 DB 에 남아있는 상태로 컴포넌트가 다시 마운트된다고 가정.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    mockListByNc.mockResolvedValueOnce({
      items: [
        {
          id: 42,
          nonConformityId: 1,
          taskId: 'task-resumed',
          status: 'succeeded',
          modelName: 'qwen2.5vl:3b',
          resultText: '# 1. 결함 현상\n복원된 초안',
          errorMessage: null,
          evidenceIds: [101, 102],
          createdBy: 1,
          createdAt: tenMinutesAgo,
          completedAt: tenMinutesAgo,
        },
      ],
      total: 1,
    })

    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText(/복원된 초안/)).toBeInTheDocument(),
    )
    expect(screen.getByText('완료')).toBeInTheDocument()
    // 상대시간 라벨 — '10분 전 생성'
    expect(screen.getByText(/분 전 생성/)).toBeInTheDocument()
    // 새 폴링은 시작되지 않아야 한다.
    expect(mockGetByTaskId).not.toHaveBeenCalled()
  })

  it('resumes polling when the latest draft is still running on mount', async () => {
    // 1분 전에 시작되어 아직 running 상태인 초안.
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    mockListByNc.mockResolvedValueOnce({
      items: [
        {
          id: 55,
          nonConformityId: 1,
          taskId: 'task-in-flight',
          status: 'running',
          modelName: 'qwen2.5vl:3b',
          resultText: null,
          errorMessage: null,
          evidenceIds: [101, 102],
          createdBy: 1,
          createdAt: oneMinuteAgo,
          completedAt: null,
        },
      ],
      total: 1,
    })
    // 재개된 폴링의 첫 응답은 succeeded.
    mockGetByTaskId.mockResolvedValue({
      id: 55,
      nonConformityId: 1,
      taskId: 'task-in-flight',
      status: 'succeeded',
      modelName: 'qwen2.5vl:3b',
      resultText: '돌아와서 완성된 초안',
      errorMessage: null,
      evidenceIds: [101, 102],
      createdBy: 1,
      createdAt: oneMinuteAgo,
      completedAt: new Date().toISOString(),
    })

    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
        pollIntervalMs={FAST_POLL_MS}
      />,
    )

    // 폴링이 재개되어 완성 텍스트가 등장해야 한다.
    await waitFor(
      () =>
        expect(screen.getByText('돌아와서 완성된 초안')).toBeInTheDocument(),
      { timeout: 2000 },
    )
    expect(mockGetByTaskId).toHaveBeenCalledWith('task-in-flight')
  })

  it('does not show the result card when no prior draft exists', async () => {
    // 기본 mock 이 빈 목록을 반환한다 (beforeEach 에서 설정).
    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
      />,
    )
    // 결과 카드 제목 '생성 결과' 가 보이지 않아야 한다.
    await waitFor(() => expect(mockListByNc).toHaveBeenCalledWith(1))
    expect(screen.queryByText('생성 결과')).not.toBeInTheDocument()
  })

  it('deletes the current draft when user confirms', async () => {
    const user = userEvent.setup()
    // 최초 mount: 복원용 listByNonConformity — succeeded 1건.
    // 삭제 후 재조회: 빈 리스트 → 카드가 사라져야 한다.
    const now = new Date().toISOString()
    mockListByNc
      .mockResolvedValueOnce({
        items: [
          {
            id: 77,
            nonConformityId: 1,
            taskId: 'task-old',
            status: 'succeeded',
            modelName: 'qwen3.5:2b',
            resultText: '삭제될 초안 본문',
            errorMessage: null,
            evidenceIds: [101, 102],
            createdBy: 1,
            createdAt: now,
            completedAt: now,
          },
        ],
        total: 1,
      })
      .mockResolvedValue({ items: [], total: 0 })
    mockDelete.mockResolvedValue(undefined)

    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
      />,
    )

    // 복원된 초안 본문이 보일 때까지 대기.
    await waitFor(() =>
      expect(screen.getByText(/삭제될 초안 본문/)).toBeInTheDocument(),
    )

    // 삭제 버튼 → Popconfirm 확인.
    await user.click(screen.getByLabelText('초안 삭제'))
    await user.click(await screen.findByRole('button', { name: '삭제' }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(77))
    // 삭제 후 재조회는 빈 리스트이므로 카드가 사라져야 한다.
    await waitFor(() =>
      expect(screen.queryByText(/삭제될 초안 본문/)).not.toBeInTheDocument(),
    )
  })

  it('does not restore an old failed draft on mount when no valid draft exists', async () => {
    // 실사용 시나리오: 이전에 실패 한 건만 남은 NC 에 재진입. 실패 카드가
    // '현재 결과' 로 보이면 사용자가 혼란스러워하므로 아예 표시하지 않는다.
    const longAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    mockListByNc.mockResolvedValueOnce({
      items: [
        {
          id: 99,
          nonConformityId: 1,
          taskId: 'task-ancient-failed',
          status: 'failed',
          modelName: 'qwen3.5:2b',
          resultText: null,
          errorMessage: 'orphaned - worker restart',
          evidenceIds: [],
          createdBy: 1,
          createdAt: longAgo,
          completedAt: longAgo,
        },
      ],
      total: 1,
    })

    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
      />,
    )
    await waitFor(() => expect(mockListByNc).toHaveBeenCalledWith(1))
    // '생성 결과' 카드는 뜨지 않고, 영어 디버그 메시지는 어디에도 노출되지 않아야 한다.
    expect(screen.queryByText('생성 결과')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/orphaned - worker restart/),
    ).not.toBeInTheDocument()
  })

  it('restores the latest succeeded draft even if a newer failed draft exists', async () => {
    // created_at DESC 순서라 실패 → 성공 순으로 내려온다. 복원기는 실패를 건너뛰고
    // 그 뒤의 성공 건을 선택해야 한다.
    const now = new Date().toISOString()
    const earlier = new Date(Date.now() - 60_000).toISOString()
    mockListByNc.mockResolvedValueOnce({
      items: [
        {
          id: 100,
          nonConformityId: 1,
          taskId: 'task-fresh-failed',
          status: 'failed',
          modelName: 'qwen3.5:2b',
          resultText: null,
          errorMessage: '일시적 실패',
          evidenceIds: [],
          createdBy: 1,
          createdAt: now,
          completedAt: now,
        },
        {
          id: 99,
          nonConformityId: 1,
          taskId: 'task-older-success',
          status: 'succeeded',
          modelName: 'qwen3.5:2b',
          resultText: '복원되어야 할 본문',
          errorMessage: null,
          evidenceIds: [],
          createdBy: 1,
          createdAt: earlier,
          completedAt: earlier,
        },
      ],
      total: 2,
    })

    renderWithApp(
      <CorrectiveActionAssistant
        nonConformityId={1}
        availableEvidences={sampleEvidences}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText(/복원되어야 할 본문/)).toBeInTheDocument(),
    )
    // 실패 메시지는 어디에도 노출되지 않아야 한다.
    expect(screen.queryByText('일시적 실패')).not.toBeInTheDocument()
  })
})
