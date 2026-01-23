import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import koKR from 'antd/locale/ko_KR'
import { useThemeStore } from '@/stores/themeStore'
import { getThemeConfig } from '@/theme/themeConfig'

function App() {
  const { isDark } = useThemeStore()
  const themeConfig = getThemeConfig(isDark)

  return (
    <ConfigProvider locale={koKR} theme={themeConfig}>
      <BrowserRouter>
        <div className="app">
          <h1>ISMS Management System</h1>
          <p>프로젝트 초기화 완료</p>
        </div>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
