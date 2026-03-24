// 알림 관련 타입
export type NotificationType =
  | 'evidence_expiring'
  | 'task_due'
  | 'nc_assigned'
  | 'audit_scheduled'
  | 'corrective_action_due'
  | 'audit_dday'
  | 'system'
  | 'asset_assigned'
  | 'asset_assignment_changed'
  | 'asset_handover'

export interface Notification {
  id: number
  userId: number
  notificationType: NotificationType
  title: string
  message: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationSetting {
  id: number
  userId: number
  notificationType: NotificationType
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
