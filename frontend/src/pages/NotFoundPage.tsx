import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <Result
      status="404"
      title="404"
      subTitle="요청하신 페이지를 찾을 수 없습니다."
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          대시보드로 이동
        </Button>
      }
    />
  )
}

export default NotFoundPage
