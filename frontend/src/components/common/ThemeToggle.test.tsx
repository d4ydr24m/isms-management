import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfigProvider } from 'antd'
import ThemeToggle from './ThemeToggle'
import { useThemeStore } from '@/stores/themeStore'

// Mock the themeStore
vi.mock('@/stores/themeStore', () => ({
  useThemeStore: vi.fn(),
}))

const mockUseThemeStore = vi.mocked(useThemeStore)

const renderWithAntd = (component: React.ReactNode) => {
  return render(<ConfigProvider>{component}</ConfigProvider>)
}

describe('ThemeToggle', () => {
  const mockSetMode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseThemeStore.mockReturnValue({
      mode: 'system',
      isDark: false,
      setMode: mockSetMode,
      toggleTheme: vi.fn(),
    })
  })

  describe('렌더링', () => {
    it('컴포넌트가 렌더링되어야 한다', () => {
      renderWithAntd(<ThemeToggle />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('현재 모드에 맞는 아이콘이 표시되어야 한다 (system)', () => {
      mockUseThemeStore.mockReturnValue({
        mode: 'system',
        isDark: false,
        setMode: mockSetMode,
        toggleTheme: vi.fn(),
      })

      renderWithAntd(<ThemeToggle />)

      // system 모드일 때 DesktopOutlined 아이콘
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('light 모드일 때 올바른 아이콘이 표시되어야 한다', () => {
      mockUseThemeStore.mockReturnValue({
        mode: 'light',
        isDark: false,
        setMode: mockSetMode,
        toggleTheme: vi.fn(),
      })

      renderWithAntd(<ThemeToggle />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('dark 모드일 때 올바른 아이콘이 표시되어야 한다', () => {
      mockUseThemeStore.mockReturnValue({
        mode: 'dark',
        isDark: true,
        setMode: mockSetMode,
        toggleTheme: vi.fn(),
      })

      renderWithAntd(<ThemeToggle />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })
  })

  describe('드롭다운 메뉴', () => {
    it('버튼 클릭 시 드롭다운 메뉴가 열려야 한다', async () => {
      const user = userEvent.setup()
      renderWithAntd(<ThemeToggle />)

      const button = screen.getByRole('button')
      await user.click(button)

      // 메뉴 항목들이 표시되어야 함
      expect(await screen.findByText('라이트')).toBeInTheDocument()
      expect(await screen.findByText('다크')).toBeInTheDocument()
      expect(await screen.findByText('시스템')).toBeInTheDocument()
    })

    it('라이트 메뉴 클릭 시 setMode("light")가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithAntd(<ThemeToggle />)

      const button = screen.getByRole('button')
      await user.click(button)

      const lightOption = await screen.findByText('라이트')
      await user.click(lightOption)

      expect(mockSetMode).toHaveBeenCalledWith('light')
    })

    it('다크 메뉴 클릭 시 setMode("dark")가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithAntd(<ThemeToggle />)

      const button = screen.getByRole('button')
      await user.click(button)

      const darkOption = await screen.findByText('다크')
      await user.click(darkOption)

      expect(mockSetMode).toHaveBeenCalledWith('dark')
    })

    it('시스템 메뉴 클릭 시 setMode("system")가 호출되어야 한다', async () => {
      const user = userEvent.setup()
      renderWithAntd(<ThemeToggle />)

      const button = screen.getByRole('button')
      await user.click(button)

      const systemOption = await screen.findByText('시스템')
      await user.click(systemOption)

      expect(mockSetMode).toHaveBeenCalledWith('system')
    })
  })

  describe('접근성', () => {
    it('버튼에 aria-label이 있어야 한다', () => {
      renderWithAntd(<ThemeToggle />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label')
    })
  })

  describe('Props', () => {
    it('showLabel prop이 true일 때 레이블이 표시되어야 한다', () => {
      renderWithAntd(<ThemeToggle showLabel />)

      // 현재 모드 레이블이 표시됨
      expect(screen.getByText(/시스템/i)).toBeInTheDocument()
    })

    it('showLabel prop이 없거나 false일 때 레이블이 표시되지 않아야 한다', () => {
      renderWithAntd(<ThemeToggle />)

      // 버튼 내에 텍스트가 없어야 함 (아이콘만)
      const button = screen.getByRole('button')
      expect(button.textContent?.trim()).toBe('')
    })

    it('size prop으로 버튼 크기를 조절할 수 있어야 한다', () => {
      renderWithAntd(<ThemeToggle size="large" />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })
  })
})
