import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from './index'
import { dashboardService } from '@/services/dashboard'
import type { DashboardSummary } from '@/types'

// Mock dashboard service
vi.mock('@/services/dashboard', () => ({
  dashboardService: {
    getSummary: vi.fn(),
  },
}))

const mockDashboardData: DashboardSummary = {
  evidenceProgress: {
    total: 100,
    active: 75,
    draft: 15,
    expired: 10,
    progressPercentage: 75,
    requiredTotal: 80,
    requiredActive: 60,
    requiredProgressPercentage: 75,
  },
  upcomingActivities: [
    {
      id: 1,
      title: '월간 보안점검',
      type: 'scheduled_task',
      dueDate: '2026-01-25T00:00:00Z',
      assignee: '김보안',
      status: 'pending',
      priority: 'high',
    },
    {
      id: 2,
      title: '시정조치 완료',
      type: 'corrective_action',
      dueDate: '2026-01-26T00:00:00Z',
      assignee: '이담당',
      status: 'in_progress',
      priority: 'medium',
    },
  ],
  expiringEvidences: [
    {
      id: 1,
      title: '개인정보 처리방침',
      fileName: 'privacy_policy.pdf',
      validUntil: '2026-02-01T00:00:00Z',
      daysUntilExpiry: 9,
      controlItems: ['1.2.1', '1.2.2'],
    },
  ],
  pendingTasks: [
    {
      id: 1,
      title: '로그 검토',
      type: 'scheduled_task',
      dueDate: '2026-01-24T00:00:00Z',
      assignee: '박검토',
      priority: 'high',
    },
    {
      id: 2,
      title: '증적 업로드',
      type: 'evidence_upload',
      dueDate: '2026-01-27T00:00:00Z',
      assignee: '최업로드',
      priority: 'medium',
    },
  ],
  nonConformitySummary: {
    total: 15,
    byType: {
      critical: 2,
      major: 5,
      minor: 6,
      observation: 2,
    },
    byStatus: {
      pending: 3,
      inProgress: 7,
      completed: 4,
      verified: 1,
    },
    overdueCount: 2,
  },
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('페이지가 올바르게 렌더링됨', async () => {
    vi.mocked(dashboardService.getSummary).mockResolvedValue(mockDashboardData)

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('대시보드')).toBeInTheDocument()
    })
  })

  it('로딩 중 스피너를 표시함', () => {
    vi.mocked(dashboardService.getSummary).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('대시보드 데이터를 성공적으로 로드함', async () => {
    vi.mocked(dashboardService.getSummary).mockResolvedValue(mockDashboardData)

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      // 진척률 게이지 확인
      expect(screen.getByText('인증 준비 진척률')).toBeInTheDocument()
      expect(screen.getAllByText('75%').length).toBeGreaterThan(0)

      // 예정 활동 확인
      expect(screen.getByText('예정 보안 활동')).toBeInTheDocument()
      expect(screen.getByText('월간 보안점검')).toBeInTheDocument()

      // 만료 예정 증적 확인
      expect(screen.getByText('만료 예정 증적')).toBeInTheDocument()
      expect(screen.getByText('개인정보 처리방침')).toBeInTheDocument()

      // 미완료 업무 확인
      expect(screen.getByText('미완료 업무')).toBeInTheDocument()
      expect(screen.getByText('로그 검토')).toBeInTheDocument()

      // 부적합 현황 확인
      expect(screen.getByText('부적합 현황')).toBeInTheDocument()
    })
  })

  it('API 오류 시 에러 메시지를 표시함', async () => {
    const errorMessage = '데이터를 불러올 수 없습니다'
    vi.mocked(dashboardService.getSummary).mockRejectedValue(new Error(errorMessage))

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/데이터를 불러올 수 없습니다/)).toBeInTheDocument()
    })
  })

  it('새로고침 버튼을 클릭하면 데이터를 다시 로드함', async () => {
    vi.mocked(dashboardService.getSummary).mockResolvedValue(mockDashboardData)

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('대시보드')).toBeInTheDocument()
    })

    expect(dashboardService.getSummary).toHaveBeenCalledTimes(1)

    const refreshButton = screen.getByRole('button', { name: /새로고침/i })
    refreshButton.click()

    await waitFor(() => {
      expect(dashboardService.getSummary).toHaveBeenCalledTimes(2)
    })
  })

  it('모든 서브 컴포넌트가 올바른 props를 받음', async () => {
    vi.mocked(dashboardService.getSummary).mockResolvedValue(mockDashboardData)

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      // ProgressGauge에 진척률 데이터가 전달됨
      expect(screen.getAllByText('75%').length).toBeGreaterThan(0)
      expect(screen.getByText(/필수 항목/)).toBeInTheDocument()

      // ActivityList에 활동 데이터가 전달됨
      expect(screen.getByText('월간 보안점검')).toBeInTheDocument()
      expect(screen.getByText('시정조치 완료')).toBeInTheDocument()

      // ExpiringEvidences에 증적 데이터가 전달됨
      expect(screen.getByText('개인정보 처리방침')).toBeInTheDocument()

      // PendingTasks에 업무 데이터가 전달됨
      expect(screen.getByText('로그 검토')).toBeInTheDocument()
      expect(screen.getByText('증적 업로드')).toBeInTheDocument()

      // NonConformityStatus에 부적합 데이터가 전달됨
      expect(screen.getAllByText('15').length).toBeGreaterThan(0) // total
    })
  })

  it('빈 데이터를 우아하게 처리함', async () => {
    const emptyData: DashboardSummary = {
      evidenceProgress: {
        total: 0,
        active: 0,
        draft: 0,
        expired: 0,
        progressPercentage: 0,
        requiredTotal: 0,
        requiredActive: 0,
        requiredProgressPercentage: 0,
      },
      upcomingActivities: [],
      expiringEvidences: [],
      pendingTasks: [],
      nonConformitySummary: {
        total: 0,
        byType: { critical: 0, major: 0, minor: 0, observation: 0 },
        byStatus: { pending: 0, inProgress: 0, completed: 0, verified: 0 },
        overdueCount: 0,
      },
    }

    vi.mocked(dashboardService.getSummary).mockResolvedValue(emptyData)

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('대시보드')).toBeInTheDocument()
      // 빈 상태 메시지가 표시되어야 함
      expect(screen.getAllByText(/예정된 활동이 없습니다/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/만료 예정 증적이 없습니다/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/미완료 업무가 없습니다/).length).toBeGreaterThan(0)
    })
  })
})
