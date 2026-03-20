import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import ActivityList from './ActivityList'
import type { UpcomingActivity } from '@/types'

describe('ActivityList Component', () => {
  const mockActivities: UpcomingActivity[] = [
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
    {
      id: 3,
      title: '내부 감사',
      type: 'audit',
      dueDate: '2026-01-27T00:00:00Z',
      assignee: '박감사',
      status: 'pending',
      priority: 'low',
    },
  ]

  it('컴포넌트가 올바르게 렌더링됨', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    expect(screen.getByText('예정 보안 활동')).toBeInTheDocument()
  })

  it('모든 활동을 리스트로 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    expect(screen.getByText('월간 보안점검')).toBeInTheDocument()
    expect(screen.getByText('시정조치 완료')).toBeInTheDocument()
    expect(screen.getByText('내부 감사')).toBeInTheDocument()
  })

  it('활동 타입을 배지로 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    expect(screen.getByText('정기활동')).toBeInTheDocument()
    expect(screen.getByText('시정조치')).toBeInTheDocument()
    expect(screen.getByText('감사')).toBeInTheDocument()
  })

  it('우선순위를 태그로 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    expect(screen.getByText('높음')).toBeInTheDocument()
    expect(screen.getByText('중간')).toBeInTheDocument()
    expect(screen.getByText('낮음')).toBeInTheDocument()
  })

  it('담당자 이름을 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    expect(screen.getByText(/김보안/)).toBeInTheDocument()
    expect(screen.getByText(/이담당/)).toBeInTheDocument()
    expect(screen.getByText(/박감사/)).toBeInTheDocument()
  })

  it('마감일을 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    // dayjs를 사용한 날짜 포맷팅 확인 (YYYY-MM-DD)
    expect(screen.getByText(/2026-01-25/)).toBeInTheDocument()
    expect(screen.getByText(/2026-01-26/)).toBeInTheDocument()
    expect(screen.getByText(/2026-01-27/)).toBeInTheDocument()
  })

  it('빈 활동 목록을 처리함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={[]} />
      </BrowserRouter>
    )

    expect(screen.getByText('예정된 활동이 없습니다')).toBeInTheDocument()
  })

  it('기간 필터 버튼을 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    expect(screen.getByText('오늘')).toBeInTheDocument()
    expect(screen.getByText('이번 주')).toBeInTheDocument()
    expect(screen.getByText('이번 달')).toBeInTheDocument()
  })

  it('기간 필터를 클릭하면 onChange 핸들러가 호출됨', () => {
    const handleChange = vi.fn()

    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} onChange={handleChange} />
      </BrowserRouter>
    )

    const weekButton = screen.getByText('이번 주')
    fireEvent.click(weekButton)

    expect(handleChange).toHaveBeenCalledWith('week')
  })

  it('활동 클릭 시 상세 페이지로 이동함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    const activityItem = screen.getByText('월간 보안점검').closest('a')
    expect(activityItem).toHaveAttribute('href', '/scheduled-tasks/1')
  })

  it('할당되지 않은 활동을 처리함', () => {
    const unassignedActivity: UpcomingActivity = {
      id: 4,
      title: '할당되지 않은 작업',
      type: 'scheduled_task',
      dueDate: '2026-01-28T00:00:00Z',
      assignee: null,
      status: 'pending',
      priority: 'medium',
    }

    render(
      <BrowserRouter>
        <ActivityList data={[unassignedActivity]} />
      </BrowserRouter>
    )

    expect(screen.getByText('미할당')).toBeInTheDocument()
  })

  it('높은 우선순위를 빨간색으로 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    const highPriorityTag = screen.getByText('높음').closest('.ant-tag')
    expect(highPriorityTag).toHaveClass('ant-tag-red')
  })

  it('중간 우선순위를 주황색으로 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    const mediumPriorityTag = screen.getByText('중간').closest('.ant-tag')
    expect(mediumPriorityTag).toHaveClass('ant-tag-orange')
  })

  it('낮은 우선순위를 기본 색상으로 표시함', () => {
    render(
      <BrowserRouter>
        <ActivityList data={mockActivities} />
      </BrowserRouter>
    )

    const lowPriorityTag = screen.getByText('낮음').closest('.ant-tag')
    expect(lowPriorityTag).toHaveClass('ant-tag-default')
  })
})
