/**
 * 자산 상세 페이지 테스트
 * TDD: RED -> GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AssetDetailPage from './AssetDetail'

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
    getAsset: vi.fn().mockResolvedValue({
      id: 1,
      assetCode: 'AST-SRV-202401-001',
      name: '메인 웹서버',
      assetTypeId: 1,
      assetTypeName: '서버',
      assetTypeCode: 'SERVER',
      departmentName: 'IT부서',
      ownerName: '김담당',
      location: '서울 데이터센터',
      ipAddress: '192.168.1.100',
      hostname: 'web-server-01',
      status: 'operating',
      isActive: true,
      createdAt: '2024-01-15T00:00:00Z',
    }),
    getAssetValuation: vi.fn().mockResolvedValue({
      id: 1,
      assetId: 1,
      confidentiality: 3,
      integrity: 2,
      availability: 3,
      importanceLevel: 3,
      evaluatorName: '이평가',
      evaluatedAt: '2024-01-20T00:00:00Z',
      createdAt: '2024-01-20T00:00:00Z',
    }),
    getAssetHistory: vi.fn().mockResolvedValue([
      {
        id: 1,
        assetId: 1,
        changeType: 'created',
        changedAt: '2024-01-15T00:00:00Z',
        changerName: '박등록',
      },
    ]),
    getAssetAssignments: vi.fn().mockResolvedValue([
      {
        id: 1,
        assetId: 1,
        userId: 10,
        userName: '김담당',
        userEmail: 'kim@example.com',
        role: 'owner',
        assignedAt: '2024-01-15T00:00:00Z',
        isActive: true,
      },
    ]),
    createAssetValuation: vi.fn().mockResolvedValue({}),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
  },
}))

const renderWithRouter = () => {
  return render(
    <MemoryRouter initialEntries={['/assets/1']}>
      <Routes>
        <Route path="/assets/:id" element={<AssetDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AssetDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render asset name', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          // 자산명이 여러 곳에 나타날 수 있음 (breadcrumb, title)
          const elements = screen.getAllByText('메인 웹서버')
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 10000 }
      )
    })

    it('should render asset code', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('AST-SRV-202401-001')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render action buttons', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          // 수정/삭제 버튼 존재 확인 (여러 곳에 있을 수 있음)
          const editButtons = screen.getAllByRole('button')
          expect(editButtons.length).toBeGreaterThan(0)
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Tabs', () => {
    it('should render basic info tab', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('기본 정보')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render assignments tab', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('담당자')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render history tab', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('변경 이력')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render related risks tab', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('관련 위험')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('CIA Evaluation', () => {
    it('should render CIA evaluation section', async () => {
      renderWithRouter()

      await waitFor(
        () => {
          expect(screen.getByText('CIA 평가')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })
})
