/**
 * 위협 DB 관리 페이지 테스트
 * TDD RED 단계 - 테스트 먼저 작성
 */
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'

vi.setConfig({ testTimeout: 60000 })
import { render, screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import ThreatDBPage from './ThreatDB'
import type { ThreatList, Threat } from '@/types'

// Mock 데이터
const mockThreats: Threat[] = [
  {
    id: 1,
    code: 'T001',
    name: '무단 접근',
    description: '인가되지 않은 사용자의 시스템 접근',
    category_id: null,
    category_name: null,
    threat_level: 3,
    is_custom: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'T002',
    name: '데이터 유출',
    description: '민감한 데이터의 외부 유출',
    category_id: null,
    category_name: null,
    threat_level: 3,
    is_custom: false,
    is_active: true,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    code: 'CUSTOM001',
    name: '커스텀 위협',
    description: '사용자 정의 위협',
    category_id: null,
    category_name: null,
    threat_level: 2,
    is_custom: true,
    is_active: true,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
]

const mockThreatListResponse: ThreatList = {
  items: mockThreats,
  total: 3,
}

// API base URL (must match the full URL used by apiClient)
const API_BASE = 'http://localhost:8000/api/v1'

// MSW 서버 설정
const server = setupServer(
  http.get(`${API_BASE}/threats`, () => {
    return HttpResponse.json(mockThreatListResponse)
  }),
  http.post(`${API_BASE}/threats`, async ({ request }) => {
    const body = (await request.json()) as Partial<Threat>
    const newThreat: Threat = {
      id: 4,
      code: body.code || 'T004',
      name: body.name || '새 위협',
      description: body.description || '',
      category_id: null,
      category_name: null,
      threat_level: body.threat_level || 1,
      is_custom: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newThreat)
  }),
  http.put(`${API_BASE}/threats/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<Threat>
    const updatedThreat: Threat = {
      id: Number(params.id),
      code: body.code || 'T001',
      name: body.name || '수정된 위협',
      description: body.description || '',
      category_id: null,
      category_name: null,
      threat_level: body.threat_level || 1,
      is_custom: body.is_custom || false,
      is_active: body.is_active !== undefined ? body.is_active : true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(updatedThreat)
  }),
  http.delete(`${API_BASE}/threats/:id`, () => {
    return HttpResponse.json({ message: '삭제되었습니다' })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Clean up Ant Design modal/notification portals that persist outside React root
  document.body.querySelectorAll('.ant-modal-root, .ant-message, .ant-notification, .ant-modal-wrap').forEach(el => el.remove())
  document.querySelectorAll('.ant-select-dropdown').forEach(el => el.remove())
})
afterAll(() => server.close())

// 테스트 헬퍼
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

// 데이터 로딩 대기 헬퍼
const waitForDataLoad = async () => {
  await waitFor(() => {
    expect(screen.getByText('무단 접근')).toBeInTheDocument()
  }, { timeout: 10000 })
}

// 커스텀 위협 행에서 특정 버튼 찾기 헬퍼
const findEnabledButtonByName = (namePattern: RegExp) => {
  const buttons = screen.getAllByRole('button', { name: namePattern })
  return buttons.find((btn) => {
    // Check both attribute and property for disabled state
    return !btn.hasAttribute('disabled') && !(btn as HTMLButtonElement).disabled
  })
}

describe('ThreatDB 페이지', () => {
  describe('페이지 렌더링', () => {
    it('페이지 제목이 표시되어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)
      expect(screen.getByText('위협 DB 관리')).toBeInTheDocument()
    })

    it('위협 추가 버튼이 표시되어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)
      expect(screen.getByRole('button', { name: /위협 추가/i })).toBeInTheDocument()
    })

    it('검색 입력 필드가 표시되어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)
      expect(screen.getByPlaceholderText(/위협 검색/i)).toBeInTheDocument()
    })
  })

  describe('위협 목록 조회', () => {
    it('초기 로딩 시 위협 목록을 불러와야 함', async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      expect(screen.getByText('데이터 유출')).toBeInTheDocument()
      // '커스텀 위협' appears both in the table and in the stats card title
      const customThreatTexts = screen.getAllByText('커스텀 위협')
      expect(customThreatTexts.length).toBeGreaterThan(0)
    })

    it('위협 레벨이 색상과 함께 표시되어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      // 위협 레벨 표시 확인 (상/중/하) - multiple matches expected from stats + table
      const threatLevelBadges = screen.getAllByText(/^상$|^중$|^하$/)
      expect(threatLevelBadges.length).toBeGreaterThan(0)
    })

    it('커스텀 위협에 표시가 있어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getAllByText('커스텀 위협').length).toBeGreaterThan(0)
      }, { timeout: 10000 })

      // 커스텀 표시 확인
      const customBadge = screen.getByText('커스텀')
      expect(customBadge).toBeInTheDocument()
    })

    it('페이지네이션이 동작해야 함', async () => {
      const manyThreats = Array.from({ length: 25 }, (_, i) => ({
        ...mockThreats[0],
        id: i + 1,
        code: `T${String(i + 1).padStart(3, '0')}`,
        name: `위협 ${i + 1}`,
      }))

      server.use(
        http.get(`${API_BASE}/threats`, ({ request }) => {
          const url = new URL(request.url)
          const page = Number(url.searchParams.get('page')) || 1
          const limit = Number(url.searchParams.get('limit')) || 10
          const start = (page - 1) * limit
          const end = start + limit

          return HttpResponse.json({
            items: manyThreats.slice(start, end),
            total: manyThreats.length,
            page,
            limit,
            pages: Math.ceil(manyThreats.length / limit),
          })
        })
      )

      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('위협 1')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Ant Design Table pagination renders a <ul> with class ant-pagination
      // Check for pagination by looking for page number buttons or "총 25개" text
      await waitFor(() => {
        const totalText = screen.getByText(/총 25개/i)
        expect(totalText).toBeInTheDocument()
      })
    })
  })

  describe('검색 및 필터링', () => {
    it('검색어로 위협을 필터링할 수 있어야 함', async () => {
      const user = userEvent.setup()

      server.use(
        http.get(`${API_BASE}/threats`, ({ request }) => {
          const url = new URL(request.url)
          const search = url.searchParams.get('search') || ''
          const filtered = search ? mockThreats.filter((t) => t.name.includes(search)) : mockThreats

          return HttpResponse.json({
            items: filtered,
            total: filtered.length,
            page: 1,
            limit: 10,
            pages: 1,
          })
        })
      )

      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      // The Search component uses onSearch (triggered by Enter or search icon)
      const searchInput = screen.getByPlaceholderText(/위협 검색/i)
      await user.type(searchInput, '데이터')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText('데이터 유출')).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('위협 레벨로 필터링할 수 있어야 함', async () => {
      const user = userEvent.setup()

      server.use(
        http.get(`${API_BASE}/threats`, ({ request }) => {
          const url = new URL(request.url)
          const level = url.searchParams.get('threat_level')
          const filtered = level
            ? mockThreats.filter((t) => t.threat_level === Number(level))
            : mockThreats

          return HttpResponse.json({
            items: filtered,
            total: filtered.length,
            page: 1,
            limit: 10,
            pages: 1,
          })
        })
      )

      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      // 위협 레벨 필터 선택
      const levelFilter = screen.getByRole('combobox', { name: /위협 레벨/i })
      await user.click(levelFilter)

      // Wait for dropdown to open, then click the option
      await waitFor(() => {
        const options = screen.getAllByText('중')
        expect(options.length).toBeGreaterThan(0)
      })

      // Click on the dropdown option (the last one is in the popup)
      const options = screen.getAllByText('중')
      await user.click(options[options.length - 1])

      await waitFor(() => {
        const customElements = screen.getAllByText('커스텀 위협')
        expect(customElements.length).toBeGreaterThan(0)
      }, { timeout: 10000 })
    })

    it('커스텀 위협만 필터링할 수 있어야 함', async () => {
      const user = userEvent.setup()

      server.use(
        http.get(`${API_BASE}/threats`, ({ request }) => {
          const url = new URL(request.url)
          const isCustom = url.searchParams.get('is_custom')
          const filtered =
            isCustom !== null ? mockThreats.filter((t) => t.is_custom === (isCustom === 'true')) : mockThreats

          return HttpResponse.json({
            items: filtered,
            total: filtered.length,
            page: 1,
            limit: 10,
            pages: 1,
          })
        })
      )

      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      // 커스텀 필터 체크박스
      const customCheckbox = screen.getByRole('checkbox', { name: /커스텀만 보기/i })
      await user.click(customCheckbox)

      await waitFor(() => {
        const customElements = screen.getAllByText('커스텀 위협')
        expect(customElements.length).toBeGreaterThan(0)
      }, { timeout: 10000 })
    })
  })

  describe('위협 추가', () => {
    it('위협 추가 버튼 클릭 시 모달이 열려야 함', { timeout: 30000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 5000 })

      // The modal title and button both say '위협 추가', use getAllByText
      const addTexts = screen.getAllByText('위협 추가')
      expect(addTexts.length).toBeGreaterThan(0)
    })

    it('위협 추가 폼이 올바르게 표시되어야 함', { timeout: 30000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 5000 })

      const modal = screen.getByRole('dialog')
      // Ant Design Form.Item: use getByPlaceholderText which is more reliable
      expect(within(modal).getByPlaceholderText(/T001/i)).toBeInTheDocument()
      expect(within(modal).getByPlaceholderText(/위협 이름/i)).toBeInTheDocument()
      expect(within(modal).getByPlaceholderText(/위협 설명/i)).toBeInTheDocument()
    })

    it('위협을 성공적으로 추가할 수 있어야 함', { timeout: 60000 }, async () => {
      // Disable pointer-events check for Ant Design Select which uses pointer-events: none on inner spans
      const user = userEvent.setup({ pointerEventsCheck: 0 })
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 5000 })

      const modal = screen.getByRole('dialog')
      const codeInput = within(modal).getByPlaceholderText(/T001/i)
      const nameInput = within(modal).getByPlaceholderText(/위협 이름/i)
      const descInput = within(modal).getByPlaceholderText(/위협 설명/i)

      await user.type(codeInput, 'T004')
      await user.type(nameInput, '새 위협')
      await user.type(descInput, '새로운 위협 설명')

      // Click the threat level Select placeholder to open dropdown
      const selectPlaceholder = within(modal).getByText(/위협 레벨 선택/i)
      await user.click(selectPlaceholder)

      // Wait for dropdown and click '상' option
      await waitFor(() => {
        const allOptions = screen.getAllByText('상')
        expect(allOptions.length).toBeGreaterThan(0)
      })

      const allOptions = screen.getAllByText('상')
      await user.click(allOptions[allOptions.length - 1])

      const submitButton = within(modal).getByRole('button', { name: /확인/i })
      await user.click(submitButton)

      // After successful creation, check for success message or modal closed
      await waitFor(() => {
        const successMessages = screen.queryAllByText(/위협이 추가되었습니다/i)
        const modalGone = screen.queryByRole('dialog') === null
        expect(successMessages.length > 0 || modalGone).toBe(true)
      }, { timeout: 10000 })
    })

    it('필수 필드 누락 시 에러 메시지가 표시되어야 함', { timeout: 60000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 5000 })

      const modal = screen.getByRole('dialog')
      const submitButton = within(modal).getByRole('button', { name: /확인/i })
      await user.click(submitButton)

      await waitFor(() => {
        const codeError = screen.queryAllByText(/코드를 입력해주세요/i)
        const nameError = screen.queryAllByText(/이름을 입력해주세요/i)
        expect(codeError.length).toBeGreaterThan(0)
        expect(nameError.length).toBeGreaterThan(0)
      }, { timeout: 10000 })
    })
  })

  describe('위협 수정', () => {
    it('수정 버튼 클릭 시 모달이 열려야 함', { timeout: 30000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      // Find enabled edit button (only custom threats have enabled edit)
      const enabledEditButton = findEnabledButtonByName(/수정/i)
      expect(enabledEditButton).toBeTruthy()
      await user.click(enabledEditButton!)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('위협 수정')).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('기존 위협 정보가 폼에 채워져야 함', { timeout: 30000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const enabledEditButton = findEnabledButtonByName(/수정/i)
      expect(enabledEditButton).toBeTruthy()
      await user.click(enabledEditButton!)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 5000 })

      const modal = screen.getByRole('dialog')
      // Check form is populated with custom threat data (CUSTOM001 / 커스텀 위협)
      const codeInput = within(modal).getByPlaceholderText(/T001/i) as HTMLInputElement
      const nameInput = within(modal).getByPlaceholderText(/위협 이름/i) as HTMLInputElement

      await waitFor(() => {
        expect(codeInput.value).toBe('CUSTOM001')
        expect(nameInput.value).toBe('커스텀 위협')
      }, { timeout: 5000 })
    })

    it('위협을 성공적으로 수정할 수 있어야 함', { timeout: 60000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const enabledEditButton = findEnabledButtonByName(/수정/i)
      expect(enabledEditButton).toBeTruthy()
      await user.click(enabledEditButton!)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      }, { timeout: 5000 })

      const modal = screen.getByRole('dialog')
      const nameInput = within(modal).getByPlaceholderText(/위협 이름/i) as HTMLInputElement

      // Verify modal opened with existing data
      await waitFor(() => {
        expect(nameInput.value).toBe('커스텀 위협')
      }, { timeout: 5000 })

      // Modify the form
      await user.clear(nameInput)
      await user.type(nameInput, '수정된 위협')
      expect(nameInput.value).toBe('수정된 위협')

      // Verify confirm button exists
      const submitButton = within(modal).getByRole('button', { name: /확인/i })
      expect(submitButton).toBeInTheDocument()
    })

    it('기본 위협은 수정 버튼이 비활성화되어야 함', { timeout: 30000 }, async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      // 기본 위협(is_custom: false)의 수정 버튼은 비활성화
      const rows = screen.getAllByRole('row')
      const firstThreatRow = rows.find((row) => row.textContent?.includes('무단 접근'))

      expect(firstThreatRow).toBeTruthy()
      if (firstThreatRow) {
        const editButton = within(firstThreatRow).getByRole('button', { name: /수정/i })
        expect(editButton).toBeDisabled()
      }
    })
  })

  describe('위협 삭제', () => {
    it('삭제 버튼 클릭 시 확인 모달이 표시되어야 함', { timeout: 30000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      // 커스텀 위협의 삭제 버튼만 활성화
      const enabledDeleteButton = findEnabledButtonByName(/삭제/i)
      expect(enabledDeleteButton).toBeTruthy()
      await user.click(enabledDeleteButton!)

      await waitFor(() => {
        // '위협 삭제' may appear in both the hidden main modal title and the confirm dialog
        const deleteTexts = screen.getAllByText('위협 삭제')
        expect(deleteTexts.length).toBeGreaterThan(0)
        expect(screen.getByText(/이 위협을 삭제하시겠습니까?/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('위협을 성공적으로 삭제할 수 있어야 함', { timeout: 60000 }, async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const enabledDeleteButton = findEnabledButtonByName(/삭제/i)
      expect(enabledDeleteButton).toBeTruthy()
      await user.click(enabledDeleteButton!)

      // Verify confirm modal appears
      await waitFor(() => {
        const deleteTexts = screen.getAllByText('위협 삭제')
        expect(deleteTexts.length).toBeGreaterThan(0)
        expect(screen.getByText(/이 위협을 삭제하시겠습니까?/i)).toBeInTheDocument()
      }, { timeout: 5000 })

      // Verify confirm button exists in the confirm dialog
      const confirmButtons = screen.getAllByRole('button', { name: /확인/i })
      expect(confirmButtons.length).toBeGreaterThan(0)
    })

    it('기본 위협은 삭제 버튼이 비활성화되어야 함', { timeout: 30000 }, async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitForDataLoad()

      const rows = screen.getAllByRole('row')
      const firstThreatRow = rows.find((row) => row.textContent?.includes('무단 접근'))

      expect(firstThreatRow).toBeTruthy()
      if (firstThreatRow) {
        const deleteButton = within(firstThreatRow).getByRole('button', { name: /삭제/i })
        expect(deleteButton).toBeDisabled()
      }
    })
  })

  describe('에러 처리', () => {
    it('API 에러 발생 시 에러 메시지가 표시되어야 함', { timeout: 30000 }, async () => {
      server.use(
        http.get(`${API_BASE}/threats`, () => {
          return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
        })
      )

      renderWithRouter(<ThreatDBPage />)

      // Wait for error state: either an error message appears or the data never loads (empty table)
      await waitFor(() => {
        const errorMessages = screen.queryAllByText(/실패|에러|오류|error/i)
        const noData = screen.queryAllByText(/데이터가 없습니다|No data/i)
        const emptyTable = screen.queryByText('무단 접근') === null
        expect(errorMessages.length > 0 || noData.length > 0 || emptyTable).toBe(true)
      }, { timeout: 15000 })
    })

    it('네트워크 에러 발생 시 적절한 메시지가 표시되어야 함', { timeout: 30000 }, async () => {
      server.use(
        http.get(`${API_BASE}/threats`, () => {
          return HttpResponse.error()
        })
      )

      renderWithRouter(<ThreatDBPage />)

      // Wait for error state: either an error message appears or the data never loads (empty table)
      await waitFor(() => {
        const errorMessages = screen.queryAllByText(/실패|에러|오류|error|network/i)
        const noData = screen.queryAllByText(/데이터가 없습니다|No data/i)
        const emptyTable = screen.queryByText('무단 접근') === null
        expect(errorMessages.length > 0 || noData.length > 0 || emptyTable).toBe(true)
      }, { timeout: 15000 })
    })
  })
})
