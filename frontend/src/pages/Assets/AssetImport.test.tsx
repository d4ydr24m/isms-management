/**
 * 자산 임포트 페이지 테스트
 * TDD: RED -> GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AssetImportPage from './AssetImport'

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
    downloadTemplate: vi.fn().mockResolvedValue(undefined),
    importAssets: vi.fn().mockResolvedValue({
      total: 10,
      success: 8,
      failed: 2,
      errors: [
        { row: 3, field: 'ipAddress', message: '잘못된 IP 주소 형식' },
        { row: 7, message: '필수 필드 누락' },
      ],
    }),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <AssetImportPage />
    </MemoryRouter>
  )
}

describe('AssetImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText(/자산 일괄 등록/)).toBeInTheDocument()
      })
    })

    it('should render steps', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('파일 업로드')).toBeInTheDocument()
        expect(screen.getByText('처리 중')).toBeInTheDocument()
        expect(screen.getByText('결과 확인')).toBeInTheDocument()
      })
    })

    it('should render template download button', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('임포트 템플릿 다운로드')).toBeInTheDocument()
      })
    })

    it('should render file upload area', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText(/클릭하거나 파일을 이 영역으로 드래그/)).toBeInTheDocument()
      })
    })

    it('should render import guide', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('임포트 안내')).toBeInTheDocument()
      })
    })

    it('should render cancel button', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('취소')).toBeInTheDocument()
      })
    })

    it('should render import button', async () => {
      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText('임포트 실행')).toBeInTheDocument()
      })
    })
  })
})
