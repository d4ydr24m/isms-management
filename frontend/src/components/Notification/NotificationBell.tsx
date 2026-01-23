import { useState, useRef, useEffect, useCallback } from 'react'
import { Badge, Spin, Empty, Button, List, Typography } from 'antd'
import { BellOutlined, CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/stores'
import NotificationItem from './NotificationItem'

const { Text } = Typography

interface NotificationBellProps {
  className?: string
}

const NotificationBell = ({ className }: NotificationBellProps) => {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore()

  // 드롭다운 열릴 때 알림 가져오기
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleNotificationClick = useCallback(
    (notificationId: number, link: string | null) => {
      markAsRead(notificationId)
      setIsOpen(false)
      if (link) {
        navigate(link)
      }
    },
    [markAsRead, navigate]
  )

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead()
  }, [markAllAsRead])

  const handleViewAll = useCallback(() => {
    setIsOpen(false)
    navigate('/notifications')
  }, [navigate])

  const displayBadgeCount = unreadCount > 99 ? '99+' : unreadCount > 0 ? unreadCount : 0

  const recentNotifications = notifications.slice(0, 5)

  return (
    <div className={className} style={{ position: 'relative' }}>
      <Badge count={displayBadgeCount} offset={[-5, 5]} size="small">
        <button
          ref={buttonRef}
          onClick={handleToggle}
          aria-label="알림"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BellOutlined style={{ fontSize: 20 }} />
        </button>
      </Badge>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: 360,
            maxHeight: 480,
            backgroundColor: '#fff',
            borderRadius: 8,
            boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
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
                onClick={handleMarkAllAsRead}
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
                    onClick={() =>
                      handleNotificationClick(notification.id, notification.link)
                    }
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
            <Button type="link" onClick={handleViewAll}>
              전체 알림 보기
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
