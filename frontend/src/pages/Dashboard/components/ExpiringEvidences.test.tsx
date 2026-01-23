import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import ExpiringEvidences from './ExpiringEvidences'
import type { ExpiringEvidence } from '@/types'

describe('ExpiringEvidences Component', () => {
  const mockEvidences: ExpiringEvidence[] = [
    {
      id: 1,
      title: '개인정보 처리방침',
      fileName: 'privacy_policy.pdf',
      validUntil: '2026-02-01T00:00:00Z',
      daysUntilExpiry: 9,
      controlItems: ['1.2.1', '1.2.2'],
    },
    {
      id: 2,
      title: '접근권한 관리대장',
      fileName: 'access_control.xlsx',
      validUntil: '2026-02-15T00:00:00Z',
      daysUntilExpiry: 23,
      controlItems: ['2.3.4'],
    },
    {
      id: 3,
      title: '로그 점검 결과',
      fileName: 'log_review.pdf',
      validUntil: '2026-01-26T00:00:00Z',
      daysUntilExpiry: 3,
      controlItems: ['3.1.1', '3.1.2', '3.1.3'],
    },
  ]

  it('컴포넌트가 올바르게 렌더링됨', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    expect(screen.getByText('만료 예정 증적')).toBeInTheDocument()
  })

  it('모든 증적을 리스트로 표시함', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    expect(screen.getByText('개인정보 처리방침')).toBeInTheDocument()
    expect(screen.getByText('접근권한 관리대장')).toBeInTheDocument()
    expect(screen.getByText('로그 점검 결과')).toBeInTheDocument()
  })

  it('남은 일수를 표시함', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    expect(screen.getByText('9일 후')).toBeInTheDocument()
    expect(screen.getByText('23일 후')).toBeInTheDocument()
    expect(screen.getByText('3일 후')).toBeInTheDocument()
  })

  it('만료일을 표시함', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    expect(screen.getByText(/2026-02-01/)).toBeInTheDocument()
    expect(screen.getByText(/2026-02-15/)).toBeInTheDocument()
    expect(screen.getByText(/2026-01-26/)).toBeInTheDocument()
  })

  it('파일 이름을 표시함', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    expect(screen.getByText(/privacy_policy.pdf/)).toBeInTheDocument()
    expect(screen.getByText(/access_control.xlsx/)).toBeInTheDocument()
    expect(screen.getByText(/log_review.pdf/)).toBeInTheDocument()
  })

  it('통제항목 목록을 표시함', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    expect(screen.getByText('1.2.1')).toBeInTheDocument()
    expect(screen.getByText('1.2.2')).toBeInTheDocument()
    expect(screen.getByText('2.3.4')).toBeInTheDocument()
    expect(screen.getByText('3.1.1')).toBeInTheDocument()
  })

  it('긴급(7일 이내)은 빨간색으로 표시함', () => {
    const { container } = render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    const urgentBadge = container.querySelector('.ant-badge-status-error')
    expect(urgentBadge).toBeInTheDocument()
  })

  it('경고(7-14일)는 주황색으로 표시함', () => {
    const { container } = render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    const warningBadge = container.querySelector('.ant-badge-status-warning')
    expect(warningBadge).toBeInTheDocument()
  })

  it('일반(14일 이상)은 기본 색상으로 표시함', () => {
    const { container } = render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    const normalBadge = container.querySelector('.ant-badge-status-processing')
    expect(normalBadge).toBeInTheDocument()
  })

  it('증적 클릭 시 상세 페이지로 이동함', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    const evidenceLink = screen.getByText('개인정보 처리방침').closest('a')
    expect(evidenceLink).toHaveAttribute('href', '/evidences/1')
  })

  it('빈 증적 목록을 처리함', () => {
    render(
      <BrowserRouter>
        <ExpiringEvidences data={[]} />
      </BrowserRouter>
    )

    expect(screen.getByText('만료 예정 증적이 없습니다')).toBeInTheDocument()
  })

  it('통제항목이 많을 때 +N 형식으로 표시함', () => {
    const manyControlItems: ExpiringEvidence = {
      id: 4,
      title: '다수 통제항목 증적',
      fileName: 'many_controls.pdf',
      validUntil: '2026-02-01T00:00:00Z',
      daysUntilExpiry: 9,
      controlItems: ['1.1', '1.2', '1.3', '1.4', '1.5'],
    }

    render(
      <BrowserRouter>
        <ExpiringEvidences data={[manyControlItems]} />
      </BrowserRouter>
    )

    // 처음 3개만 표시하고 나머지는 +N 형식
    expect(screen.getByText('1.1')).toBeInTheDocument()
    expect(screen.getByText('1.2')).toBeInTheDocument()
    expect(screen.getByText('1.3')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('남은 일수로 정렬됨 (긴급한 것이 위)', () => {
    const { container } = render(
      <BrowserRouter>
        <ExpiringEvidences data={mockEvidences} />
      </BrowserRouter>
    )

    const listItems = container.querySelectorAll('.ant-list-item')
    const firstItem = listItems[0]
    const lastItem = listItems[listItems.length - 1]

    // 첫 번째는 3일 후 (가장 긴급)
    expect(firstItem.textContent).toContain('3일 후')
    // 마지막은 23일 후
    expect(lastItem.textContent).toContain('23일 후')
  })
})
