import { Card, List, Tag, Space, Button, Empty } from 'antd'
import { Link } from 'react-router-dom'
import {
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { UpcomingActivity } from '@/types'

interface ActivityListProps {
  data: UpcomingActivity[]
  onChange?: (period: 'today' | 'week' | 'month') => void
}

const ActivityList: React.FC<ActivityListProps> = ({ data, onChange }) => {
  const getTypeLabel = (type: UpcomingActivity['type']) => {
    const typeMap = {
      scheduled_task: { label: '정기활동', color: 'blue' },
      audit: { label: '감사', color: 'purple' },
      corrective_action: { label: '시정조치', color: 'orange' },
    }
    return typeMap[type] || { label: type, color: 'default' }
  }

  const getPriorityTag = (priority: UpcomingActivity['priority']) => {
    const priorityMap = {
      high: { label: '높음', color: 'red' },
      medium: { label: '중간', color: 'orange' },
      low: { label: '낮음', color: 'default' },
    }
    return priorityMap[priority] || { label: priority, color: 'default' }
  }

  const getActivityLink = (activity: UpcomingActivity) => {
    const linkMap = {
      scheduled_task: `/scheduled-tasks/${activity.id}`,
      audit: `/audits/${activity.id}`,
      corrective_action: `/nonconformities/${activity.id}`,
    }
    return linkMap[activity.type] || '#'
  }

  const getTypeIcon = (type: UpcomingActivity['type']) => {
    const iconMap = {
      scheduled_task: <ClockCircleOutlined />,
      audit: <CheckCircleOutlined />,
      corrective_action: <FileTextOutlined />,
    }
    return iconMap[type] || <FileTextOutlined />
  }

  return (
    <Card
      title="예정 보안 활동"
      bordered={false}
      extra={
        <Space>
          <Button size="small" onClick={() => onChange?.('today')}>
            오늘
          </Button>
          <Button size="small" onClick={() => onChange?.('week')}>
            이번 주
          </Button>
          <Button size="small" onClick={() => onChange?.('month')}>
            이번 달
          </Button>
        </Space>
      }
    >
      {data.length === 0 ? (
        <Empty description="예정된 활동이 없습니다" />
      ) : (
        <List
          dataSource={data}
          renderItem={(activity) => {
            const typeInfo = getTypeLabel(activity.type)
            const priorityInfo = getPriorityTag(activity.priority)

            return (
              <List.Item key={activity.id}>
                <List.Item.Meta
                  avatar={getTypeIcon(activity.type)}
                  title={
                    <Link to={getActivityLink(activity)}>{activity.title}</Link>
                  }
                  description={
                    <Space size="small" wrap>
                      <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                      <Tag color={priorityInfo.color}>{priorityInfo.label}</Tag>
                      <Space size={4}>
                        <CalendarOutlined />
                        <span>{dayjs(activity.dueDate).format('YYYY-MM-DD')}</span>
                      </Space>
                      <Space size={4}>
                        <UserOutlined />
                        <span>{activity.assignee || '미할당'}</span>
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

export default ActivityList
