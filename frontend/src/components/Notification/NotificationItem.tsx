import { List, Typography, Tag } from 'antd'
import {
  FileProtectOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  AuditOutlined,
  BellOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import type { Notification, NotificationType } from '@/types'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const { Text, Paragraph } = Typography

interface NotificationItemProps {
  notification: Notification
  onClick?: () => void
  showActions?: boolean
}

// 알림 타입별 아이콘 및 색상 설정
const notificationConfig: Record<
  NotificationType,
  { icon: React.ReactNode; color: string; tagColor: string }
> = {
  evidence_expiring: {
    icon: <ClockCircleOutlined />,
    color: '#faad14',
    tagColor: 'warning',
  },
  scheduled_task_due: {
    icon: <FileProtectOutlined />,
    color: '#1890ff',
    tagColor: 'processing',
  },
  corrective_action_due: {
    icon: <ToolOutlined />,
    color: '#ff4d4f',
    tagColor: 'error',
  },
  non_conformity_assigned: {
    icon: <WarningOutlined />,
    color: '#ff4d4f',
    tagColor: 'error',
  },
  audit_scheduled: {
    icon: <AuditOutlined />,
    color: '#722ed1',
    tagColor: 'purple',
  },
  system: {
    icon: <BellOutlined />,
    color: '#595959',
    tagColor: 'default',
  },
}

// 알림 타입 한글 레이블
const typeLabels: Record<NotificationType, string> = {
  evidence_expiring: '증적 만료',
  scheduled_task_due: '정기 활동',
  corrective_action_due: '시정조치',
  non_conformity_assigned: '부적합',
  audit_scheduled: '감사 예정',
  system: '시스템',
}

const NotificationItem = ({ notification, onClick, showActions: _showActions = false }: NotificationItemProps) => {
  const config = notificationConfig[notification.type] || notificationConfig.system
  const typeLabel = typeLabels[notification.type] || '알림'
  const timeAgo = dayjs(notification.createdAt).fromNow()

  return (
    <List.Item
      onClick={onClick}
      style={{
        padding: '12px 16px',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: notification.isRead ? '#fff' : '#f6ffed',
        borderBottom: '1px solid #f0f0f0',
        transition: 'background-color 0.3s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = notification.isRead
            ? '#fafafa'
            : '#e6f7e6'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = notification.isRead
          ? '#fff'
          : '#f6ffed'
      }}
    >
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        {/* 아이콘 */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: `${config.color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: config.color,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {config.icon}
        </div>

        {/* 내용 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 4,
            }}
          >
            <Text
              strong={!notification.isRead}
              style={{
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              {notification.title}
            </Text>
            <Tag color={config.tagColor} style={{ marginLeft: 8, flexShrink: 0 }}>
              {typeLabel}
            </Tag>
          </div>

          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{
              margin: 0,
              fontSize: 13,
              color: '#595959',
              lineHeight: 1.5,
            }}
          >
            {notification.message}
          </Paragraph>

          <Text type="secondary" style={{ fontSize: 12 }}>
            {timeAgo}
          </Text>
        </div>

        {/* 읽지 않음 표시 */}
        {!notification.isRead && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#1890ff',
              flexShrink: 0,
              marginTop: 4,
            }}
          />
        )}
      </div>
    </List.Item>
  )
}

export default NotificationItem
