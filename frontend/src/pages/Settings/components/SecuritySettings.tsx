import { useState, useEffect } from 'react'
import { Card, Button, Spin, message, Modal, Form, Input, Space, Typography, Image, List } from 'antd'
import { LockOutlined, SafetyOutlined } from '@ant-design/icons'
import { authService } from '@/services/auth'
import { settingsService } from '@/services/settings'
import type { SecuritySettings as SecuritySettingsType, PasswordChangeRequest } from '@/types'
import dayjs from 'dayjs'

const { Text, Title } = Typography

const SecuritySettings: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<SecuritySettingsType | null>(null)
  const [mfaModalVisible, setMfaModalVisible] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [qrCode, setQrCode] = useState<string>('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [passwordForm] = Form.useForm()

  useEffect(() => {
    loadSecuritySettings()
  }, [])

  const loadSecuritySettings = async () => {
    try {
      setLoading(true)
      const data = await settingsService.getSecuritySettings()
      setSettings(data)
    } catch (error) {
      message.error('보안 설정을 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleEnableMfa = async () => {
    try {
      const mfaData = await authService.setupMfa()
      setQrCode(mfaData.qrCode)
      setBackupCodes(mfaData.backupCodes)
      setMfaModalVisible(true)
    } catch (error) {
      message.error('2단계 인증 설정에 실패했습니다')
    }
  }

  const handlePasswordChange = async (values: PasswordChangeRequest) => {
    try {
      await authService.changePassword(values)
      message.success('비밀번호가 성공적으로 변경되었습니다')
      setPasswordModalVisible(false)
      passwordForm.resetFields()
      await loadSecuritySettings()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '비밀번호 변경 실패')
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
    <>
      <Card title="보안 설정" bordered={false}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 2단계 인증 */}
          <div>
            <Space align="start">
              <SafetyOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div style={{ flex: 1 }}>
                <Title level={5} style={{ margin: 0 }}>2단계 인증</Title>
                <Text type="secondary">
                  계정 보안을 강화하기 위해 2단계 인증을 설정하세요
                </Text>
                <div style={{ marginTop: 8 }}>
                  {settings?.isMfaEnabled ? (
                    <>
                      <Text type="success">활성화됨</Text>
                      <Button
                        size="small"
                        style={{ marginLeft: 16 }}
                      >
                        비활성화
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="primary"
                      size="small"
                      onClick={handleEnableMfa}
                    >
                      활성화
                    </Button>
                  )}
                </div>
              </div>
            </Space>
          </div>

          {/* 비밀번호 변경 */}
          <div>
            <Space align="start">
              <LockOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <div style={{ flex: 1 }}>
                <Title level={5} style={{ margin: 0 }}>비밀번호 변경</Title>
                <Text type="secondary">
                  마지막 비밀번호 변경: {settings?.lastPasswordChange ? dayjs(settings.lastPasswordChange).format('YYYY-MM-DD') : '없음'}
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Button
                    size="small"
                    onClick={() => setPasswordModalVisible(true)}
                  >
                    비밀번호 변경
                  </Button>
                </div>
              </div>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 2FA 설정 모달 */}
      <Modal
        title="2단계 인증 설정"
        open={mfaModalVisible}
        onCancel={() => setMfaModalVisible(false)}
        footer={null}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5}>1. QR 코드를 스캔하세요</Title>
            <Text type="secondary">
              Google Authenticator 또는 유사한 앱을 사용하여 QR 코드를 스캔하세요
            </Text>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Image
                src={qrCode}
                alt="QR Code"
                width={200}
                preview={false}
              />
            </div>
          </div>

          <div>
            <Title level={5}>2. 백업 코드를 안전하게 보관하세요</Title>
            <Text type="secondary">
              기기를 분실한 경우 백업 코드로 계정에 접근할 수 있습니다
            </Text>
            <List
              size="small"
              bordered
              dataSource={backupCodes}
              renderItem={(code) => <List.Item>{code}</List.Item>}
              style={{ marginTop: 16 }}
            />
          </div>
        </Space>
      </Modal>

      {/* 비밀번호 변경 모달 */}
      <Modal
        title="비밀번호 변경"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false)
          passwordForm.resetFields()
        }}
        footer={null}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            label="현재 비밀번호"
            name="currentPassword"
            rules={[{ required: true, message: '현재 비밀번호를 입력하세요' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="새 비밀번호"
            name="newPassword"
            rules={[
              { required: true, message: '새 비밀번호를 입력하세요' },
              { min: 8, message: '비밀번호는 최소 8자 이상이어야 합니다' },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            label="새 비밀번호 확인"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '비밀번호를 다시 입력하세요' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('비밀번호가 일치하지 않습니다'))
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                변경
              </Button>
              <Button onClick={() => {
                setPasswordModalVisible(false)
                passwordForm.resetFields()
              }}>
                취소
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default SecuritySettings
