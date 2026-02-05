/**
 * AssetFilter 컴포넌트 테스트
 * TDD: RED -> GREEN -> REFACTOR
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssetFilter from './AssetFilter'
import type { AssetType, AssetFilterParams, AssetStatus } from '@/types'

// 테스트용 Mock 데이터
const mockAssetTypes: AssetType[] = [
  { id: 1, code: 'SERVER', name: '서버', sortOrder: 1, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 2, code: 'NETWORK', name: '네트워크장비', sortOrder: 2, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 3, code: 'PC', name: 'PC/노트북', sortOrder: 3, isCustom: false, isActive: true, createdAt: '2024-01-01' },
  { id: 4, code: 'DOCUMENT', name: '문서', sortOrder: 4, isCustom: false, isActive: true, createdAt: '2024-01-01' },
]

const defaultFilters: AssetFilterParams = {}

const filtersWithValues: AssetFilterParams = {
  search: '테스트 검색어',
  assetTypeId: 1,
  status: 'operating' as AssetStatus,
  importanceLevel: 3,
}

const defaultProps = {
  filters: defaultFilters,
  assetTypes: mockAssetTypes,
  onSearchChange: vi.fn(),
  onAssetTypeChange: vi.fn(),
  onStatusChange: vi.fn(),
  onImportanceChange: vi.fn(),
}

describe('AssetFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('검색 입력 필드', () => {
    it('검색 입력 필드를 렌더링한다', async () => {
      render(<AssetFilter {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('자산명, 자산코드로 검색')).toBeInTheDocument()
      })
    })

    it('검색 아이콘을 표시한다', async () => {
      render(<AssetFilter {...defaultProps} />)

      await waitFor(() => {
        // SearchOutlined 아이콘 확인
        const searchIcon = document.querySelector('.anticon-search')
        expect(searchIcon).toBeInTheDocument()
      })
    })

    it('검색어 입력 시 onSearchChange 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      const onSearchChange = vi.fn()
      render(<AssetFilter {...defaultProps} onSearchChange={onSearchChange} />)

      const searchInput = screen.getByPlaceholderText('자산명, 자산코드로 검색')
      await user.type(searchInput, '서버')

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalled()
        // 각 글자 입력마다 호출됨
        expect(onSearchChange).toHaveBeenCalledWith('서')
      })
    })

    it('초기 검색어 값을 표시한다', async () => {
      render(<AssetFilter {...defaultProps} filters={filtersWithValues} />)

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('자산명, 자산코드로 검색')
        expect(searchInput).toHaveValue('테스트 검색어')
      })
    })

    it('allowClear 속성으로 검색어 초기화가 가능하다', async () => {
      render(<AssetFilter {...defaultProps} filters={filtersWithValues} />)

      await waitFor(() => {
        // clear 버튼 확인 (allowClear=true)
        const clearButton = document.querySelector('.ant-input-clear-icon')
        expect(clearButton).toBeInTheDocument()
      })
    })
  })

  describe('자산 유형 셀렉트', () => {
    it('자산 유형 셀렉트를 렌더링한다', async () => {
      render(<AssetFilter {...defaultProps} />)

      await waitFor(() => {
        // placeholder로 셀렉트 찾기
        const selects = screen.getAllByRole('combobox')
        expect(selects.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('자산 유형 옵션을 표시한다', async () => {
      const user = userEvent.setup()
      render(<AssetFilter {...defaultProps} />)

      // 첫 번째 셀렉트 (자산 유형)
      const selects = screen.getAllByRole('combobox')
      await user.click(selects[0])

      await waitFor(() => {
        expect(screen.getByText('서버')).toBeInTheDocument()
        expect(screen.getByText('네트워크장비')).toBeInTheDocument()
        expect(screen.getByText('PC/노트북')).toBeInTheDocument()
        expect(screen.getByText('문서')).toBeInTheDocument()
      })
    })

    it('자산 유형 선택 시 onAssetTypeChange 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      const onAssetTypeChange = vi.fn()
      render(<AssetFilter {...defaultProps} onAssetTypeChange={onAssetTypeChange} />)

      const selects = screen.getAllByRole('combobox')
      await user.click(selects[0])

      await waitFor(() => {
        expect(screen.getByText('서버')).toBeInTheDocument()
      })

      await user.click(screen.getByText('서버'))

      await waitFor(() => {
        // Ant Design Select는 value를 첫 번째 인자로 전달
        expect(onAssetTypeChange).toHaveBeenCalled()
        const firstArg = onAssetTypeChange.mock.calls[0][0]
        expect(firstArg).toBe(1)
      })
    })

    it('초기 자산 유형 값을 표시한다', async () => {
      render(<AssetFilter {...defaultProps} filters={filtersWithValues} />)

      await waitFor(() => {
        // 서버가 선택되어 있어야 함 (assetTypeId: 1)
        expect(screen.getByTitle('서버') || screen.getByText('서버')).toBeInTheDocument()
      })
    })
  })

  describe('상태 셀렉트', () => {
    it('상태 셀렉트를 렌더링한다', async () => {
      render(<AssetFilter {...defaultProps} />)

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox')
        expect(selects.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('상태 옵션을 표시한다', async () => {
      const user = userEvent.setup()
      render(<AssetFilter {...defaultProps} />)

      // 두 번째 셀렉트 (상태)
      const selects = screen.getAllByRole('combobox')
      await user.click(selects[1])

      await waitFor(() => {
        expect(screen.getByText('도입')).toBeInTheDocument()
        expect(screen.getByText('운영')).toBeInTheDocument()
        expect(screen.getByText('변경')).toBeInTheDocument()
        expect(screen.getByText('폐기')).toBeInTheDocument()
      })
    })

    it('상태 선택 시 onStatusChange 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      const onStatusChange = vi.fn()
      render(<AssetFilter {...defaultProps} onStatusChange={onStatusChange} />)

      const selects = screen.getAllByRole('combobox')
      await user.click(selects[1])

      await waitFor(() => {
        expect(screen.getByText('운영')).toBeInTheDocument()
      })

      await user.click(screen.getByText('운영'))

      await waitFor(() => {
        // Ant Design Select는 value와 option 객체를 함께 전달할 수 있음
        expect(onStatusChange).toHaveBeenCalled()
        const firstArg = onStatusChange.mock.calls[0][0]
        expect(firstArg).toBe('operating')
      })
    })

    it('초기 상태 값을 표시한다', async () => {
      render(<AssetFilter {...defaultProps} filters={filtersWithValues} />)

      await waitFor(() => {
        // 운영이 선택되어 있어야 함
        expect(screen.getByTitle('운영') || screen.getByText('운영')).toBeInTheDocument()
      })
    })
  })

  describe('중요도 셀렉트', () => {
    it('중요도 셀렉트를 렌더링한다', async () => {
      render(<AssetFilter {...defaultProps} />)

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox')
        expect(selects.length).toBeGreaterThanOrEqual(3)
      })
    })

    it('중요도 옵션을 표시한다 (상/중/하)', async () => {
      const user = userEvent.setup()
      render(<AssetFilter {...defaultProps} />)

      // 세 번째 셀렉트 (중요도)
      const selects = screen.getAllByRole('combobox')
      await user.click(selects[2])

      await waitFor(() => {
        expect(screen.getByText('상')).toBeInTheDocument()
        expect(screen.getByText('중')).toBeInTheDocument()
        expect(screen.getByText('하')).toBeInTheDocument()
      })
    })

    it('중요도 선택 시 onImportanceChange 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      const onImportanceChange = vi.fn()
      render(<AssetFilter {...defaultProps} onImportanceChange={onImportanceChange} />)

      const selects = screen.getAllByRole('combobox')
      await user.click(selects[2])

      await waitFor(() => {
        expect(screen.getByText('상')).toBeInTheDocument()
      })

      await user.click(screen.getByText('상'))

      await waitFor(() => {
        expect(onImportanceChange).toHaveBeenCalled()
        const firstArg = onImportanceChange.mock.calls[0][0]
        expect(firstArg).toBe(3)
      })
    })

    it('초기 중요도 값을 표시한다', async () => {
      render(<AssetFilter {...defaultProps} filters={filtersWithValues} />)

      await waitFor(() => {
        // 상(3)이 선택되어 있어야 함
        expect(screen.getByTitle('상') || screen.getByText('상')).toBeInTheDocument()
      })
    })
  })

  describe('셀렉트 공통 기능', () => {
    it('모든 셀렉트에 allowClear가 적용되어 있다', async () => {
      render(<AssetFilter {...defaultProps} filters={filtersWithValues} />)

      await waitFor(() => {
        // clear 버튼들 확인 (allowClear=true인 셀렉트)
        const clearIcons = document.querySelectorAll('.ant-select-clear')
        expect(clearIcons.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('필터 초기화', () => {
    it('빈 필터로 시작할 때 placeholder를 표시한다', async () => {
      render(<AssetFilter {...defaultProps} />)

      await waitFor(() => {
        // 검색 필드 placeholder
        expect(screen.getByPlaceholderText('자산명, 자산코드로 검색')).toBeInTheDocument()
      })
    })
  })

  describe('레이아웃', () => {
    it('Row와 Col로 반응형 레이아웃을 구성한다', async () => {
      render(<AssetFilter {...defaultProps} />)

      await waitFor(() => {
        // Ant Design Row 확인
        const row = document.querySelector('.ant-row')
        expect(row).toBeInTheDocument()

        // 각 Col 확인
        const cols = document.querySelectorAll('.ant-col')
        expect(cols.length).toBeGreaterThanOrEqual(4)
      })
    })
  })

  describe('셀렉트 필터 해제', () => {
    it('셀렉트에 clear 버튼이 있다', async () => {
      render(
        <AssetFilter
          {...defaultProps}
          filters={filtersWithValues}
        />
      )

      await waitFor(() => {
        // clear 아이콘 찾기 (allowClear가 설정된 셀렉트)
        const clearIcons = document.querySelectorAll('.ant-select-clear')
        expect(clearIcons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('검색 입력 이벤트', () => {
    it('onChange 이벤트로 검색어를 전달한다', async () => {
      const onSearchChange = vi.fn()
      render(<AssetFilter {...defaultProps} onSearchChange={onSearchChange} />)

      const searchInput = screen.getByPlaceholderText('자산명, 자산코드로 검색')

      fireEvent.change(searchInput, { target: { value: '테스트' } })

      await waitFor(() => {
        expect(onSearchChange).toHaveBeenCalledWith('테스트')
      })
    })
  })
})
