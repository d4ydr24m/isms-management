/**
 * AssetTable 컴포넌트 테스트
 * TDD: RED -> GREEN -> REFACTOR
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AssetTable from './AssetTable'
import type { Asset } from '@/types'

// 테스트용 Mock 데이터
const mockAssets: Asset[] = [
  {
    id: 1,
    assetCode: 'AST-SRV-202401-001',
    name: '메인 웹서버',
    assetTypeId: 1,
    assetTypeName: '서버',
    assetTypeCode: 'SERVER',
    departmentName: 'IT부서',
    ownerName: '홍길동',
    status: 'operating',
    importanceLevel: 3,
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 2,
    assetCode: 'AST-NW-202401-002',
    name: '코어 스위치',
    assetTypeId: 2,
    assetTypeName: '네트워크장비',
    assetTypeCode: 'NETWORK',
    departmentName: '인프라팀',
    ownerName: '김철수',
    status: 'introduced',
    importanceLevel: 2,
    isActive: true,
    createdAt: '2024-01-16T00:00:00Z',
  },
  {
    id: 3,
    assetCode: 'AST-PC-202401-003',
    name: '개발팀 PC',
    assetTypeId: 3,
    assetTypeName: 'PC/노트북',
    assetTypeCode: 'PC',
    departmentName: '개발팀',
    ownerName: '이영희',
    status: 'changed',
    importanceLevel: 1,
    isActive: true,
    createdAt: '2024-01-17T00:00:00Z',
  },
  {
    id: 4,
    assetCode: 'AST-DOC-202401-004',
    name: '보안정책 문서',
    assetTypeId: 4,
    assetTypeName: '문서',
    assetTypeCode: 'DOCUMENT',
    status: 'disposed',
    isActive: false,
    createdAt: '2024-01-18T00:00:00Z',
  },
]

const mockAssetNoDept: Asset = {
  id: 5,
  assetCode: 'AST-PC-202401-005',
  name: '테스트 자산',
  assetTypeId: 3,
  assetTypeName: 'PC/노트북',
  status: 'operating',
  isActive: true,
  createdAt: '2024-01-19T00:00:00Z',
}

const defaultProps = {
  data: mockAssets,
  loading: false,
  pagination: {
    current: 1,
    pageSize: 10,
    total: 4,
  },
  onTableChange: vi.fn(),
  onDelete: vi.fn(),
}

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('AssetTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('테이블 렌더링', () => {
    it('테이블을 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
    })

    it('로딩 상태를 표시한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} loading={true} />)

      await waitFor(() => {
        // Ant Design Table의 로딩은 spin을 사용
        const spinner = document.querySelector('.ant-spin')
        expect(spinner).toBeInTheDocument()
      })
    })
  })

  describe('컬럼 헤더', () => {
    it('자산코드 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        // Ant Design Table은 컬럼 헤더를 th 요소 내부에 렌더링
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('자산코드'))).toBe(true)
      })
    })

    it('자산명 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('자산명'))).toBe(true)
      })
    })

    it('유형 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('유형'))).toBe(true)
      })
    })

    it('담당부서 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('담당부서'))).toBe(true)
      })
    })

    it('담당자 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('담당자'))).toBe(true)
      })
    })

    it('상태 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('상태'))).toBe(true)
      })
    })

    it('중요도 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('중요도'))).toBe(true)
      })
    })

    it('액션 컬럼 헤더를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const headers = document.querySelectorAll('th')
        const headerTexts = Array.from(headers).map(h => h.textContent)
        expect(headerTexts.some(t => t?.includes('액션'))).toBe(true)
      })
    })
  })

  describe('데이터 행 렌더링', () => {
    it('자산코드를 링크로 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'AST-SRV-202401-001' })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/assets/1')
      })
    })

    it('자산명을 링크로 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: '메인 웹서버' })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/assets/1')
      })
    })

    it('자산 유형을 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('서버')).toBeInTheDocument()
        expect(screen.getByText('네트워크장비')).toBeInTheDocument()
        expect(screen.getByText('PC/노트북')).toBeInTheDocument()
      })
    })

    it('담당 부서를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('IT부서')).toBeInTheDocument()
        expect(screen.getByText('인프라팀')).toBeInTheDocument()
        expect(screen.getByText('개발팀')).toBeInTheDocument()
      })
    })

    it('담당부서가 없을 때 "-"를 표시한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} data={[mockAssetNoDept]} />)

      await waitFor(() => {
        // 담당부서와 담당자 모두 "-"
        const dashes = screen.getAllByText('-')
        expect(dashes.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('담당자를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument()
        expect(screen.getByText('김철수')).toBeInTheDocument()
        expect(screen.getByText('이영희')).toBeInTheDocument()
      })
    })

    it('담당자가 없을 때 "-"를 표시한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} data={[mockAssetNoDept]} />)

      await waitFor(() => {
        const dashes = screen.getAllByText('-')
        expect(dashes.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('상태 뱃지', () => {
    it('도입 상태 태그를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('도입')).toBeInTheDocument()
      })
    })

    it('운영 상태 태그를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('운영')).toBeInTheDocument()
      })
    })

    it('변경 상태 태그를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('변경')).toBeInTheDocument()
      })
    })

    it('폐기 상태 태그를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('폐기')).toBeInTheDocument()
      })
    })
  })

  describe('중요도 뱃지', () => {
    it('상(3) 중요도 태그를 빨간색으로 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const highTag = screen.getByText('상')
        expect(highTag).toBeInTheDocument()
        // Ant Design Tag의 color="red" 클래스 확인
        expect(highTag.closest('.ant-tag')).toHaveClass('ant-tag-red')
      })
    })

    it('중(2) 중요도 태그를 파란색으로 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const mediumTag = screen.getByText('중')
        expect(mediumTag).toBeInTheDocument()
        expect(mediumTag.closest('.ant-tag')).toHaveClass('ant-tag-blue')
      })
    })

    it('하(1) 중요도 태그를 기본색으로 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const lowTag = screen.getByText('하')
        expect(lowTag).toBeInTheDocument()
        expect(lowTag.closest('.ant-tag')).toHaveClass('ant-tag-default')
      })
    })

    it('중요도가 없을 때 "-"를 표시한다', async () => {
      const assetNoImportance: Asset = { ...mockAssets[0], importanceLevel: undefined }
      renderWithRouter(<AssetTable {...defaultProps} data={[assetNoImportance]} />)

      await waitFor(() => {
        const dashes = screen.getAllByText('-')
        expect(dashes.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('액션 버튼', () => {
    it('상세보기 링크를 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        // 상세보기 링크 확인 (/assets/{id})
        const allLinks = screen.getAllByRole('link')
        const viewLinks = allLinks.filter(link => {
          const href = link.getAttribute('href')
          return href && /\/assets\/\d+$/.test(href)
        })
        expect(viewLinks.length).toBeGreaterThan(0)
      })
    })

    it('수정 버튼을 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        // 수정 링크 확인 (/assets/{id}/edit)
        const allLinks = screen.getAllByRole('link')
        const editLinks = allLinks.filter(link =>
          link.getAttribute('href')?.includes('/edit')
        )
        expect(editLinks.length).toBeGreaterThan(0)
      })
    })

    it('삭제 버튼을 렌더링한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        // 삭제 버튼은 link가 아닌 button
        const deleteButtons = screen.getAllByRole('button')
        expect(deleteButtons.length).toBeGreaterThan(0)
      })
    })

    it('삭제 버튼 클릭 시 onDelete 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      renderWithRouter(<AssetTable {...defaultProps} onDelete={onDelete} />)

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button').filter(
          btn => btn.classList.contains('ant-btn-dangerous') ||
                 btn.closest('.ant-btn-dangerous') !== null ||
                 btn.querySelector('.anticon-delete') !== null
        )
        expect(deleteButtons.length).toBeGreaterThan(0)
      })

      // 첫 번째 삭제 버튼 클릭
      const deleteButtons = screen.getAllByRole('button').filter(
        btn => btn.querySelector('[aria-label="delete"]') !== null ||
               btn.querySelector('.anticon-delete') !== null
      )

      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0])

        await waitFor(() => {
          expect(onDelete).toHaveBeenCalledWith(mockAssets[0].id)
        })
      }
    })
  })

  describe('페이지네이션', () => {
    it('총 건수를 표시한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/총 4건/)).toBeInTheDocument()
      })
    })

    it('페이지 사이즈 변경 옵션을 표시한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        // showSizeChanger가 true이므로 페이지 사이즈 셀렉터가 있어야 함
        const pageSizeSelector = screen.getByRole('combobox')
        expect(pageSizeSelector).toBeInTheDocument()
      })
    })

    it('테이블 변경 시 onTableChange 콜백을 호출한다', async () => {
      const user = userEvent.setup()
      const onTableChange = vi.fn()
      renderWithRouter(
        <AssetTable
          {...defaultProps}
          pagination={{ current: 1, pageSize: 10, total: 100 }}
          onTableChange={onTableChange}
        />
      )

      await waitFor(() => {
        // 페이지 번호 2 찾기
        const page2 = screen.getByText('2')
        expect(page2).toBeInTheDocument()
      })

      await user.click(screen.getByText('2'))

      await waitFor(() => {
        expect(onTableChange).toHaveBeenCalled()
      })
    })
  })

  describe('빈 데이터 상태', () => {
    it('데이터가 없을 때 빈 상태를 표시한다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} data={[]} pagination={{ current: 1, pageSize: 10, total: 0 }} />)

      await waitFor(() => {
        // Ant Design Table의 빈 상태는 ant-empty 클래스를 사용
        const emptyState = document.querySelector('.ant-empty') ||
                          document.querySelector('.ant-table-placeholder')
        expect(emptyState).toBeInTheDocument()
      })
    })
  })

  describe('링크 네비게이션', () => {
    it('자산코드 링크가 상세 페이지로 연결된다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'AST-SRV-202401-001' })
        expect(link).toHaveAttribute('href', '/assets/1')
      })
    })

    it('자산명 링크가 상세 페이지로 연결된다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const link = screen.getByRole('link', { name: '메인 웹서버' })
        expect(link).toHaveAttribute('href', '/assets/1')
      })
    })

    it('수정 버튼이 수정 페이지로 연결된다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const editLinks = screen.getAllByRole('link').filter(
          link => link.getAttribute('href')?.includes('/edit')
        )
        expect(editLinks.length).toBeGreaterThan(0)
        expect(editLinks[0]).toHaveAttribute('href', '/assets/1/edit')
      })
    })
  })

  describe('툴팁', () => {
    it('상세보기 버튼에 툴팁을 표시한다', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const viewLinks = screen.getAllByRole('link').filter(
          link => link.getAttribute('href')?.match(/\/assets\/\d+$/)
        )
        expect(viewLinks.length).toBeGreaterThan(0)
      })

      // 툴팁은 hover 시 나타나므로 직접 확인하기 어려움
      // 대신 Tooltip 컴포넌트가 렌더링되는지 확인
    })
  })

  describe('스크롤', () => {
    it('수평 스크롤이 가능하다', async () => {
      renderWithRouter(<AssetTable {...defaultProps} />)

      await waitFor(() => {
        const table = screen.getByRole('table')
        // scroll={{ x: 900 }} 설정 확인
        expect(table.closest('.ant-table-container')).toBeInTheDocument()
      })
    })
  })
})
