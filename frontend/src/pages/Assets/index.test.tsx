/**
 * 자산 목록 페이지 테스트
 * TDD: RED -> GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AssetListPage from './index'

// Mock navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

// Mock asset service
vi.mock('@/services/assets', () => ({
  assetService: {
    getAssets: vi.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          assetCode: 'AST-SRV-202401-001',
          name: '메인 웹서버',
          assetTypeName: '서버',
          assetTypeCode: 'SERVER',
          departmentName: 'IT부서',
          ownerName: '김담당',
          status: 'operating',
          importanceLevel: 3,
          createdAt: '2024-01-15',
        },
        {
          id: 2,
          assetCode: 'AST-NET-202401-001',
          name: '백본 스위치',
          assetTypeName: '네트워크 장비',
          assetTypeCode: 'NETWORK',
          departmentName: 'IT부서',
          ownerName: '이관리',
          status: 'operating',
          importanceLevel: 2,
          createdAt: '2024-01-20',
        },
      ],
      total: 2,
      page: 1,
      size: 10,
      pages: 1,
    }),
    getAssetTypes: vi.fn().mockResolvedValue({
      items: [
        { id: 1, code: 'SERVER', name: '서버', isCustom: false, isActive: true },
        { id: 2, code: 'NETWORK', name: '네트워크 장비', isCustom: false, isActive: true },
      ],
      total: 2,
    }),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    exportAssets: vi.fn().mockResolvedValue(undefined),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <AssetListPage />
    </MemoryRouter>
  )
}

describe('AssetListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', async () => {
      renderWithRouter()

      expect(screen.getByText('정보자산 관리')).toBeInTheDocument()
    })

    it('should render create button', () => {
      renderWithRouter()

      expect(screen.getByText(/자산 등록/i)).toBeInTheDocument()
    })

    it('should render import button', () => {
      renderWithRouter()

      expect(screen.getByText(/일괄 등록/i)).toBeInTheDocument()
    })

    it('should render search input', () => {
      renderWithRouter()

      expect(screen.getByPlaceholderText(/자산명, 자산코드로 검색/i)).toBeInTheDocument()
    })

    it('should render asset type filter', () => {
      renderWithRouter()

      expect(screen.getByText(/자산 유형/i)).toBeInTheDocument()
    })

    it('should render status filter', () => {
      renderWithRouter()

      // 상태 필터 셀렉트 박스가 있는지 확인 (중요도 필터와 함께 2개의 빈 셀렉트 확인)
      const selects = document.querySelectorAll('.ant-select')
      expect(selects.length).toBeGreaterThanOrEqual(2)
    })

    it('should display asset data in table after load', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('메인 웹서버')).toBeInTheDocument()
          expect(screen.getByText('백본 스위치')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Table Structure', () => {
    it('should render table with data', async () => {
      renderWithRouter()

      // Wait for the table to load data
      await waitFor(
        () => {
          expect(screen.getByText('메인 웹서버')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )

      // Check that table exists
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
    })

    it('should display asset codes', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('AST-SRV-202401-001')).toBeInTheDocument()
          expect(screen.getByText('AST-NET-202401-001')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should display importance level badges', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          // 중요도 표시 확인 (상/중/하)
          expect(screen.getByText('상')).toBeInTheDocument()
          expect(screen.getByText('중')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })
})
