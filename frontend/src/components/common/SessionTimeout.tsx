import { useEffect, useRef, useCallback } from 'react'
import { App } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

const DEFAULT_TIMEOUT_MINUTES = 30
const WARNING_BEFORE_MINUTES = 1
const CHECK_INTERVAL_MS = 10_000 // check every 10 seconds

const SessionTimeout: React.FC = () => {
  const { modal } = App.useApp()
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuthStore()
  const lastActivityRef = useRef<number>(Date.now())
  const timeoutMinutesRef = useRef<number>(DEFAULT_TIMEOUT_MINUTES)
  const warningShownRef = useRef<boolean>(false)
  const modalRef = useRef<ReturnType<typeof modal.confirm> | null>(null)
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoLogoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()

    // If warning is showing and user interacts, dismiss it and reset
    if (warningShownRef.current) {
      warningShownRef.current = false
      if (modalRef.current) {
        modalRef.current.destroy()
        modalRef.current = null
      }
      if (autoLogoutTimerRef.current) {
        clearTimeout(autoLogoutTimerRef.current)
        autoLogoutTimerRef.current = null
      }
    }
  }, [])

  const performLogout = useCallback(async () => {
    warningShownRef.current = false
    if (modalRef.current) {
      modalRef.current.destroy()
      modalRef.current = null
    }
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current)
      autoLogoutTimerRef.current = null
    }
    try {
      await logout()
    } catch {
      // ignore logout errors
    }
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const showWarning = useCallback(() => {
    if (warningShownRef.current) return
    warningShownRef.current = true

    const remainingMs = WARNING_BEFORE_MINUTES * 60 * 1000

    // Auto-logout after the remaining time
    autoLogoutTimerRef.current = setTimeout(() => {
      performLogout()
    }, remainingMs)

    modalRef.current = modal.confirm({
      title: '세션 만료 경고',
      icon: <ExclamationCircleOutlined />,
      content: `세션이 곧 만료됩니다. ${WARNING_BEFORE_MINUTES}분 후 자동으로 로그아웃됩니다.`,
      okText: '연장',
      cancelText: '로그아웃',
      centered: true,
      onOk: () => {
        warningShownRef.current = false
        modalRef.current = null
        if (autoLogoutTimerRef.current) {
          clearTimeout(autoLogoutTimerRef.current)
          autoLogoutTimerRef.current = null
        }
        lastActivityRef.current = Date.now()
      },
      onCancel: () => {
        modalRef.current = null
        performLogout()
      },
    })
  }, [performLogout])

  // Fetch session timeout setting
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchTimeout = async () => {
      try {
        const response = await apiClient.get<Record<string, string>>('/system-settings')
        const data = response.data
        const minutes = Number(data.sessionTimeoutMinutes)
        if (!isNaN(minutes) && minutes > 0) {
          timeoutMinutesRef.current = minutes
        }
      } catch {
        // Use default timeout on error
      }
    }

    fetchTimeout()
  }, [isAuthenticated])

  // Set up activity listeners and idle check interval
  useEffect(() => {
    if (!isAuthenticated) return

    const events: Array<keyof WindowEventMap> = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    // Throttle activity updates to avoid excessive calls
    let throttleTimer: ReturnType<typeof setTimeout> | null = null
    const throttledReset = () => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        throttleTimer = null
      }, 1000)
      resetActivity()
    }

    events.forEach((event) => {
      window.addEventListener(event, throttledReset, { passive: true })
    })

    // Also track API calls by intercepting requests
    const interceptorId = apiClient.interceptors.request.use((config) => {
      lastActivityRef.current = Date.now()
      return config
    })

    // Periodically check idle time
    checkIntervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      const timeoutMs = timeoutMinutesRef.current * 60 * 1000
      const warningMs = timeoutMs - WARNING_BEFORE_MINUTES * 60 * 1000

      if (idleMs >= timeoutMs) {
        // Already past timeout, force logout
        performLogout()
      } else if (idleMs >= warningMs && !warningShownRef.current) {
        showWarning()
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledReset)
      })
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
      apiClient.interceptors.request.eject(interceptorId)
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
        checkIntervalRef.current = null
      }
      if (autoLogoutTimerRef.current) {
        clearTimeout(autoLogoutTimerRef.current)
        autoLogoutTimerRef.current = null
      }
      if (modalRef.current) {
        modalRef.current.destroy()
        modalRef.current = null
      }
      warningShownRef.current = false
    }
  }, [isAuthenticated, resetActivity, performLogout, showWarning])

  return null
}

export default SessionTimeout
