import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import PendingTasks from './PendingTasks'
import type { PendingTask } from '@/types'

describe('PendingTasks Component', () => {
  const mockTasks: PendingTask[] = [
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
    {
      id: 3,
      title: '시정조치 확인',
      type: 'corrective_action',
      dueDate: null,
      assignee: null,
      priority: 'low',
    },
  ]

  it('컴포넌트가 올바르게 렌더링됨', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText('미완료 업무')).toBeInTheDocument()
  })

  it('모든 업무를 리스트로 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText('로그 검토')).toBeInTheDocument()
    expect(screen.getByText('증적 업로드')).toBeInTheDocument()
    expect(screen.getByText('시정조치 확인')).toBeInTheDocument()
  })

  it('업무 타입을 배지로 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText('정기활동')).toBeInTheDocument()
    expect(screen.getByText('증적업로드')).toBeInTheDocument()
    expect(screen.getByText('시정조치')).toBeInTheDocument()
  })

  it('우선순위를 태그로 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText('높음')).toBeInTheDocument()
    expect(screen.getByText('중간')).toBeInTheDocument()
    expect(screen.getByText('낮음')).toBeInTheDocument()
  })

  it('담당자 이름을 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText(/박검토/)).toBeInTheDocument()
    expect(screen.getByText(/최업로드/)).toBeInTheDocument()
  })

  it('마감일을 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText(/2026-01-24/)).toBeInTheDocument()
    expect(screen.getByText(/2026-01-27/)).toBeInTheDocument()
  })

  it('마감일이 없는 업무를 처리함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText('미정')).toBeInTheDocument()
  })

  it('담당자가 없는 업무를 처리함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    expect(screen.getByText('미할당')).toBeInTheDocument()
  })

  it('빈 업무 목록을 처리함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={[]} />
      </BrowserRouter>
    )

    expect(screen.getByText('미완료 업무가 없습니다')).toBeInTheDocument()
  })

  it('업무 클릭 시 상세 페이지로 이동함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    const taskLink = screen.getByText('로그 검토').closest('a')
    expect(taskLink).toHaveAttribute('href', '/scheduled-tasks/1')
  })

  it('높은 우선순위를 빨간색으로 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    const highPriorityTag = screen.getByText('높음').closest('.ant-tag')
    expect(highPriorityTag).toHaveClass('ant-tag-red')
  })

  it('중간 우선순위를 주황색으로 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    const mediumPriorityTag = screen.getByText('중간').closest('.ant-tag')
    expect(mediumPriorityTag).toHaveClass('ant-tag-orange')
  })

  it('낮은 우선순위를 기본 색상으로 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    const lowPriorityTag = screen.getByText('낮음').closest('.ant-tag')
    expect(lowPriorityTag).toHaveClass('ant-tag-default')
  })

  it('우선순위로 정렬됨 (높음이 위)', () => {
    const { container } = render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    const listItems = container.querySelectorAll('.ant-list-item')
    const firstItem = listItems[0]
    const lastItem = listItems[listItems.length - 1]

    // 첫 번째는 high priority
    expect(firstItem.textContent).toContain('로그 검토')
    expect(firstItem.textContent).toContain('높음')

    // 마지막은 low priority
    expect(lastItem.textContent).toContain('시정조치 확인')
    expect(lastItem.textContent).toContain('낮음')
  })

  it('체크박스를 표시함', () => {
    render(
      <BrowserRouter>
        <PendingTasks data={mockTasks} />
      </BrowserRouter>
    )

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(mockTasks.length)
  })
})
