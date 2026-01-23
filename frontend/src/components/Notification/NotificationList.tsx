import { Select, Spin, Empty, Typography, Pagination, Space, Card } from 'antd'
import type { Notification, NotificationType } from '@/types'
import NotificationItem from './NotificationItem'

const { Text } = Typography
const { Option } = Select

export interface NotificationFilter {
  readStatus?: 'all' | 'read' | 'unread'
  type?: NotificationType | 'all'
}

interface NotificationListProps {
  notifications: Notification[]
  isLoading: boolean
  totalCount: number
  currentPage: number
  pageSize: number
  unreadCount?: number
  currentFilter?: NotificationFilter
  onNotificationClick: (id: number, link: string | null) => void
  onMarkAsRead?: (id: number) => void
  onDelete?: (id: number) => void
  onPageChange: (page: number, pageSize: number) => void
  onFilterChange: (filter: NotificationFilter) => void
}

// 알림 타입 옵션
const typeOptions: { value: NotificationType | 'all'; label: string }[] = [
  { value: 'all', label: '모든 유형' },
  { value: 'evidence_expiring', label: '증적 만료' },
  { value: 'scheduled_task_due', label: '정기 활동' },
  { value: 'corrective_action_due', label: '시정조치' },
  { value: 'non_conformity_assigned', label: '부적합' },
  { value: 'audit_scheduled', label: '감사 예정' },
  { value: 'system', label: '시스템' },
]

// 읽음 상태 옵션
const readStatusOptions: { value: 'all' | 'read' | 'unread'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'unread', label: '읽지 않음' },
  { value: 'read', label: '읽음' },
]

const NotificationList = ({
  notifications,
  isLoading,
  totalCount,
  currentPage,
  pageSize,
  unreadCount = 0,
  currentFilter = {},
  onNotificationClick,
  onPageChange,
  onFilterChange,
}: NotificationListProps) => {
  const handleReadStatusChange = (value: 'all' | 'read' | 'unread') => {
    onFilterChange({
      ...currentFilter,
      readStatus: value === 'all' ? undefined : value,
    })
  }

  const handleTypeChange = (value: NotificationType | 'all') => {
    onFilterChange({
      ...currentFilter,
      type: value === 'all' ? undefined : value,
    })
  }

  const hasActiveFilter =
    currentFilter.readStatus !== undefined || currentFilter.type !== undefined

  return (
    <Card>
      {/* 필터 및 상태 표시 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space wrap>
          <Select
            value={currentFilter.readStatus || 'all'}
            onChange={handleReadStatusChange}
            style={{ width: 120 }}
          >
            {readStatusOptions.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>

          <Select
            value={currentFilter.type || 'all'}
            onChange={handleTypeChange}
            style={{ width: 140 }}
          >
            {typeOptions.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Space>

        {unreadCount > 0 && (
          <Text type="secondary">읽지 않은 알림: {unreadCount}개</Text>
        )}
      </div>

      {/* 알림 목록 */}
      <div style={{ minHeight: 300 }}>
        {isLoading ? (
          <div
            data-testid="notification-list-loading"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 80,
            }}
          >
            <Spin size="large" />
          </div>
        ) : notifications.length > 0 ? (
          <div
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => onNotificationClick(notification.id, notification.link)}
              />
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              hasActiveFilter
                ? '조건에 맞는 알림이 없습니다'
                : '알림이 없습니다'
            }
            style={{ padding: 60 }}
          />
        )}
      </div>

      {/* 페이지네이션 */}
      {totalCount > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 24,
          }}
        >
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalCount}
            onChange={onPageChange}
            showSizeChanger={false}
            showTotal={(total) => `총 ${total}개`}
          />
        </div>
      )}
    </Card>
  )
}

export default NotificationList
