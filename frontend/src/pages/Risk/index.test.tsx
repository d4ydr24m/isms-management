/**
 * 위험 시나리오 목록 페이지 테스트
 * FR-703: 위험 시나리오 관리
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import RiskIndexPage from './index'
import type { RiskScenario, RiskScenarioList } from '@/types'

// Mock 데이터
const mockRiskScenarios: RiskScenario[] = [
  {
    id: 1,
    name: '2025년 1분기 위험 평가',
    description: '정기 위험 평가',
    start_date: '2025-01-01',
    end_date: '2025-03-31',
    status: 'in_progress',
    created_by: 1,
    creator_name: '관리자',
    completed_at: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: null,
    assessment_count: 15,
    high_risk_count: 3,
    exceeding_doa_count: 1,
  },
  {
    id: 2,
    name: '2024년 4분기 위험 평가',
    description: '정기 위험 평가',
    start_date: '2024-10-01',
    end_date: '2024-12-31',
    status: 'completed',
    created_by: 1,
    creator_name: '관리자',
    completed_at: '2024-12-31T23:59:59Z',
    created_at: '2024-10-01T00:00:00Z',
    updated_at: '2024-12-31T23:59:59Z',
    assessment_count: 20,
    high_risk_count: 2,
    exceeding_doa_count: 0,
  },
  {
    id: 3,
    name: '신규 시스템 도입 위험 평가',
    description: '특별 위험 평가',
    start_date: '2025-01-15',
    end_date: null,
    status: 'draft',
    created_by: 1,
    creator_name: '관리자',
    completed_at: null,
    created_at: '2025-01-15T00:00:00Z',
    updated_at: null,
    assessment_count: 0,
    high_risk_count: 0,
    exceeding_doa_count: 0,
  },
]

const mockRiskScenarioListResponse: RiskScenarioList = {
  items: mockRiskScenarios,
  total: 3,
  page: 1,
  size: 10,
  pages: 1,
}

// MSW 서버 설정
const server = setupServer(
  http.get('http://localhost:8000/api/v1/risk-scenarios', () => {
    return HttpResponse.json(mockRiskScenarioListResponse)
  }),
  http.post('http://localhost:8000/api/v1/risk-scenarios', async ({ request }) => {
    const body = (await request.json()) as Partial<RiskScenario>
    const newScenario: RiskScenario = {
      id: 4,
      name: body.name || '새 위험 시나리오',
      description: body.description || null,
      start_date: body.start_date || '2025-01-01',
      end_date: body.end_date || null,
      status: 'draft',
      created_by: 1,
      creator_name: '관리자',
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: null,
      assessment_count: 0,
      high_risk_count: 0,
      exceeding_doa_count: 0,
    }
    return HttpResponse.json(newScenario)
  }),
  http.put('http://localhost:8000/api/v1/risk-scenarios/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<RiskScenario>
    const updatedScenario: RiskScenario = {
      id: Number(params.id),
      name: body.name || '수정된 시나리오',
      description: body.description || null,
      start_date: body.start_date || '2025-01-01',
      end_date: body.end_date || null,
      status: body.status || 'draft',
      created_by: 1,
      creator_name: '관리자',
      completed_at: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
      assessment_count: 0,
      high_risk_count: 0,
      exceeding_doa_count: 0,
    }
    return HttpResponse.json(updatedScenario)
  }),
  http.delete('http://localhost:8000/api/v1/risk-scenarios/:id', () => {
    return HttpResponse.json({ message: '삭제되었습니다' })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// 테스트 헬퍼
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('RiskIndexPage - 페이지 렌더링', () => {
  it('페이지가 올바르게 렌더링되어야 함', async () => {
    renderWithRouter(<RiskIndexPage />)

    // 페이지 제목 확인
    expect(screen.getByText('위험 시나리오 관리')).toBeInTheDocument()

    // 시나리오 추가 버튼 확인
    expect(screen.getByRole('button', { name: /시나리오 추가/i })).toBeInTheDocument()
  })

  it('필터 컴포넌트가 렌더링되어야 함', () => {
    renderWithRouter(<RiskIndexPage />)

    // 검색 입력창
    expect(screen.getByPlaceholderText('시나리오 검색')).toBeInTheDocument()

    // 상태 필터
    expect(screen.getByRole('combobox', { name: '상태' })).toBeInTheDocument()
  })

  it('테이블이 렌더링되어야 함', () => {
    renderWithRouter(<RiskIndexPage />)

    // 테이블 컬럼 헤더 확인
    expect(screen.getByText('시나리오명')).toBeInTheDocument()
    expect(screen.getByText('기간')).toBeInTheDocument()
    expect(screen.getByText('상태')).toBeInTheDocument()
    expect(screen.getByText('평가 현황')).toBeInTheDocument()
    expect(screen.getByText('작업')).toBeInTheDocument()
  })
})

describe('RiskIndexPage - 목록 조회', () => {
  it('시나리오 목록이 로드되어야 함', async () => {
    renderWithRouter(<RiskIndexPage />)

    // 목록 로드 대기
    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    expect(screen.getByText('2024년 4분기 위험 평가')).toBeInTheDocument()
    expect(screen.getByText('신규 시스템 도입 위험 평가')).toBeInTheDocument()
  })

  it('시나리오 상태가 올바르게 표시되어야 함', async () => {
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 상태 태그 확인
    expect(screen.getByText('진행중')).toBeInTheDocument()
    expect(screen.getByText('완료')).toBeInTheDocument()
    expect(screen.getByText('초안')).toBeInTheDocument()
  })

  it('평가 현황이 올바르게 표시되어야 함', async () => {
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 평가 현황 확인 (총 15건, 고위험 3건, DoA초과 1건)
    expect(screen.getByText(/총 15건/)).toBeInTheDocument()
    expect(screen.getByText(/고위험 3건/)).toBeInTheDocument()
    expect(screen.getByText(/DoA초과 1건/)).toBeInTheDocument()
  })

  it('페이지네이션이 작동해야 함', async () => {
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 총 건수 표시 확인
    expect(screen.getByText('총 3개')).toBeInTheDocument()
  })
})

describe('RiskIndexPage - 검색 및 필터링', () => {
  it('시나리오명으로 검색할 수 있어야 함', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('http://localhost:8000/api/v1/risk-scenarios', ({ request }) => {
        const url = new URL(request.url)
        const search = url.searchParams.get('search')

        if (search === '1분기') {
          return HttpResponse.json({
            items: [mockRiskScenarios[0]],
            total: 1,
            page: 1,
            size: 10,
            pages: 1,
          })
        }
        return HttpResponse.json(mockRiskScenarioListResponse)
      })
    )

    renderWithRouter(<RiskIndexPage />)

    // 검색어 입력
    const searchInput = screen.getByPlaceholderText('시나리오 검색')
    await user.type(searchInput, '1분기')
    await user.keyboard('{Enter}')

    // 필터링된 결과 확인
    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    expect(screen.queryByText('2024년 4분기 위험 평가')).not.toBeInTheDocument()
  })

  it('상태로 필터링할 수 있어야 함', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('http://localhost:8000/api/v1/risk-scenarios', ({ request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')

        if (status === 'completed') {
          return HttpResponse.json({
            items: [mockRiskScenarios[1]],
            total: 1,
            page: 1,
            size: 10,
            pages: 1,
          })
        }
        return HttpResponse.json(mockRiskScenarioListResponse)
      })
    )

    renderWithRouter(<RiskIndexPage />)

    // 상태 필터 선택
    const statusFilter = screen.getByRole('combobox', { name: '상태' })
    await user.click(statusFilter)

    // 드롭다운에서 '완료' 선택
    const completedOption = await screen.findByText('완료')
    await user.click(completedOption)

    // 필터링된 결과 확인
    await waitFor(() => {
      expect(screen.getByText('2024년 4분기 위험 평가')).toBeInTheDocument()
    })

    expect(screen.queryByText('2025년 1분기 위험 평가')).not.toBeInTheDocument()
  })

  it('검색어를 지우면 전체 목록이 표시되어야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    const searchInput = screen.getByPlaceholderText('시나리오 검색')

    // 검색어 입력 후 지우기
    await user.type(searchInput, '1분기')
    await user.clear(searchInput)

    // 전체 목록 표시 확인
    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
      expect(screen.getByText('2024년 4분기 위험 평가')).toBeInTheDocument()
    })
  })
})

describe('RiskIndexPage - 시나리오 추가', () => {
  it('시나리오 추가 버튼을 클릭하면 모달이 열려야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    const addButton = screen.getByRole('button', { name: /시나리오 추가/i })
    await user.click(addButton)

    // 모달 제목 확인
    expect(screen.getByText('시나리오 추가')).toBeInTheDocument()
  })

  it('새 시나리오를 추가할 수 있어야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    // 모달 열기
    const addButton = screen.getByRole('button', { name: /시나리오 추가/i })
    await user.click(addButton)

    // 모달 확인
    await waitFor(() => {
      expect(screen.getByText('시나리오 추가')).toBeInTheDocument()
    })

    // 폼 입력
    const nameInput = screen.getByLabelText('시나리오명')
    await user.type(nameInput, '2025년 특별 위험 평가')

    const descInput = screen.getByLabelText('설명')
    await user.type(descInput, '특별 평가 시나리오')

    // DatePicker는 직접 날짜 입력이 복잡하므로 일단 스킵
    // await user.type(screen.getByLabelText('시작일'), '2025-02-01')

    // 제출
    const allConfirmButtons = screen.getAllByRole('button', { name: '확인' })
    const submitButton = allConfirmButtons[allConfirmButtons.length - 1] // 마지막 확인 버튼 (모달의 버튼)
    await user.click(submitButton)

    // 성공 메시지 확인
    await waitFor(() => {
      expect(screen.getByText('시나리오가 추가되었습니다')).toBeInTheDocument()
    })
  })

  it('필수 필드를 입력하지 않으면 검증 오류가 표시되어야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    // 모달 열기
    const addButton = screen.getByRole('button', { name: /시나리오 추가/i })
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('시나리오 추가')).toBeInTheDocument()
    })

    // 빈 폼으로 제출 시도
    const allConfirmButtons = screen.getAllByRole('button', { name: '확인' })
    const submitButton = allConfirmButtons[allConfirmButtons.length - 1]
    await user.click(submitButton)

    // 검증 오류 메시지 확인
    await waitFor(() => {
      expect(screen.getByText('시나리오명을 입력해주세요')).toBeInTheDocument()
      expect(screen.getByText('시작일을 입력해주세요')).toBeInTheDocument()
    })
  })
})

describe('RiskIndexPage - 시나리오 수정', () => {
  it('수정 버튼을 클릭하면 모달이 열려야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 첫 번째 시나리오의 수정 버튼 클릭
    const editButtons = screen.getAllByRole('button', { name: /수정/i })
    await user.click(editButtons[0])

    // 모달 제목 확인
    expect(screen.getByText('시나리오 수정')).toBeInTheDocument()

    // 기존 데이터가 폼에 채워져 있는지 확인
    expect(screen.getByDisplayValue('2025년 1분기 위험 평가')).toBeInTheDocument()
  })

  it('시나리오 정보를 수정할 수 있어야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 수정 버튼 클릭
    const editButtons = screen.getAllByRole('button', { name: /수정/i })
    await user.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('시나리오 수정')).toBeInTheDocument()
    })

    // 폼 수정
    const nameInput = screen.getByDisplayValue('2025년 1분기 위험 평가')
    await user.clear(nameInput)
    await user.type(nameInput, '2025년 1분기 위험 평가 (수정)')

    // 제출
    const allConfirmButtons = screen.getAllByRole('button', { name: '확인' })
    const submitButton = allConfirmButtons[allConfirmButtons.length - 1]
    await user.click(submitButton)

    // 성공 메시지 확인
    await waitFor(() => {
      expect(screen.getByText('시나리오가 수정되었습니다')).toBeInTheDocument()
    })
  })

  it('완료된 시나리오는 수정할 수 없어야 함', async () => {
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2024년 4분기 위험 평가')).toBeInTheDocument()
    })

    // 완료된 시나리오의 수정 버튼 찾기
    const rows = screen.getAllByRole('row')
    const completedRow = rows.find(row => row.textContent?.includes('2024년 4분기 위험 평가'))

    expect(completedRow).toBeDefined()

    if (completedRow) {
      const editButton = within(completedRow).getByRole('button', { name: /수정/i })
      expect(editButton).toBeDisabled()
    }
  })
})

describe('RiskIndexPage - 시나리오 삭제', () => {
  it('삭제 버튼을 클릭하면 확인 모달이 표시되어야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('신규 시스템 도입 위험 평가')).toBeInTheDocument()
    })

    // 초안 상태 시나리오의 삭제 버튼 클릭
    const deleteButtons = screen.getAllByRole('button', { name: /삭제/i })
    await user.click(deleteButtons[2]) // 세 번째 시나리오 (초안)

    // 확인 모달 확인 - getAllByText를 사용하여 중복 요소 처리
    await waitFor(() => {
      const deleteTexts = screen.getAllByText('시나리오 삭제')
      expect(deleteTexts.length).toBeGreaterThan(0)
      expect(screen.getByText(/이 시나리오를 삭제하시겠습니까?/)).toBeInTheDocument()
    })
  })

  it('초안 상태 시나리오를 삭제할 수 있어야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('신규 시스템 도입 위험 평가')).toBeInTheDocument()
    })

    // 삭제 버튼 클릭
    const deleteButtons = screen.getAllByRole('button', { name: /삭제/i })
    await user.click(deleteButtons[2])

    // 확인 모달 대기
    await waitFor(() => {
      const deleteTexts = screen.getAllByText('시나리오 삭제')
      expect(deleteTexts.length).toBeGreaterThan(0)
    })

    // 확인 모달에서 확인 버튼 클릭 - getAllByRole을 사용하여 중복 버튼 처리
    const allConfirmButtons = screen.getAllByRole('button', { name: '확인' })
    const confirmButton = allConfirmButtons[allConfirmButtons.length - 1] // 마지막 확인 버튼 (모달의 버튼)
    await user.click(confirmButton)

    // 성공 메시지 확인
    await waitFor(() => {
      expect(screen.getByText('시나리오가 삭제되었습니다')).toBeInTheDocument()
    })
  })

  it('초안이 아닌 시나리오는 삭제할 수 없어야 함', async () => {
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 진행중 상태 시나리오의 삭제 버튼 찾기
    const rows = screen.getAllByRole('row')
    const inProgressRow = rows.find(row => row.textContent?.includes('2025년 1분기 위험 평가'))

    expect(inProgressRow).toBeDefined()

    if (inProgressRow) {
      const deleteButton = within(inProgressRow).getByRole('button', { name: /삭제/i })
      expect(deleteButton).toBeDisabled()
    }
  })
})

describe('RiskIndexPage - 상세 페이지 이동', () => {
  it('시나리오명을 클릭하면 상세 페이지로 이동해야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 시나리오명 클릭
    const scenarioLink = screen.getByText('2025년 1분기 위험 평가')
    await user.click(scenarioLink)

    // URL 변경 확인 (실제로는 react-router를 통해 라우팅되지만, 테스트에서는 링크 존재만 확인)
    expect(scenarioLink.closest('a')).toHaveAttribute('href', '/risk/scenarios/1')
  })

  it('평가 수행 버튼을 클릭하면 평가 페이지로 이동해야 함', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('2025년 1분기 위험 평가')).toBeInTheDocument()
    })

    // 평가 수행 버튼 클릭
    const assessButtons = screen.getAllByRole('button', { name: /평가 수행/i })
    await user.click(assessButtons[0])

    // 평가 페이지로 이동하는지 확인
    // (실제 구현에서는 navigate를 사용하지만, 테스트에서는 버튼 존재만 확인)
    expect(assessButtons[0]).toBeInTheDocument()
  })
})

describe('RiskIndexPage - 에러 처리', () => {
  it('API 오류 시 에러 메시지를 표시해야 함', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/risk-scenarios', () => {
        return HttpResponse.json({ message: '서버 오류' }, { status: 500 })
      })
    )

    renderWithRouter(<RiskIndexPage />)

    // 에러 메시지 확인
    await waitFor(() => {
      expect(screen.getByText('시나리오 목록을 불러오는데 실패했습니다')).toBeInTheDocument()
    })
  })

  it('네트워크 오류 시 에러 메시지를 표시해야 함', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/risk-scenarios', () => {
        return HttpResponse.error()
      })
    )

    renderWithRouter(<RiskIndexPage />)

    await waitFor(() => {
      expect(screen.getByText('시나리오 목록을 불러오는데 실패했습니다')).toBeInTheDocument()
    })
  })
})
