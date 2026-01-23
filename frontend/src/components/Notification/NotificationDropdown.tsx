import { Spin, Empty, Button, List, Typography } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import type { Notification } from '@/types'
import NotificationItem from './NotificationItem'

const { Text } = Typography

interface NotificationDropdownProps {
  notifications: Notification[]
  isLoading: boolean
  unreadCount: number
  onNotificationClick: (id: number, link: string | null) => void
  onMarkAllAsRead: () => void
  onViewAll: () => void
  onClose?: () => void
}

const NotificationDropdown = ({
  notifications,
  isLoading,
  unreadCount,
  onNotificationClick,
  onMarkAllAsRead,
  onViewAll,
}: NotificationDropdownProps) => {
  const recentNotifications = notifications.slice(0, 5)

  return (
    <div
      style={{
        width: 360,
        maxHeight: 480,
        backgroundColor: '#fff',
        borderRadius: 8,
        boxShadow:
          '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Text strong>알림</Text>
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={onMarkAllAsRead}
          >
            모두 읽음
          </Button>
        )}
      </div>

      {/* 내용 */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {isLoading ? (
          <div
            data-testid="notification-loading"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 40,
            }}
          >
            <Spin />
          </div>
        ) : recentNotifications.length > 0 ? (
          <List
            dataSource={recentNotifications}
            renderItem={(notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => onNotificationClick(notification.id, notification.link)}
              />
            )}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="알림이 없습니다"
            style={{ padding: 40 }}
          />
        )}
      </div>

      {/* 푸터 */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          textAlign: 'center',
        }}
      >
        <Button type="link" onClick={onViewAll}>
          전체 알림 보기
        </Button>
      </div>
    </div>
  )
}

export default NotificationDropdown
