import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'

import NcEvidenceAttachments from '@/components/audit/NcEvidenceAttachments'
import { auditService } from '@/services/audits'
import { evidenceService } from '@/services/evidences'
import type { NcEvidenceItem, NcEvidenceList } from '@/types'

const renderWithApp = (ui: React.ReactElement) =>
  render(<App>{ui}</App>)

vi.mock('@/services/audits', () => ({
  auditService: {
    listNcEvidences: vi.fn(),
    attachExistingEvidences: vi.fn(),
    uploadAndAttachEvidence: vi.fn(),
    updateNcEvidenceNote: vi.fn(),
    updateNcEvidenceRole: vi.fn(),
    detachEvidence: vi.fn(),
  },
}))

vi.mock('@/services/evidences', () => ({
  evidenceService: {
    getEvidences: vi.fn(),
  },
}))

const mockList = vi.mocked(auditService.listNcEvidences)
const mockAttach = vi.mocked(auditService.attachExistingEvidences)
const mockDetach = vi.mocked(auditService.detachEvidence)
const mockUpdateRole = vi.mocked(auditService.updateNcEvidenceRole)
const mockGetEvidences = vi.mocked(evidenceService.getEvidences)

const makeItem = (id: number, overrides?: Partial<NcEvidenceItem>): NcEvidenceItem => ({
  mappingId: 100 + id,
  evidenceId: id,
  title: `증적 ${id}`,
  fileName: `file${id}.png`,
  fileSize: 1024 * id,
  mimeType: 'image/png',
  mappingNote: null,
  role: 'reference',
  mappedBy: 1,
  mappedAt: '2026-04-20T10:00:00Z',
  uploaderName: 'admin',
  ...overrides,
})

const emptyList: NcEvidenceList = { items: [], total: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue(emptyList)
  mockGetEvidences.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    size: 200,
    pages: 0,
  })
})

describe('NcEvidenceAttachments', () => {
  it('shows empty state when no evidence is attached', async () => {
    renderWithApp(<NcEvidenceAttachments nonConformityId={1} canEdit />)
    await waitFor(() =>
      expect(screen.getByText('연결된 증적이 없습니다.')).toBeInTheDocument(),
    )
  })

  it('renders attached items with file metadata', async () => {
    mockList.mockResolvedValueOnce({
      items: [makeItem(7, { mappingNote: '조치 전 증적' })],
      total: 1,
    })
    renderWithApp(<NcEvidenceAttachments nonConformityId={1} canEdit />)
    await waitFor(() => expect(screen.getByText('증적 7')).toBeInTheDocument())
    expect(screen.getByText(/file7\.png/)).toBeInTheDocument()
    expect(screen.getByText(/조치 전 증적/)).toBeInTheDocument()
  })

  it('hides edit affordances when canEdit is false', async () => {
    mockList.mockResolvedValueOnce({ items: [makeItem(1)], total: 1 })
    renderWithApp(<NcEvidenceAttachments nonConformityId={1} canEdit={false} />)
    await waitFor(() => expect(screen.getByText('증적 1')).toBeInTheDocument())
    // 드래그앤드롭 영역과 '기존 증적 연결' 버튼 모두 숨겨져야 한다.
    expect(
      screen.queryByLabelText('새 파일 드래그 앤 드롭 업로드'),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('기존 증적 연결')).not.toBeInTheDocument()
  })

  it('shows the drag-and-drop zone when canEdit is true', async () => {
    renderWithApp(<NcEvidenceAttachments nonConformityId={1} canEdit />)
    await waitFor(() =>
      expect(screen.getByText('연결된 증적이 없습니다.')).toBeInTheDocument(),
    )
    expect(
      screen.getByText('파일을 이 영역에 끌어다 놓거나 클릭해서 선택하세요.'),
    ).toBeInTheDocument()
  })

  it('calls onChange with the loaded items', async () => {
    mockList.mockResolvedValueOnce({
      items: [makeItem(1), makeItem(2)],
      total: 2,
    })
    const onChange = vi.fn()
    renderWithApp(
      <NcEvidenceAttachments nonConformityId={1} canEdit onChange={onChange} />,
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall).toHaveLength(2)
    expect(lastCall[0].evidenceId).toBe(1)
  })

  it('detaches an evidence when user confirms', async () => {
    const user = userEvent.setup()
    mockList
      .mockResolvedValueOnce({ items: [makeItem(1)], total: 1 })
      .mockResolvedValue(emptyList)
    mockDetach.mockResolvedValue(undefined)

    renderWithApp(<NcEvidenceAttachments nonConformityId={42} canEdit />)
    await waitFor(() => expect(screen.getByText('증적 1')).toBeInTheDocument())

    await user.click(screen.getByLabelText('증적 1 연결 해제'))
    // antd Popconfirm 버튼은 접근 가능한 이름이 '해제'
    await user.click(await screen.findByRole('button', { name: '해제' }))

    await waitFor(() =>
      expect(mockDetach).toHaveBeenCalledWith(42, 1),
    )
  })

  it('attaches existing evidences picked from the modal', async () => {
    const user = userEvent.setup()
    mockGetEvidences.mockResolvedValue({
      items: [
        {
          id: 501,
          title: '기존 증적',
          fileName: 'existing.png',
          status: 'active' as any,
          version: 1,
          validUntil: null,
          uploaderName: 'tester',
          controlItemCount: 0,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      size: 200,
      pages: 1,
    })
    mockAttach.mockResolvedValue({
      items: [makeItem(501, { title: '기존 증적', fileName: 'existing.png' })],
      total: 1,
    })

    renderWithApp(<NcEvidenceAttachments nonConformityId={7} canEdit />)

    await user.click(screen.getByLabelText('기존 증적 연결'))

    // Modal select 의 option 이 로드될 때까지 대기
    // source='nc_finding' 로 결함 증적만 후보에 올라와야 한다.
    await waitFor(() =>
      expect(mockGetEvidences).toHaveBeenCalledWith({
        page: 1,
        size: 200,
        source: 'nc_finding',
      }),
    )

    // antd Select 클릭 → 드롭다운 열기 → 항목 선택.
    // 이제 모달 내 combobox 가 2개(증적 선택 + 역할 선택)라서 첫 번째(증적) 를 명시적으로 선택.
    const comboboxes = screen.getAllByRole('combobox')
    await user.click(comboboxes[0])
    const option = await screen.findByText(/기존 증적 \(existing\.png\)/)
    await user.click(option)

    await user.click(screen.getByRole('button', { name: '연결' }))

    await waitFor(() =>
      // 빈 목록에서 첫 첨부이므로 기본 role 은 before 이다.
      expect(mockAttach).toHaveBeenCalledWith(7, {
        evidenceIds: [501],
        mappingNote: null,
        role: 'before',
      }),
    )
  })

  it('opens the upload modal with the dropped filename prefilled', async () => {
    const user = userEvent.setup()
    renderWithApp(<NcEvidenceAttachments nonConformityId={11} canEdit />)
    await waitFor(() =>
      expect(screen.getByText('연결된 증적이 없습니다.')).toBeInTheDocument(),
    )

    // antd Upload.Dragger 내부 hidden <input type="file"> 로 파일 주입.
    // 실제 drop 이벤트보다 표면적이 작고 안정적이며, 결과적으로 beforeUpload 가 호출된다.
    const file = new File(['fake-png-bytes'], 'dropped-screenshot.png', {
      type: 'image/png',
    })
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null
    expect(input).not.toBeNull()

    await user.upload(input!, file)

    // 업로드 모달이 열리고 제목 필드가 파일명으로 채워져야 한다.
    await waitFor(() =>
      expect(
        screen.getByText(/새 증적 업로드 — dropped-screenshot\.png/),
      ).toBeInTheDocument(),
    )
    const titleInput = screen.getByLabelText('증적 제목') as HTMLInputElement
    expect(titleInput.value).toBe('dropped-screenshot.png')
  })

  it('shows error message when list fetch fails', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'))
    renderWithApp(<NcEvidenceAttachments nonConformityId={1} canEdit />)
    // antd message 토스트에 한국어 사용자 메시지 노출
    await waitFor(() =>
      expect(
        screen.getByText('연결된 증적을 불러오지 못했습니다.'),
      ).toBeInTheDocument(),
    )
  })

  it('renders role badges and sorts items by role (before → after → support → reference)', async () => {
    mockList.mockResolvedValueOnce({
      items: [
        makeItem(1, { role: 'reference', title: 'A-참고' }),
        makeItem(2, { role: 'after', title: 'B-조치후' }),
        makeItem(3, { role: 'before', title: 'C-조치전' }),
        makeItem(4, { role: 'support', title: 'D-결재' }),
      ],
      total: 4,
    })
    renderWithApp(
      <NcEvidenceAttachments nonConformityId={1} canEdit={false} />,
    )
    await waitFor(() =>
      expect(screen.getByText('C-조치전')).toBeInTheDocument(),
    )
    // DOM 순서 비교: 각 제목이 그 다음 제목보다 먼저 나와야 한다 (before→after→support→reference).
    const titles = ['C-조치전', 'B-조치후', 'D-결재', 'A-참고']
    for (let i = 0; i < titles.length - 1; i++) {
      const cur = screen.getByText(titles[i])
      const nxt = screen.getByText(titles[i + 1])
      expect(
        cur.compareDocumentPosition(nxt) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
    // canEdit=false 이므로 각 역할이 Tag 로 표시된다. 같은 텍스트가 여러 위치에
    // 있을 수 있으므로 최소 1건 이상 보이면 통과로 한다.
    expect(screen.getAllByText('조치 전').length).toBeGreaterThan(0)
    expect(screen.getAllByText('조치 후').length).toBeGreaterThan(0)
    expect(screen.getAllByText('보조').length).toBeGreaterThan(0)
    expect(screen.getAllByText('미지정').length).toBeGreaterThan(0)
  })

  it('calls updateNcEvidenceRole when the inline role select changes', async () => {
    const user = userEvent.setup()
    mockList
      .mockResolvedValueOnce({
        items: [makeItem(1, { role: 'before', title: 'X' })],
        total: 1,
      })
      .mockResolvedValue({
        items: [makeItem(1, { role: 'after', title: 'X' })],
        total: 1,
      })
    mockUpdateRole.mockResolvedValueOnce(
      makeItem(1, { role: 'after', title: 'X' }),
    )

    renderWithApp(<NcEvidenceAttachments nonConformityId={42} canEdit />)
    await waitFor(() => expect(screen.getByText('X')).toBeInTheDocument())

    // antd Select 는 같은 aria-label 을 가진 노드를 여러 개 만들므로 role=combobox 로 좁힌다.
    const roleSelect = screen.getByRole('combobox', { name: 'X 역할 변경' })
    await user.click(roleSelect)
    // antd 드롭다운에서 '조치 후' 를 옵션 컨테이너 내에서 찾는다.
    const option = await screen.findByText('조치 후', {
      selector: '.ant-select-item-option-content',
    })
    await user.click(option)

    await waitFor(() =>
      expect(mockUpdateRole).toHaveBeenCalledWith(42, 1, 'after'),
    )
  })

  it('defaults upload role to before on first attachment, after when before already exists', async () => {
    // 첫 번째 시나리오: 아무것도 없는 상태 → default = before
    mockList.mockResolvedValueOnce({ items: [], total: 0 })
    const user = userEvent.setup()

    const { unmount } = renderWithApp(
      <NcEvidenceAttachments nonConformityId={1} canEdit />,
    )
    await waitFor(() =>
      expect(screen.getByText('연결된 증적이 없습니다.')).toBeInTheDocument(),
    )

    const file = new File(['x'], 'shot1.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() =>
      expect(screen.getByText(/새 증적 업로드 — shot1\.png/)).toBeInTheDocument(),
    )
    // 역할 select 는 기본값이 '조치 전' 으로 렌더되어야 한다.
    const roleSelect = screen.getByRole('combobox', { name: '업로드 역할 선택' })
    // antd Select 는 선택 라벨을 .ant-select-selection-item 에 그린다.
    const selector = roleSelect.closest('.ant-select')!
    expect(selector.querySelector('.ant-select-selection-item')!.textContent).toBe(
      '조치 전',
    )

    unmount()

    // 두 번째 시나리오: before 만 이미 있는 상태 → default = after
    mockList.mockResolvedValueOnce({
      items: [makeItem(1, { role: 'before' })],
      total: 1,
    })
    renderWithApp(<NcEvidenceAttachments nonConformityId={1} canEdit />)
    await waitFor(() => expect(screen.getByText('증적 1')).toBeInTheDocument())

    const file2 = new File(['x'], 'shot2.png', { type: 'image/png' })
    const input2 = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    await user.upload(input2, file2)

    await waitFor(() =>
      expect(screen.getByText(/새 증적 업로드 — shot2\.png/)).toBeInTheDocument(),
    )
    const roleSelect2 = screen.getByRole('combobox', { name: '업로드 역할 선택' })
    const selector2 = roleSelect2.closest('.ant-select')!
    expect(selector2.querySelector('.ant-select-selection-item')!.textContent).toBe(
      '조치 후',
    )
  })
})
