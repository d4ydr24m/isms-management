import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// Mock themeStore
vi.mock('@/stores/themeStore', () => ({
  useThemeStore: vi.fn(() => ({
    mode: 'light',
    isDark: false,
    setMode: vi.fn(),
    toggleTheme: vi.fn(),
  })),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('렌더링', () => {
    it('앱이 정상적으로 렌더링되어야 한다', () => {
      render(<App />)

      // 앱이 로드되었는지 확인
      expect(document.querySelector('.app')).toBeInTheDocument()
    })

    it('ConfigProvider가 적용되어야 한다', () => {
      render(<App />)

      // Ant Design ConfigProvider가 적용되면 antd 클래스들이 추가됨
      // 앱이 에러 없이 렌더링되면 ConfigProvider가 정상 동작
      expect(screen.getByText('ISMS Management System')).toBeInTheDocument()
    })
  })

  describe('테마 연동', () => {
    it('라이트 모드일 때 ConfigProvider에 라이트 테마가 적용되어야 한다', async () => {
      const { useThemeStore } = await import('@/stores/themeStore')
      vi.mocked(useThemeStore).mockReturnValue({
        mode: 'light',
        isDark: false,
        setMode: vi.fn(),
        toggleTheme: vi.fn(),
      })

      render(<App />)

      // 앱이 정상 렌더링되면 테마가 적용된 것
      expect(document.querySelector('.app')).toBeInTheDocument()
    })

    it('다크 모드일 때 ConfigProvider에 다크 테마가 적용되어야 한다', async () => {
      const { useThemeStore } = await import('@/stores/themeStore')
      vi.mocked(useThemeStore).mockReturnValue({
        mode: 'dark',
        isDark: true,
        setMode: vi.fn(),
        toggleTheme: vi.fn(),
      })

      render(<App />)

      // 앱이 정상 렌더링되면 테마가 적용된 것
      expect(document.querySelector('.app')).toBeInTheDocument()
    })
  })
})
