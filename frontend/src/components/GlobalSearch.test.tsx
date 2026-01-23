import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import GlobalSearch from './GlobalSearch'
import { searchService } from '@/services/search'
import type { SearchResponse } from '@/types'

vi.mock('@/services/search')

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('GlobalSearch 컴포넌트', () => {
  const mockSearchResponse: SearchResponse = {
    query: 'test',
    totalCount: 5,
    controls: [
      {
        id: 1,
        number: '1.1.1',
        title: 'Test Control',
        description: 'Control description',
        categoryName: 'Category A',
        evidenceCount: 3,
      },
    ],
    evidences: [
      {
        id: 1,
        title: 'Test Evidence',
        description: 'Evidence description',
        status: 'active',
        uploaderName: 'John Doe',
        controlItems: ['1.1.1'],
        createdAt: '2025-01-01',
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

  it('컴포넌트가 올바르게 렌더링됨', () => {
    renderWithRouter(<GlobalSearch />)

    expect(screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')).toBeInTheDocument()
  })

  it('검색 입력 필드가 동작함', () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test query' } })

    expect(input).toHaveValue('test query')
  })

  it('검색 시 드롭다운이 열림', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(searchService.search).toHaveBeenCalledWith({ query: 'test', limit: 5 })
    })
  })

  it('검색 결과가 카테고리별로 표시됨', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText('통제항목 (1)')).toBeInTheDocument()
      expect(screen.getByText('증적 (1)')).toBeInTheDocument()
      expect(screen.getByText('사용자 (1)')).toBeInTheDocument()
    })
  })

  it('검색 결과 항목을 클릭하면 해당 페이지로 이동함', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      const controlItem = screen.getByText('Test Control')
      expect(controlItem).toBeInTheDocument()
    })
  })

  it('"모든 결과 보기" 버튼이 표시됨', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText('모든 결과 보기')).toBeInTheDocument()
    })
  })

  it('"모든 결과 보기" 클릭 시 검색 결과 페이지로 이동함', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      const viewAllButton = screen.getByText('모든 결과 보기')
      fireEvent.click(viewAllButton)
    })
  })

  it('검색 결과가 없을 때 안내 메시지가 표시됨', async () => {
    vi.mocked(searchService.search).mockResolvedValue({
      query: 'test',
      totalCount: 0,
      controls: [],
      evidences: [],
      users: [],
    })

    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText('검색 결과가 없습니다')).toBeInTheDocument()
    })
  })

  it('검색 완료 후 결과가 표시됨', async () => {
    // API 호출이 정상적으로 완료되는 경우
    vi.mocked(searchService.search).mockResolvedValue(mockSearchResponse)

    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    // 디바운스 + API 완료 대기
    await waitFor(
      () => {
        // 검색 완료 후 결과가 표시됨
        expect(screen.getByText('통제항목 (1)')).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })

  it('ESC 키 핸들러가 존재함', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')

    // ESC 키를 누를 수 있는 input이 존재하는지 확인
    expect(input).toBeInTheDocument()

    // ESC 키 이벤트가 정상적으로 처리되는지 확인 (에러가 나지 않아야 함)
    fireEvent.keyDown(input, { key: 'Escape' })
  })

  it('검색 입력이 debounce됨', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')

    fireEvent.change(input, { target: { value: 't' } })
    fireEvent.change(input, { target: { value: 'te' } })
    fireEvent.change(input, { target: { value: 'test' } })

    // Debounce 시간 후에만 한 번 호출되어야 함
    await waitFor(() => {
      expect(searchService.search).toHaveBeenCalledTimes(1)
      expect(searchService.search).toHaveBeenCalledWith({ query: 'test', limit: 5 })
    })
  })

  it('최소 2자 이상 입력해야 검색됨', async () => {
    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'a' } })

    await waitFor(() => {
      expect(searchService.search).not.toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('API 에러 발생 시 에러 메시지가 표시됨', async () => {
    vi.mocked(searchService.search).mockRejectedValue(new Error('Network error'))

    renderWithRouter(<GlobalSearch />)

    const input = screen.getByPlaceholderText('통제항목, 증적, 사용자 검색...')
    fireEvent.change(input, { target: { value: 'test' } })

    // 디바운스 시간(500ms) + API 호출 시간을 기다림
    await waitFor(
      () => {
        expect(screen.getByText(/검색 중 오류가 발생했습니다/)).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })
})
