/**
 * 자산 통계 위젯 테스트
 * TDD: RED -> GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AssetStatsWidgets from './AssetStatsWidgets'

// Mock asset service
vi.mock('@/services/assets', () => ({
  assetService: {
    getAssetStats: vi.fn().mockResolvedValue({
      totalCount: 500,
      activeCount: 450,
      byStatus: { introduced: 50, operating: 380, changed: 20, disposed: 50 },
      byImportance: { 1: 100, 2: 200, 3: 150 },
      recentAdded: 15,
      recentDisposed: 5,
    }),
    getAssetsByType: vi.fn().mockResolvedValue([
      { typeId: 1, typeCode: 'SERVER', typeName: '서버', count: 100, activeCount: 95 },
      { typeId: 2, typeCode: 'NETWORK', typeName: '네트워크', count: 50, activeCount: 48 },
    ]),
    getAssetsByDepartment: vi.fn().mockResolvedValue([
      { departmentId: 1, departmentName: 'IT부서', count: 200, byImportance: { 1: 50, 2: 100, 3: 50 } },
      { departmentId: 2, departmentName: '경영지원부', count: 100, byImportance: { 1: 30, 2: 50, 3: 20 } },
    ]),
    getAssetsByImportance: vi.fn().mockResolvedValue([
      { importanceLevel: 3, label: '상', count: 150, percentage: 30 },
      { importanceLevel: 2, label: '중', count: 200, percentage: 40 },
      { importanceLevel: 1, label: '하', count: 150, percentage: 30 },
    ]),
    getLifecycleStats: vi.fn().mockResolvedValue({
      byStatus: { introduced: 50, operating: 380, changed: 20, disposed: 50 },
      total: 500,
      introducedThisMonth: 15,
      disposedThisMonth: 5,
    }),
  },
}))

// Mock recharts (차트 컴포넌트는 테스트에서 렌더링이 어려움)
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}))

describe('AssetStatsWidgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Summary Statistics', () => {
    it('should render total asset count', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('총 자산 수')).toBeInTheDocument()
          expect(screen.getByText('500')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render active asset count', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('운영 중')).toBeInTheDocument()
          expect(screen.getByText('450')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render recent added count', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('이번 달 등록')).toBeInTheDocument()
          expect(screen.getByText('15')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render recent disposed count', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('이번 달 폐기')).toBeInTheDocument()
          expect(screen.getByText('5')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Charts', () => {
    it('should render type distribution chart', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('유형별 자산 분포')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render department chart', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('부서별 자산 수')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render importance distribution chart', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('중요도별 자산 분포')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should render lifecycle chart', async () => {
      render(<AssetStatsWidgets />)

      await waitFor(
        () => {
          expect(screen.getByText('라이프사이클 현황')).toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })

  describe('Conditional Rendering', () => {
    it('should hide summary when showSummary is false', async () => {
      render(<AssetStatsWidgets showSummary={false} />)

      await waitFor(
        () => {
          expect(screen.queryByText('총 자산 수')).not.toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })

    it('should hide type chart when showTypeChart is false', async () => {
      render(<AssetStatsWidgets showTypeChart={false} />)

      await waitFor(
        () => {
          expect(screen.queryByText('유형별 자산 분포')).not.toBeInTheDocument()
        },
        { timeout: 10000 }
      )
    })
  })
})
