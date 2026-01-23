import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean

  // Actions
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const getSystemTheme = (): boolean => {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

const calculateIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode === 'dark'
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDark: getSystemTheme(),

      setMode: (mode) => {
        const isDark = calculateIsDark(mode)
        set({ mode, isDark })

        // Apply theme to document
        if (isDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },

      toggleTheme: () => {
        const currentMode = get().mode
        const newMode: ThemeMode = currentMode === 'dark' ? 'light' : 'dark'
        get().setMode(newMode)
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Apply theme after rehydration
        if (state) {
          const isDark = calculateIsDark(state.mode)
          if (isDark) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
        }
      },
    }
  )
)

// Listen to system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  mediaQuery.addEventListener('change', (e) => {
    const state = useThemeStore.getState()
    if (state.mode === 'system') {
      state.setMode('system')
    }
  })
}
