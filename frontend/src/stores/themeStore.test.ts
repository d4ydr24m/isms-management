import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useThemeStore } from './themeStore'

// window.matchMedia mock
const mockMatchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
})

describe('themeStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // document.documentElement의 classList 초기화
    document.documentElement.classList.remove('dark')
  })

  it('초기 상태가 올바르다', () => {
    const { result } = renderHook(() => useThemeStore())

    expect(result.current.mode).toBeDefined()
    expect(typeof result.current.isDark).toBe('boolean')
  })

  it('setMode("dark")가 다크 모드를 설정한다', () => {
    const { result } = renderHook(() => useThemeStore())

    act(() => {
      result.current.setMode('dark')
    })

    expect(result.current.mode).toBe('dark')
    expect(result.current.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setMode("light")가 라이트 모드를 설정한다', () => {
    const { result } = renderHook(() => useThemeStore())

    // 먼저 다크 모드로 설정
    act(() => {
      result.current.setMode('dark')
    })

    // 라이트 모드로 변경
    act(() => {
      result.current.setMode('light')
    })

    expect(result.current.mode).toBe('light')
    expect(result.current.isDark).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setMode("system")가 시스템 테마를 따른다', () => {
    // 시스템이 라이트 모드인 경우
    mockMatchMedia.mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { result } = renderHook(() => useThemeStore())

    act(() => {
      result.current.setMode('system')
    })

    expect(result.current.mode).toBe('system')
  })

  it('toggleTheme이 다크와 라이트 사이를 전환한다', () => {
    const { result } = renderHook(() => useThemeStore())

    // 다크 모드로 설정
    act(() => {
      result.current.setMode('dark')
    })

    expect(result.current.isDark).toBe(true)

    // 토글
    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.mode).toBe('light')
    expect(result.current.isDark).toBe(false)

    // 다시 토글
    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.mode).toBe('dark')
    expect(result.current.isDark).toBe(true)
  })

  it('다크 모드에서 document에 dark 클래스가 추가된다', () => {
    const { result } = renderHook(() => useThemeStore())

    act(() => {
      result.current.setMode('dark')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('라이트 모드에서 document에서 dark 클래스가 제거된다', () => {
    const { result } = renderHook(() => useThemeStore())

    // 먼저 다크 모드
    act(() => {
      result.current.setMode('dark')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // 라이트 모드로 변경
    act(() => {
      result.current.setMode('light')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
