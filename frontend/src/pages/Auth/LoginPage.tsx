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
      setLocalError(err.message || 'Login failed')
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
        <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>ISMS Management</h1>

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
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Email"
              disabled={isLoading}
              aria-label="Email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              disabled={isLoading}
              aria-label="Password"
            />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox disabled={isLoading}>Remember me</Checkbox>
              </Form.Item>
              <a href="/auth/forgot-password">Forgot password?</a>
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

export default LoginPage
