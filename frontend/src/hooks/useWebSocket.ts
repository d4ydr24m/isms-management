import { useState, useEffect, useCallback, useRef } from 'react'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseWebSocketOptions {
  url: string
  token?: string
  onMessage?: (data: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  autoConnect?: boolean
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export interface UseWebSocketReturn {
  connectionState: ConnectionState
  isConnected: boolean
  lastMessage: any | null
  sendMessage: (data: any) => void
  connect: () => void
  disconnect: () => void
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    token,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoConnect = true,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [lastMessage, setLastMessage] = useState<any | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isManualDisconnectRef = useRef(false)

  const getWebSocketUrl = useCallback((): string => {
    if (token) {
      return `${url}?token=${token}`
    }
    return url
  }, [url, token])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    isManualDisconnectRef.current = false
    setConnectionState('connecting')

    const ws = new WebSocket(getWebSocketUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionState('connected')
      reconnectAttemptsRef.current = 0
      onConnect?.()
    }

    ws.onclose = (event) => {
      setConnectionState('disconnected')
      onDisconnect?.()

      // 자동 재연결 시도
      if (
        autoReconnect &&
        !isManualDisconnectRef.current &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1
          connect()
        }, reconnectInterval)
      }
    }

    ws.onerror = (error) => {
      setConnectionState('error')
      onError?.(error)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)
        onMessage?.(data)
      } catch {
        // JSON 파싱 실패 시 원본 데이터 사용
        setLastMessage(event.data)
        onMessage?.(event.data)
      }
    }
  }, [
    getWebSocketUrl,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    autoReconnect,
    reconnectInterval,
    maxReconnectAttempts,
  ])

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  // 초기 연결
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  }
}
