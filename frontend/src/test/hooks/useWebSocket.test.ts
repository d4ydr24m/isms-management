import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { MockWebSocket } from '../setup'

describe('useWebSocket', () => {
  const mockUrl = 'ws://localhost:8000/ws/notifications'

  beforeEach(() => {
    MockWebSocket.clearInstances()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('연결 관리', () => {
    it('제공된 URL로 WebSocket 연결을 생성한다', () => {
      renderHook(() => useWebSocket({ url: mockUrl }))

      expect(MockWebSocket.instances).toHaveLength(1)
      expect(MockWebSocket.instances[0].url).toBe(mockUrl)
    })

    it('초기 상태는 connecting이다', () => {
      const { result } = renderHook(() => useWebSocket({ url: mockUrl }))

      expect(result.current.connectionState).toBe('connecting')
    })

    it('연결 성공 시 상태가 connected로 변경된다', async () => {
      const { result } = renderHook(() => useWebSocket({ url: mockUrl }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      expect(result.current.connectionState).toBe('connected')
      expect(result.current.isConnected).toBe(true)
    })

    it('연결 종료 시 상태가 disconnected로 변경된다', async () => {
      vi.useFakeTimers()

      const { result } = renderHook(() => useWebSocket({
        url: mockUrl,
        autoReconnect: false
      }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      await act(async () => {
        MockWebSocket.instances[0].simulateClose()
      })

      expect(result.current.connectionState).toBe('disconnected')
      expect(result.current.isConnected).toBe(false)
    })

    it('에러 발생 시 상태가 error로 변경된다', async () => {
      const { result } = renderHook(() => useWebSocket({ url: mockUrl }))

      await act(async () => {
        MockWebSocket.instances[0].simulateError()
      })

      expect(result.current.connectionState).toBe('error')
    })
  })

  describe('메시지 수신', () => {
    it('메시지 수신 시 onMessage 콜백이 호출된다', async () => {
      const onMessage = vi.fn()
      renderHook(() => useWebSocket({ url: mockUrl, onMessage }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      const testMessage = { type: 'notification', data: { id: 1 } }

      await act(async () => {
        MockWebSocket.instances[0].simulateMessage(testMessage)
      })

      expect(onMessage).toHaveBeenCalledWith(testMessage)
    })

    it('lastMessage에 마지막 수신 메시지가 저장된다', async () => {
      const { result } = renderHook(() => useWebSocket({ url: mockUrl }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      const testMessage = { type: 'notification', data: { id: 1 } }

      await act(async () => {
        MockWebSocket.instances[0].simulateMessage(testMessage)
      })

      expect(result.current.lastMessage).toEqual(testMessage)
    })
  })

  describe('메시지 전송', () => {
    it('연결 상태에서 메시지 전송이 가능하다', async () => {
      const { result } = renderHook(() => useWebSocket({ url: mockUrl }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      const testMessage = { type: 'ping' }

      act(() => {
        result.current.sendMessage(testMessage)
      })

      expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(JSON.stringify(testMessage))
    })

    it('연결되지 않은 상태에서 메시지 전송은 무시된다', () => {
      const { result } = renderHook(() => useWebSocket({ url: mockUrl }))

      const testMessage = { type: 'ping' }

      act(() => {
        result.current.sendMessage(testMessage)
      })

      expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled()
    })
  })

  describe('자동 재연결', () => {
    it('연결 끊김 시 자동 재연결을 시도한다', async () => {
      vi.useFakeTimers()

      renderHook(() => useWebSocket({
        url: mockUrl,
        autoReconnect: true,
        reconnectInterval: 3000
      }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      await act(async () => {
        MockWebSocket.instances[0].simulateClose(1006, 'Connection lost')
      })

      expect(MockWebSocket.instances).toHaveLength(1)

      await act(async () => {
        vi.advanceTimersByTime(3000)
      })

      expect(MockWebSocket.instances).toHaveLength(2)
    })

    it('autoReconnect가 false면 재연결하지 않는다', async () => {
      vi.useFakeTimers()

      renderHook(() => useWebSocket({
        url: mockUrl,
        autoReconnect: false
      }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      await act(async () => {
        MockWebSocket.instances[0].simulateClose()
      })

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(MockWebSocket.instances).toHaveLength(1)
    })

    it('최대 재연결 횟수에 도달하면 재연결을 중단한다', async () => {
      vi.useFakeTimers()

      const { result } = renderHook(() => useWebSocket({
        url: mockUrl,
        autoReconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      }))

      // 연결 실패 시뮬레이션
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          const lastInstance = MockWebSocket.instances[MockWebSocket.instances.length - 1]
          lastInstance.simulateError()
          lastInstance.simulateClose(1006)
        })

        await act(async () => {
          vi.advanceTimersByTime(1000)
        })
      }

      // 최대 3번 재연결 시도 후 중단 (initial + 3 retries = 4)
      expect(MockWebSocket.instances.length).toBeLessThanOrEqual(4)
    })
  })

  describe('수동 연결 제어', () => {
    it('disconnect 호출 시 연결을 종료한다', async () => {
      const { result } = renderHook(() => useWebSocket({ url: mockUrl }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      act(() => {
        result.current.disconnect()
      })

      expect(MockWebSocket.instances[0].close).toHaveBeenCalled()
    })

    it('connect 호출 시 새 연결을 생성한다', async () => {
      const { result } = renderHook(() => useWebSocket({
        url: mockUrl,
        autoConnect: false
      }))

      expect(MockWebSocket.instances).toHaveLength(0)

      act(() => {
        result.current.connect()
      })

      expect(MockWebSocket.instances).toHaveLength(1)
    })
  })

  describe('훅 언마운트', () => {
    it('언마운트 시 WebSocket 연결을 정리한다', async () => {
      const { unmount } = renderHook(() => useWebSocket({ url: mockUrl }))

      await act(async () => {
        MockWebSocket.instances[0].simulateOpen()
      })

      unmount()

      expect(MockWebSocket.instances[0].close).toHaveBeenCalled()
    })
  })

  describe('토큰 기반 인증', () => {
    it('토큰이 제공되면 URL에 쿼리 파라미터로 추가된다', () => {
      const token = 'test-token-123'
      renderHook(() => useWebSocket({ url: mockUrl, token }))

      expect(MockWebSocket.instances[0].url).toBe(`${mockUrl}?token=${token}`)
    })

    it('토큰이 없으면 원래 URL을 사용한다', () => {
      renderHook(() => useWebSocket({ url: mockUrl }))

      expect(MockWebSocket.instances[0].url).toBe(mockUrl)
    })
  })
})
