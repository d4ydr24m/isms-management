import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Form, Input, Button, Checkbox, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import type { LoginRequest } from '@/types'

const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm()
  const [localError, setLocalError] = useState<string | null>(null)

  const { login, isLoading, error, clearError } = useAuthStore()

  const from = (location.state as any)?.from?.pathname || '/dashboard'

  useEffect(() => {
    if (error) {
      setLocalError(error)
    }
  }, [error])

  const handleSubmit = async (values: LoginRequest) => {
    setLocalError(null)
    clearError()

    try {
      const response = await login(values)

      if (response.requiresMfa) {
        navigate('/auth/mfa-verify')
      } else {
        navigate(from)
      }
    } catch (err: any) {
      setLocalError(err.message || '로그인에 실패했습니다')
    }
  }

  const handleFieldChange = () => {
    if (localError || error) {
      setLocalError(null)
      clearError()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>ISMS 관리 시스템</h1>

        {(localError || error) && (
          <Alert
            message={localError || error}
            type="error"
            showIcon
            closable
            onClose={() => {
              setLocalError(null)
              clearError()
            }}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          onFieldsChange={handleFieldChange}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해 주세요' },
              { type: 'email', message: '올바른 이메일 형식을 입력해 주세요' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="이메일"
              disabled={isLoading}
              aria-label="이메일"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력해 주세요' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="비밀번호"
              disabled={isLoading}
              aria-label="비밀번호"
            />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox disabled={isLoading}>로그인 상태 유지</Checkbox>
              </Form.Item>
              <a href="/auth/forgot-password">비밀번호 찾기</a>
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block disabled={isLoading}>
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default LoginPage
