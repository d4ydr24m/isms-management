// 알림 관련 타입
export type NotificationType =
  | 'evidence_expiring'
  | 'scheduled_task_due'
  | 'corrective_action_due'
  | 'non_conformity_assigned'
  | 'audit_scheduled'
  | 'system'

export interface Notification {
  id: number
  userId: number
  type: NotificationType
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationSetting {
  id: number
  userId: number
  type: NotificationType
  emailEnabled: boolean
  appEnabled: boolean
  frequency: 'realtime' | 'daily' | 'weekly'
}

export interface NotificationSettingUpdate {
  type: NotificationType
  emailEnabled?: boolean
  appEnabled?: boolean
  frequency?: 'realtime' | 'daily' | 'weekly'
}
