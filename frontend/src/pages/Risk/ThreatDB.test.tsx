/**
 * 위협 DB 관리 페이지 테스트
 * TDD RED 단계 - 테스트 먼저 작성
 */
import { describe, it, expect, beforeEach, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
  page: 1,
  limit: 10,
  pages: 1,
}

// MSW 서버 설정
const server = setupServer(
  http.get('http://localhost:8000/api/v1/threats', () => {
    return HttpResponse.json(mockThreatListResponse)
  }),
  http.post('http://localhost:8000/api/v1/threats', async ({ request }) => {
    const body = (await request.json()) as Partial<Threat>
    const newThreat: Threat = {
      id: 4,
      code: body.code || 'T004',
      name: body.name || '새 위협',
      description: body.description || '',
      threat_level: body.threat_level || 1,
      is_custom: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(newThreat)
  }),
  http.put('http://localhost:8000/api/v1/threats/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<Threat>
    const updatedThreat: Threat = {
      id: Number(params.id),
      code: body.code || 'T001',
      name: body.name || '수정된 위협',
      description: body.description || '',
      threat_level: body.threat_level || 1,
      is_custom: body.is_custom || false,
      is_active: body.is_active !== undefined ? body.is_active : true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(updatedThreat)
  }),
  http.delete('http://localhost:8000/api/v1/threats/:id', () => {
    return HttpResponse.json({ message: '삭제되었습니다' })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' })) // bypass로 설정하여 MSW가 처리하지 않는 요청은 통과
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// 테스트 헬퍼
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
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

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      expect(screen.getByText('데이터 유출')).toBeInTheDocument()
      expect(screen.getByText('커스텀 위협')).toBeInTheDocument()
    })

    it('위협 레벨이 색상과 함께 표시되어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      // 위협 레벨 표시 확인 (상/중/하)
      const threatLevelBadges = screen.getAllByText(/상|중|하/)
      expect(threatLevelBadges.length).toBeGreaterThan(0)
    })

    it('커스텀 위협에 표시가 있어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('커스텀 위협')).toBeInTheDocument()
      })

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
        http.get('/api/v1/threats', ({ request }) => {
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
      })

      // 페이지네이션 컨트롤 확인
      const pagination = screen.getByRole('navigation', { name: /pagination/i })
      expect(pagination).toBeInTheDocument()
    })
  })

  describe('검색 및 필터링', () => {
    it('검색어로 위협을 필터링할 수 있어야 함', async () => {
      const user = userEvent.setup()

      server.use(
        http.get('/api/v1/threats', ({ request }) => {
          const url = new URL(request.url)
          const search = url.searchParams.get('search') || ''
          const filtered = mockThreats.filter((t) => t.name.includes(search))

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

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/위협 검색/i)
      await user.type(searchInput, '데이터')

      await waitFor(() => {
        expect(screen.getByText('데이터 유출')).toBeInTheDocument()
        expect(screen.queryByText('무단 접근')).not.toBeInTheDocument()
      })
    })

    it('위협 레벨로 필터링할 수 있어야 함', async () => {
      const user = userEvent.setup()

      server.use(
        http.get('/api/v1/threats', ({ request }) => {
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

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      // 위협 레벨 필터 선택
      const levelFilter = screen.getByRole('combobox', { name: /위협 레벨/i })
      await user.click(levelFilter)
      await user.click(screen.getByText('중'))

      await waitFor(() => {
        expect(screen.getByText('커스텀 위협')).toBeInTheDocument()
        expect(screen.queryByText('무단 접근')).not.toBeInTheDocument()
      })
    })

    it('커스텀 위협만 필터링할 수 있어야 함', async () => {
      const user = userEvent.setup()

      server.use(
        http.get('/api/v1/threats', ({ request }) => {
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

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      // 커스텀 필터 체크박스
      const customCheckbox = screen.getByLabelText('커스텀만 보기')
      await user.click(customCheckbox)

      await waitFor(() => {
        expect(screen.getByText('커스텀 위협')).toBeInTheDocument()
        expect(screen.queryByText('무단 접근')).not.toBeInTheDocument()
      })
    })
  })

  describe('위협 추가', () => {
    it('위협 추가 버튼 클릭 시 모달이 열려야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('위협 DB 관리')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('위협 추가')).toBeInTheDocument()
    })

    it('위협 추가 폼이 올바르게 표시되어야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('위협 DB 관리')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      const modal = screen.getByRole('dialog')
      expect(within(modal).getByLabelText(/코드/i)).toBeInTheDocument()
      expect(within(modal).getByLabelText(/이름/i)).toBeInTheDocument()
      expect(within(modal).getByLabelText(/설명/i)).toBeInTheDocument()
      expect(within(modal).getByLabelText(/위협 레벨/i)).toBeInTheDocument()
    })

    it('위협을 성공적으로 추가할 수 있어야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('위협 DB 관리')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      const modal = screen.getByRole('dialog')
      const codeInput = within(modal).getByLabelText(/코드/i)
      const nameInput = within(modal).getByLabelText(/이름/i)
      const descInput = within(modal).getByLabelText(/설명/i)

      await user.type(codeInput, 'T004')
      await user.type(nameInput, '새 위협')
      await user.type(descInput, '새로운 위협 설명')

      const levelSelect = within(modal).getByLabelText(/위협 레벨/i)
      await user.click(levelSelect)
      await user.click(screen.getByText('상'))

      const submitButton = within(modal).getByRole('button', { name: /확인/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('위협이 추가되었습니다')).toBeInTheDocument()
      })
    })

    it('필수 필드 누락 시 에러 메시지가 표시되어야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('위협 DB 관리')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /위협 추가/i })
      await user.click(addButton)

      const modal = screen.getByRole('dialog')
      const submitButton = within(modal).getByRole('button', { name: /확인/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/코드를 입력해주세요/i)).toBeInTheDocument()
        expect(screen.getByText(/이름을 입력해주세요/i)).toBeInTheDocument()
      })
    })
  })

  describe('위협 수정', () => {
    it('수정 버튼 클릭 시 모달이 열려야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: /수정/i })
      await user.click(editButtons[0])

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('위협 수정')).toBeInTheDocument()
    })

    it('기존 위협 정보가 폼에 채워져야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: /수정/i })
      await user.click(editButtons[0])

      const modal = screen.getByRole('dialog')
      const codeInput = within(modal).getByLabelText(/코드/i) as HTMLInputElement
      const nameInput = within(modal).getByLabelText(/이름/i) as HTMLInputElement

      expect(codeInput.value).toBe('T001')
      expect(nameInput.value).toBe('무단 접근')
    })

    it('위협을 성공적으로 수정할 수 있어야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: /수정/i })
      await user.click(editButtons[0])

      const modal = screen.getByRole('dialog')
      const nameInput = within(modal).getByLabelText(/이름/i)

      await user.clear(nameInput)
      await user.type(nameInput, '수정된 위협')

      const submitButton = within(modal).getByRole('button', { name: /확인/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('위협이 수정되었습니다')).toBeInTheDocument()
      })
    })

    it('기본 위협은 수정 버튼이 비활성화되어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      // 기본 위협(is_custom: false)의 수정 버튼은 비활성화
      const rows = screen.getAllByRole('row')
      const firstThreatRow = rows.find((row) => row.textContent?.includes('무단 접근'))

      if (firstThreatRow) {
        const editButton = within(firstThreatRow).getByRole('button', { name: /수정/i })
        expect(editButton).toBeDisabled()
      }
    })
  })

  describe('위협 삭제', () => {
    it('삭제 버튼 클릭 시 확인 모달이 표시되어야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('커스텀 위협')).toBeInTheDocument()
      })

      // 커스텀 위협의 삭제 버튼만 활성화
      const deleteButtons = screen.getAllByRole('button', { name: /삭제/i })
      const customThreatDeleteButton = deleteButtons.find((btn) => !btn.hasAttribute('disabled'))

      if (customThreatDeleteButton) {
        await user.click(customThreatDeleteButton)

        await waitFor(() => {
          expect(screen.getByText('위협 삭제')).toBeInTheDocument()
          expect(screen.getByText(/이 위협을 삭제하시겠습니까?/i)).toBeInTheDocument()
        })
      }
    })

    it('위협을 성공적으로 삭제할 수 있어야 함', async () => {
      const user = userEvent.setup()
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('커스텀 위협')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: /삭제/i })
      const customThreatDeleteButton = deleteButtons.find((btn) => !btn.hasAttribute('disabled'))

      if (customThreatDeleteButton) {
        await user.click(customThreatDeleteButton)

        await waitFor(() => {
          expect(screen.getByText('위협 삭제')).toBeInTheDocument()
        })

        const confirmButton = screen.getByRole('button', { name: /확인/i })
        await user.click(confirmButton)

        await waitFor(() => {
          expect(screen.getByText('위협이 삭제되었습니다')).toBeInTheDocument()
        })
      }
    })

    it('기본 위협은 삭제 버튼이 비활성화되어야 함', async () => {
      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText('무단 접근')).toBeInTheDocument()
      })

      const rows = screen.getAllByRole('row')
      const firstThreatRow = rows.find((row) => row.textContent?.includes('무단 접근'))

      if (firstThreatRow) {
        const deleteButton = within(firstThreatRow).getByRole('button', { name: /삭제/i })
        expect(deleteButton).toBeDisabled()
      }
    })
  })

  describe('에러 처리', () => {
    it('API 에러 발생 시 에러 메시지가 표시되어야 함', async () => {
      server.use(
        http.get('/api/v1/threats', () => {
          return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
        })
      )

      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText(/위협 목록을 불러오는데 실패했습니다/i)).toBeInTheDocument()
      })
    })

    it('네트워크 에러 발생 시 적절한 메시지가 표시되어야 함', async () => {
      server.use(
        http.get('/api/v1/threats', () => {
          return HttpResponse.error()
        })
      )

      renderWithRouter(<ThreatDBPage />)

      await waitFor(() => {
        expect(screen.getByText(/위협 목록을 불러오는데 실패했습니다/i)).toBeInTheDocument()
      })
    })
  })
})
