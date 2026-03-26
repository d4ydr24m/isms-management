import { BrowserRouter, useLocation } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import koKR from 'antd/locale/ko_KR'
import { useThemeStore } from '@/stores/themeStore'
import { getThemeConfig } from '@/theme/themeConfig'
import { useAuthStore } from '@/stores/authStore'
import MainLayout from '@/layouts/MainLayout'
import SessionTimeout from '@/components/common/SessionTimeout'

import AppRouter from '@/routes'

const AUTH_PATHS = ['/login', '/auth/mfa-verify']

function AppContent() {
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const isAuthPage = AUTH_PATHS.some((p) => location.pathname.startsWith(p))

  if (isAuthPage || !isAuthenticated) {
    return <AppRouter />
  }

  return (
    <MainLayout>
      <SessionTimeout />
      <AppRouter />
    </MainLayout>
  )
}

function App() {
  const { isDark } = useThemeStore()
  const themeConfig = getThemeConfig(isDark)

  return (
    <ConfigProvider locale={koKR} theme={themeConfig}>
      <AntApp>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  )
}

export default App
