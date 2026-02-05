/**
 * 자산 등록 페이지 테스트
 * TDD: RED -> GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AssetCreatePage from './AssetCreate'

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
    getAssetTypes: vi.fn().mockResolvedValue({
      items: [
        { id: 1, code: 'SERVER', name: '서버', isCustom: false, isActive: true },
        { id: 2, code: 'NETWORK', name: '네트워크 장비', isCustom: false, isActive: true },
      ],
      total: 2,
    }),
    getAssetCategories: vi.fn().mockResolvedValue({
      items: [
        { id: 1, code: 'IT', name: 'IT 자산', level: 1, isActive: true, children: [] },
      ],
      total: 1,
    }),
    createAsset: vi.fn().mockResolvedValue({
      id: 1,
      assetCode: 'AST-SRV-202401-001',
      name: '테스트 서버',
      status: 'introduced',
    }),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <AssetCreatePage />
    </MemoryRouter>
  )
}

describe('AssetCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', async () => {
      renderWithRouter()

      await waitFor(() => {
        // 카드 타이틀과 버튼 둘 다 포함됨
        const elements = screen.getAllByText('자산 등록')
        expect(elements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('should render breadcrumb', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('정보자산 관리')).toBeInTheDocument()
      })
    })

    it('should render asset name field', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('자산명')).toBeInTheDocument()
      })
    })

    it('should render asset type field', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('자산 유형')).toBeInTheDocument()
      })
    })

    it('should render submit button', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('등록')).toBeInTheDocument()
      })
    })

    it('should render cancel button', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('취소')).toBeInTheDocument()
      })
    })
  })

  describe('Form Sections', () => {
    it('should render basic info section', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('기본 정보')).toBeInTheDocument()
      })
    })

    it('should render responsibility info section', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('담당 정보')).toBeInTheDocument()
      })
    })

    it('should render manufacturing info section', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('제조/취득 정보')).toBeInTheDocument()
      })
    })
  })
})
