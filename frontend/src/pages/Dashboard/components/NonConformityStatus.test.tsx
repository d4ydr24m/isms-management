import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import NonConformityStatus from './NonConformityStatus'
import type { NonConformitySummary } from '@/types'

describe('NonConformityStatus Component', () => {
  const mockSummary: NonConformitySummary = {
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
  }

  it('컴포넌트가 올바르게 렌더링됨', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    expect(screen.getByText('부적합 현황')).toBeInTheDocument()
  })

  it('전체 부적합 수를 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('전체 부적합')).toBeInTheDocument()
  })

  it('기한 초과 건수를 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('기한 초과')).toBeInTheDocument()
  })

  it('유형별 통계를 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    const typeSection = screen.getByText('유형별 분포').parentElement
    expect(typeSection?.textContent).toContain('치명적')
    expect(typeSection?.textContent).toContain('중대')
    expect(typeSection?.textContent).toContain('경미')
    expect(typeSection?.textContent).toContain('관찰사항')
  })

  it('유형별 카운트를 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    // 유형별 숫자 확인
    const typeSection = screen.getByText('유형별 분포').closest('.ant-card-body')
    expect(typeSection?.textContent).toContain('2') // critical
    expect(typeSection?.textContent).toContain('5') // major
    expect(typeSection?.textContent).toContain('6') // minor
    expect(typeSection?.textContent).toContain('2') // observation
  })

  it('상태별 진행률을 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    const statusSection = screen.getByText('처리 진행률').parentElement
    expect(statusSection?.textContent).toContain('처리 대기')
    expect(statusSection?.textContent).toContain('처리 중')
    expect(statusSection?.textContent).toContain('완료')
    expect(statusSection?.textContent).toContain('검증 완료')
  })

  it('상태별 카운트를 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    const statusSection = screen.getByText('처리 진행률').closest('.ant-card-body')
    expect(statusSection?.textContent).toContain('3') // pending
    expect(statusSection?.textContent).toContain('7') // inProgress
    expect(statusSection?.textContent).toContain('4') // completed
    expect(statusSection?.textContent).toContain('1') // verified
  })

  it('유형별 분포를 파이 차트로 표시함', () => {
    const { container } = render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    // Progress 컴포넌트가 있는지 확인
    const progressBars = container.querySelectorAll('.ant-progress')
    expect(progressBars.length).toBeGreaterThan(0)
  })

  it('기한 초과가 0일 때 성공 색상으로 표시함', () => {
    const noOverdueSummary = { ...mockSummary, overdueCount: 0 }

    render(
      <BrowserRouter>
        <NonConformityStatus data={noOverdueSummary} />
      </BrowserRouter>
    )

    const overdueStatistic = screen.getByText('기한 초과').closest('.ant-statistic')
    const value = overdueStatistic?.querySelector('.ant-statistic-content-value')
    expect(value).toHaveStyle({ color: '#52c41a' })
  })

  it('기한 초과가 있을 때 오류 색상으로 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    const overdueStatistic = screen.getByText('기한 초과').closest('.ant-statistic')
    const value = overdueStatistic?.querySelector('.ant-statistic-content-value')
    expect(value).toHaveStyle({ color: '#ff4d4f' })
  })

  it('치명적 부적합을 빨간색으로 표시함', () => {
    const { container } = render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    const criticalProgress = container.querySelector('.ant-progress-status-exception')
    expect(criticalProgress).toBeInTheDocument()
  })

  it('부적합이 없을 때를 처리함', () => {
    const emptySummary: NonConformitySummary = {
      total: 0,
      byType: { critical: 0, major: 0, minor: 0, observation: 0 },
      byStatus: { pending: 0, inProgress: 0, completed: 0, verified: 0 },
      overdueCount: 0,
    }

    render(
      <BrowserRouter>
        <NonConformityStatus data={emptySummary} />
      </BrowserRouter>
    )

    expect(screen.getByText('부적합 현황')).toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('상세보기 링크를 표시함', () => {
    render(
      <BrowserRouter>
        <NonConformityStatus data={mockSummary} />
      </BrowserRouter>
    )

    const link = screen.getByText('상세보기')
    expect(link.closest('a')).toHaveAttribute('href', '/nonconformities')
  })
})
