import { create } from 'zustand'
import type { Notification } from '@/types'
import { notificationService } from '@/services'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean

  // Actions
  fetchNotifications: () => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  addNotification: (notification: Notification) => void
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true })
    try {
      const response = await notificationService.getNotifications({ page: 1, limit: 50 })
      const notifications = (response.data || response.items || []) as Notification[]
      const unreadCount = notifications.filter((n: Notification) => !n.isRead).length

      set({
        notifications,
        unreadCount,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  markAsRead: async (id) => {
    try {
      await notificationService.markAsRead(id)

      const notifications = get().notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      )
      const unreadCount = notifications.filter((n) => !n.isRead).length

      set({ notifications, unreadCount })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationService.markAllAsRead()

      const notifications = get().notifications.map((n) => ({ ...n, isRead: true }))

      set({ notifications, unreadCount: 0 })
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  },

  addNotification: (notification) => {
    const notifications = [notification, ...get().notifications]
    const unreadCount = notifications.filter((n) => !n.isRead).length

    set({ notifications, unreadCount })
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 })
  },
}))
