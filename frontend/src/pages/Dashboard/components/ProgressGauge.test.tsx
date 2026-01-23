import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ProgressGauge from './ProgressGauge'
import type { EvidenceProgress } from '@/types'

describe('ProgressGauge Component', () => {
  const mockProgress: EvidenceProgress = {
    total: 100,
    active: 75,
    draft: 15,
    expired: 10,
    progressPercentage: 75,
    requiredTotal: 80,
    requiredActive: 60,
    requiredProgressPercentage: 75,
  }

  it('컴포넌트가 올바르게 렌더링됨', () => {
    render(<ProgressGauge data={mockProgress} />)

    expect(screen.getByText('인증 준비 진척률')).toBeInTheDocument()
  })

  it('진척률 퍼센티지를 표시함', () => {
    render(<ProgressGauge data={mockProgress} />)

    expect(screen.getAllByText('75%').length).toBeGreaterThan(0)
  })

  it('전체 증적 통계를 표시함', () => {
    render(<ProgressGauge data={mockProgress} />)

    expect(screen.getByText('전체')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('활성')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('필수 항목 통계를 표시함', () => {
    render(<ProgressGauge data={mockProgress} />)

    expect(screen.getByText(/필수 항목/)).toBeInTheDocument()
    expect(screen.getByText(/60.*\/ 80/)).toBeInTheDocument()
  })

  it('높은 진척률(80% 이상)에 성공 색상을 사용함', () => {
    const highProgress = { ...mockProgress, progressPercentage: 85 }
    const { container } = render(<ProgressGauge data={highProgress} />)

    // Ant Design Progress의 success status를 확인
    expect(container.querySelector('.ant-progress-status-success')).toBeInTheDocument()
  })

  it('낮은 진척률(50% 미만)에 예외 색상을 사용함', () => {
    const lowProgress = { ...mockProgress, progressPercentage: 40 }
    const { container } = render(<ProgressGauge data={lowProgress} />)

    // Ant Design Progress의 exception status를 확인
    expect(container.querySelector('.ant-progress-status-exception')).toBeInTheDocument()
  })

  it('중간 진척률(50-80%)에 일반 색상을 사용함', () => {
    const mediumProgress = { ...mockProgress, progressPercentage: 65 }
    const { container } = render(<ProgressGauge data={mediumProgress} />)

    // Ant Design Progress의 normal status를 확인
    expect(container.querySelector('.ant-progress-status-active')).toBeInTheDocument()
  })

  it('0% 진척률을 처리함', () => {
    const zeroProgress = {
      ...mockProgress,
      active: 0,
      progressPercentage: 0,
    }
    render(<ProgressGauge data={zeroProgress} />)

    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('100% 진척률을 처리함', () => {
    const fullProgress = {
      ...mockProgress,
      active: 100,
      progressPercentage: 100,
    }
    render(<ProgressGauge data={fullProgress} />)

    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('만료된 증적 카운트를 표시함', () => {
    render(<ProgressGauge data={mockProgress} />)

    expect(screen.getByText('만료')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('초안 상태 증적 카운트를 표시함', () => {
    render(<ProgressGauge data={mockProgress} />)

    expect(screen.getByText('초안')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })
})
