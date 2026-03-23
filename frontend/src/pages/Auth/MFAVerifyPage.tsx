import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Alert } from 'antd'
import { SafetyOutlined } from '@ant-design/icons'
import { authService } from '@/services'
import { useAuthStore } from '@/stores/authStore'

const MFAVerifyPage = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const { setUser } = useAuthStore()

  useEffect(() => {
    // Auto-submit when 6 digits are entered
    if (code.length === 6) {
      handleVerify(code)
    }
  }, [code])

  const handleVerify = async (verificationCode: string) => {
    if (isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await authService.verifyMfa({ token: verificationCode })

      if (response.user) {
        setUser({
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          departmentId: null,
          department: null,
          roles: response.user.roles,
          permissions: [],
          isActive: true,
          isMfaEnabled: true,
        })
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.message || '인증에 실패했습니다')
      setCode('')
      form.setFieldsValue({ code: '' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (values: { code: string }) => {
    await handleVerify(values.code)
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numeric input
    const numericValue = e.target.value.replace(/\D/g, '')
    setCode(numericValue)
    form.setFieldsValue({ code: numericValue })

    if (error) {
      setError(null)
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
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <SafetyOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          <h1 style={{ marginTop: '16px' }}>2단계 인증</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>
            인증 앱에 표시된 6자리 코드를 입력해 주세요
          </p>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="mfa-verify"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="code"
            rules={[
              { required: true, message: '인증 코드를 입력해 주세요' },
              {
                len: 6,
                message: '인증 코드는 6자리여야 합니다',
              },
            ]}
          >
            <Input
              prefix={<SafetyOutlined />}
              placeholder="000000"
              maxLength={6}
              disabled={isLoading}
              aria-label="인증 코드"
              value={code}
              onChange={handleCodeChange}
              style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block disabled={isLoading}>
              {isLoading ? '확인 중...' : '확인'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/login">로그인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  )
}

export default MFAVerifyPage
