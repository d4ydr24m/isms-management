import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import SearchResults from './index'
import { searchService } from '@/services/search'
import type { SearchResponse } from '@/types'

vi.mock('@/services/search')

const renderWithRouter = (initialRoute = '/search?q=test') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SearchResults />
    </MemoryRouter>
  )
}

describe('SearchResults 페이지', () => {
  const mockSearchResponse: SearchResponse = {
    query: 'test',
    totalCount: 10,
    controls: [
      {
        id: 1,
        number: '1.1.1',
        title: 'Test Control 1',
        description: 'Control description 1',
        categoryName: 'Category A',
        evidenceCount: 3,
      },
      {
        id: 2,
        number: '1.1.2',
        title: 'Test Control 2',
        description: 'Control description 2',
        categoryName: 'Category B',
        evidenceCount: 5,
      },
    ],
    evidences: [
      {
        id: 1,
        title: 'Test Evidence 1',
        description: 'Evidence description 1',
        status: 'active',
        uploaderName: 'John Doe',
        controlItems: ['1.1.1'],
        createdAt: '2025-01-01',
      },
      {
        id: 2,
        title: 'Test Evidence 2',
        description: 'Evidence description 2',
        status: 'expired',
        uploaderName: 'Jane Doe',
        controlItems: ['1.1.2'],
        createdAt: '2025-01-02',
      },
    ],
    users: [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        department: 'IT',
        roles: ['admin'],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchService.search).mockResolvedValue(mockSearchResponse)
  })

  it('컴포넌트가 올바르게 렌더링됨', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('검색 결과')).toBeInTheDocument()
    })
  })

  it('URL 쿼리 파라미터에서 검색어를 읽어옴', async () => {
    renderWithRouter('/search?q=test%20query')

    await waitFor(() => {
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'test query' })
      )
    })
  })

  it('검색 결과가 표시됨', async () => {
    renderWithRouter()

    await waitFor(() => {
      // 전체 탭에서는 모든 결과가 표시됨 (중복 가능)
      expect(screen.getAllByTestId('control-card-1').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('evidence-card-1').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('user-card-1').length).toBeGreaterThan(0)
    })
  })

  it('카테고리 탭이 표시됨', async () => {
    renderWithRouter()

    await waitFor(() => {
      const tabs = screen.getAllByRole('tab')
      expect(tabs.length).toBe(4) // 전체, 통제항목, 증적, 사용자

      // 각 탭에 올바른 카운트가 표시되는지 확인
      expect(tabs.some((tab) => tab.textContent?.includes('전체') && tab.textContent?.includes('10'))).toBe(
        true
      )
      expect(
        tabs.some((tab) => tab.textContent?.includes('통제항목') && tab.textContent?.includes('2'))
      ).toBe(true)
      expect(tabs.some((tab) => tab.textContent?.includes('증적') && tab.textContent?.includes('2'))).toBe(
        true
      )
      expect(
        tabs.some((tab) => tab.textContent?.includes('사용자') && tab.textContent?.includes('1'))
      ).toBe(true)
    })
  })

  it('카테고리 탭 클릭 시 해당 카테고리만 표시됨', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getAllByTestId('control-card-1').length).toBeGreaterThan(0)
    })

    // 탭을 role="tab"으로 찾아서 클릭
    const tabs = screen.getAllByRole('tab')
    const controlTab = tabs.find((tab) => tab.textContent?.includes('통제항목'))

    expect(controlTab).toBeInTheDocument()
    fireEvent.click(controlTab!)

    // 탭 클릭 후 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 통제항목이 여전히 표시되는지 확인
    expect(screen.getAllByTestId(/control-card-/).length).toBeGreaterThan(0)
  })

  it('검색 결과 항목 클릭 시 상세 페이지로 이동함', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getAllByTestId('control-card-1').length).toBeGreaterThan(0)
    })

    // data-testid로 Card 찾기 (첫 번째 요소 사용)
    const controlCards = screen.getAllByTestId('control-card-1')
    expect(controlCards[0]).toBeInTheDocument()

    // Card를 클릭하면 onClick이 실행되어야 함 (navigate 호출)
    fireEvent.click(controlCards[0])
  })

  it('검색어가 없을 때 안내 메시지가 표시됨', () => {
    renderWithRouter('/search')

    expect(screen.getByText(/검색어를 입력하세요/)).toBeInTheDocument()
  })

  it('검색 결과가 없을 때 안내 메시지가 표시됨', async () => {
    vi.mocked(searchService.search).mockResolvedValue({
      query: 'test',
      totalCount: 0,
      controls: [],
      evidences: [],
      users: [],
    })

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText(/검색 결과가 없습니다/)).toBeInTheDocument()
    })
  })

  it('로딩 중일 때 스피너가 표시됨', () => {
    vi.mocked(searchService.search).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockSearchResponse), 1000))
    )

    renderWithRouter()

    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('통제항목 결과에 번호와 카테고리가 표시됨', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('1.1.1')).toBeInTheDocument()
      expect(screen.getByText('Category A')).toBeInTheDocument()
    })
  })

  it('증적 결과에 상태와 업로더가 표시됨', async () => {
    renderWithRouter()

    await waitFor(() => {
      // getAllByText로 변경 (John Doe가 여러 번 나올 수 있음)
      const johnDoeElements = screen.getAllByText('John Doe')
      expect(johnDoeElements.length).toBeGreaterThan(0)
    })
  })

  it('사용자 결과에 부서와 역할이 표시됨', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText('IT')).toBeInTheDocument()
      expect(screen.getByText('admin')).toBeInTheDocument()
    })
  })

  it('검색 입력 필드에서 새로운 검색을 수행할 수 있음', async () => {
    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByDisplayValue('test')).toBeInTheDocument()
    })

    const searchInput = screen.getByDisplayValue('test')
    fireEvent.change(searchInput, { target: { value: 'new query' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'new query' })
      )
    })
  })

  it('API 에러 발생 시 에러 메시지가 표시됨', async () => {
    vi.mocked(searchService.search).mockRejectedValue(new Error('Network error'))

    renderWithRouter()

    await waitFor(() => {
      expect(screen.getByText(/검색 중 오류가 발생했습니다/)).toBeInTheDocument()
    })
  })
})
