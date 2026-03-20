import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Spin, message } from 'antd'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'
import type { CurrentUser, ProfileUpdateRequest } from '@/types'

const ProfileSettings: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    try {
      setLoading(true)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      form.setFieldsValue({
        email: currentUser.email,
        name: currentUser.name,
        departmentId: currentUser.departmentId,
        department: currentUser.department,
      })
    } catch (error) {
      message.error('사용자 정보를 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: ProfileUpdateRequest) => {
    try {
      setSaving(true)
      await settingsService.updateProfile({
        name: values.name,
        departmentId: user?.departmentId ?? undefined,
      })
      message.success('프로필이 성공적으로 업데이트되었습니다')
      await loadUserInfo()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '업데이트 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Card title="프로필 정보" bordered={false}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          label="이메일"
          name="email"
        >
          <Input disabled />
        </Form.Item>

        <Form.Item
          label="이름"
          name="name"
          rules={[{ required: true, message: '이름을 입력하세요' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="부서"
          name="department"
        >
          <Input disabled />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            저장
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default ProfileSettings
