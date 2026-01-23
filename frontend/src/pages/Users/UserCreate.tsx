import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Space, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { userService } from '@/services/users'
import type { Role, UserCreate as UserCreateType } from '@/types'

function UserCreate() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      const rolesData = await userService.getRoles()
      setRoles(rolesData)
    } catch (error) {
      message.error('역할 목록을 불러오는데 실패했습니다')
    }
  }

  const handleSubmit = async (values: UserCreateType) => {
    setLoading(true)
    try {
      await userService.createUser(values)
      message.success('사용자가 생성되었습니다')
      navigate('/users')
    } catch (error) {
      message.error('사용자 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const validatePassword = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error('비밀번호를 입력해주세요'))
    }
    if (value.length < 8) {
      return Promise.reject(new Error('최소 8자 이상이어야 합니다'))
    }
    if (!/(?=.*[a-z])/.test(value)) {
      return Promise.reject(new Error('소문자를 포함해야 합니다'))
    }
    if (!/(?=.*[A-Z])/.test(value)) {
      return Promise.reject(new Error('대문자를 포함해야 합니다'))
    }
    if (!/(?=.*\d)/.test(value)) {
      return Promise.reject(new Error('숫자를 포함해야 합니다'))
    }
    if (!/(?=.*[@$!%*?&])/.test(value)) {
      return Promise.reject(new Error('특수문자를 포함해야 합니다'))
    }
    return Promise.resolve()
  }

  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ marginBottom: '16px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
          목록으로
        </Button>
      </Space>

      <Card title="사용자 생성">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 600 }}
        >
          <Form.Item
            label="이름"
            name="name"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input placeholder="홍길동" />
          </Form.Item>

          <Form.Item
            label="이메일"
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해주세요' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다' },
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item
            label="비밀번호"
            name="password"
            rules={[{ validator: validatePassword }]}
            extra="최소 8자, 대소문자, 숫자, 특수문자를 포함해야 합니다"
          >
            <Input.Password placeholder="비밀번호" />
          </Form.Item>

          <Form.Item
            label="비밀번호 확인"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '비밀번호를 다시 입력해주세요' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="비밀번호 확인" />
          </Form.Item>

          <Form.Item label="부서" name="departmentId">
            <Input type="number" placeholder="부서 ID (선택사항)" />
          </Form.Item>

          <Form.Item
            label="역할"
            name="roleIds"
            rules={[{ required: true, message: '역할을 선택해주세요' }]}
          >
            <Select
              mode="multiple"
              placeholder="역할을 선택하세요"
              options={roles.map((role) => ({
                label: role.name,
                value: role.id,
              }))}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                생성
              </Button>
              <Button onClick={() => navigate('/users')}>취소</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default UserCreate
