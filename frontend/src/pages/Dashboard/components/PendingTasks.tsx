import { Card, List, Tag, Space, Checkbox, Empty } from 'antd'
import { Link } from 'react-router-dom'
import { CalendarOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { PendingTask } from '@/types'

interface PendingTasksProps {
  data: PendingTask[]
  onComplete?: (taskId: number) => void
}

const PendingTasks: React.FC<PendingTasksProps> = ({ data, onComplete }) => {
  const getTypeLabel = (type: PendingTask['type']) => {
    const typeMap = {
      scheduled_task: { label: '정기활동', color: 'blue' },
      corrective_action: { label: '시정조치', color: 'orange' },
      evidence_upload: { label: '증적업로드', color: 'green' },
    }
    return typeMap[type] || { label: type, color: 'default' }
  }

  const getPriorityTag = (priority: PendingTask['priority']) => {
    const priorityMap = {
      high: { label: '높음', color: 'red' },
      medium: { label: '중간', color: 'orange' },
      low: { label: '낮음', color: 'default' },
    }
    return priorityMap[priority] || { label: priority, color: 'default' }
  }

  const getPriorityOrder = (priority: PendingTask['priority']) => {
    const orderMap = { high: 1, medium: 2, low: 3 }
    return orderMap[priority] || 999
  }

  const getTaskLink = (task: PendingTask) => {
    const linkMap = {
      scheduled_task: `/scheduled-tasks/${task.id}`,
      corrective_action: `/nonconformities/${task.id}`,
      evidence_upload: `/evidences/create?task=${task.id}`,
    }
    return linkMap[task.type] || '#'
  }

  // 우선순위로 정렬 (높음이 위)
  const sortedData = [...data].sort((a, b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority))

  return (
    <Card title="미완료 업무" variant="borderless">
      {sortedData.length === 0 ? (
        <Empty description="미완료 업무가 없습니다" />
      ) : (
        <List
          dataSource={sortedData}
          renderItem={(task) => {
            const typeInfo = getTypeLabel(task.type)
            const priorityInfo = getPriorityTag(task.priority)

            return (
              <List.Item
                key={task.id}
                extra={
                  <Checkbox onChange={() => onComplete?.(task.id)} />
                }
              >
                <List.Item.Meta
                  title={
                    <Link to={getTaskLink(task)}>{task.title}</Link>
                  }
                  description={
                    <Space size="small" wrap>
                      <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                      <Tag color={priorityInfo.color}>{priorityInfo.label}</Tag>
                      <Space size={4}>
                        <CalendarOutlined />
                        <span>
                          {task.dueDate
                            ? dayjs(task.dueDate).format('YYYY-MM-DD')
                            : '미정'}
                        </span>
                      </Space>
                      <Space size={4}>
                        <UserOutlined />
                        <span>{task.assignee || '미할당'}</span>
                      </Space>
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}

export default PendingTasks
