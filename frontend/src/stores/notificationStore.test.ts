import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNotificationStore } from './notificationStore'
import { notificationService } from '@/services'

vi.mock('@/services', () => ({
  notificationService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}))

const mockNotifications = [
  {
    id: 1,
    userId: 1,
    type: 'evidence_expiring' as const,
    title: 'Evidence Expiring',
    message: 'Evidence will expire soon',
    link: null,
    isRead: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    userId: 1,
    type: 'system' as const,
    title: 'System Update',
    message: 'System will be updated',
    link: null,
    isRead: true,
    createdAt: '2024-01-02T00:00:00Z',
  },
]

describe('notificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 스토어 상태 초기화
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.clearNotifications()
    })
  })

  it('초기 상태가 올바르다', () => {
    const { result } = renderHook(() => useNotificationStore())

    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.isLoading).toBe(false)
  })

  it('fetchNotifications가 알림을 가져온다', async () => {
    const { result } = renderHook(() => useNotificationStore())

    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      items: mockNotifications,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      data: mockNotifications,
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    })

    await act(async () => {
      await result.current.fetchNotifications()
    })

    expect(result.current.notifications).toEqual(mockNotifications)
    expect(result.current.unreadCount).toBe(1) // 1개만 읽지 않음
  })

  it('fetchNotifications 실패 시 로딩 상태만 변경한다', async () => {
    const { result } = renderHook(() => useNotificationStore())

    vi.mocked(notificationService.getNotifications).mockRejectedValue(new Error('Network error'))

    await act(async () => {
      await result.current.fetchNotifications()
    })

    expect(result.current.notifications).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('markAsRead가 알림을 읽음 처리한다', async () => {
    const { result } = renderHook(() => useNotificationStore())

    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      items: mockNotifications,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      data: mockNotifications,
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    })
    vi.mocked(notificationService.markAsRead).mockResolvedValue(undefined)

    // 먼저 알림 로드
    await act(async () => {
      await result.current.fetchNotifications()
    })

    expect(result.current.unreadCount).toBe(1)

    // 알림을 읽음 처리
    await act(async () => {
      await result.current.markAsRead(1)
    })

    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.find((n) => n.id === 1)?.isRead).toBe(true)
  })

  it('markAllAsRead가 모든 알림을 읽음 처리한다', async () => {
    const { result } = renderHook(() => useNotificationStore())

    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      items: mockNotifications,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      data: mockNotifications,
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    })
    vi.mocked(notificationService.markAllAsRead).mockResolvedValue(undefined)

    // 먼저 알림 로드
    await act(async () => {
      await result.current.fetchNotifications()
    })

    expect(result.current.unreadCount).toBe(1)

    // 모든 알림을 읽음 처리
    await act(async () => {
      await result.current.markAllAsRead()
    })

    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications.every((n) => n.isRead)).toBe(true)
  })

  it('addNotification이 알림을 추가한다', () => {
    const { result } = renderHook(() => useNotificationStore())
    const newNotification = {
      id: 3,
      userId: 1,
      type: 'audit_scheduled' as const,
      title: 'Audit Scheduled',
      message: 'New audit has been scheduled',
      link: null,
      isRead: false,
      createdAt: '2024-01-03T00:00:00Z',
    }

    act(() => {
      result.current.addNotification(newNotification)
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0]).toEqual(newNotification)
    expect(result.current.unreadCount).toBe(1)
  })

  it('clearNotifications가 알림을 지운다', async () => {
    const { result } = renderHook(() => useNotificationStore())

    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      items: mockNotifications,
      total: 2,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      data: mockNotifications,
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    })

    // 먼저 알림 로드
    await act(async () => {
      await result.current.fetchNotifications()
    })

    expect(result.current.notifications).toHaveLength(2)

    // 알림 지우기
    act(() => {
      result.current.clearNotifications()
    })

    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })
})
