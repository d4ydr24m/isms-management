import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import koKR from 'antd/locale/ko_KR'

function App() {
  return (
    <ConfigProvider locale={koKR}>
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
