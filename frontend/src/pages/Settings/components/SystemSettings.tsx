import { useState, useEffect } from 'react'
import {
  Card,
  Radio,
  Button,
  Spin,
  message,
  Space,
  Typography,
  Alert,
  InputNumber,
  Checkbox,
  Switch,
  Input,
  Divider,
} from 'antd'
import {
  SettingOutlined,
  LockOutlined,
  SafetyOutlined,
  MailOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { apiClient } from '@/services/api'

const { Text, Title } = Typography
const { TextArea } = Input

type CertificationType = 'ISMS' | 'ISMS-P'

interface SettingsState {
  certificationType: CertificationType
  maxLoginAttempts: number
  accountLockoutDurationMinutes: number
  sessionTimeoutMinutes: number
  passwordMinLength: number
  passwordRequireUppercase: boolean
  passwordRequireLowercase: boolean
  passwordRequireDigit: boolean
  passwordRequireSpecial: boolean
  passwordExpiryDays: number
  ipWhitelistEnabled: boolean
  ipWhitelist: string
  // SMTP
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpUseTls: boolean
  smtpFromEmail: string
  smtpFromName: string
}

const defaultSettings: SettingsState = {
  certificationType: 'ISMS-P',
  maxLoginAttempts: 5,
  accountLockoutDurationMinutes: 30,
  sessionTimeoutMinutes: 30,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireDigit: true,
  passwordRequireSpecial: true,
  passwordExpiryDays: 90,
  ipWhitelistEnabled: false,
  ipWhitelist: '',
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpUseTls: true,
  smtpFromEmail: '',
  smtpFromName: 'ISMS 관리 시스템',
}

function parseBool(val: string | undefined): boolean {
  return val === 'true'
}

function parseNum(val: string | undefined, fallback: number): number {
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

const SystemSettings: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [myIp, setMyIp] = useState<string>('')

  useEffect(() => {
    loadSettings()
    loadMyIp()
  }, [])

  const loadMyIp = async () => {
    try {
      const response = await apiClient.get<{ ip: string }>('/system-settings/my-ip')
      setMyIp(response.data.ip || '')
    } catch {
      // ignore
    }
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get<Record<string, string>>('/system-settings')
      const data = response.data
      setSettings({
        certificationType: (data.certificationType as CertificationType) || 'ISMS-P',
        maxLoginAttempts: parseNum(data.maxLoginAttempts, 5),
        accountLockoutDurationMinutes: parseNum(data.accountLockoutDurationMinutes, 30),
        sessionTimeoutMinutes: parseNum(data.sessionTimeoutMinutes, 30),
        passwordMinLength: parseNum(data.passwordMinLength, 8),
        passwordRequireUppercase: parseBool(data.passwordRequireUppercase),
        passwordRequireLowercase: parseBool(data.passwordRequireLowercase),
        passwordRequireDigit: parseBool(data.passwordRequireDigit),
        passwordRequireSpecial: parseBool(data.passwordRequireSpecial),
        passwordExpiryDays: parseNum(data.passwordExpiryDays, 90),
        ipWhitelistEnabled: parseBool(data.ipWhitelistEnabled),
        ipWhitelist: (data.ipWhitelist || '').replace(/,/g, '\n'),
        smtpEnabled: parseBool(data.smtpEnabled),
        smtpHost: data.smtpHost || '',
        smtpPort: parseNum(data.smtpPort, 587),
        smtpUser: data.smtpUser || '',
        smtpPassword: data.smtpPassword || '',
        smtpUseTls: data.smtpUseTls !== undefined ? parseBool(data.smtpUseTls) : true,
        smtpFromEmail: data.smtpFromEmail || '',
        smtpFromName: data.smtpFromName || 'ISMS 관리 시스템',
      })
    } catch {
      message.error('시스템 설정을 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        certificationType: settings.certificationType,
        maxLoginAttempts: String(settings.maxLoginAttempts),
        accountLockoutDurationMinutes: String(settings.accountLockoutDurationMinutes),
        sessionTimeoutMinutes: String(settings.sessionTimeoutMinutes),
        passwordMinLength: String(settings.passwordMinLength),
        passwordRequireUppercase: String(settings.passwordRequireUppercase),
        passwordRequireLowercase: String(settings.passwordRequireLowercase),
        passwordRequireDigit: String(settings.passwordRequireDigit),
        passwordRequireSpecial: String(settings.passwordRequireSpecial),
        passwordExpiryDays: String(settings.passwordExpiryDays),
        ipWhitelistEnabled: String(settings.ipWhitelistEnabled),
        ipWhitelist: settings.ipWhitelist
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .join(','),
        smtpEnabled: String(settings.smtpEnabled),
        smtpHost: settings.smtpHost,
        smtpPort: String(settings.smtpPort),
        smtpUser: settings.smtpUser,
        smtpPassword: settings.smtpPassword,
        smtpUseTls: String(settings.smtpUseTls),
        smtpFromEmail: settings.smtpFromEmail,
        smtpFromName: settings.smtpFromName,
      }
      await apiClient.put('/system-settings', payload)
      message.success('시스템 설정이 저장되었습니다')
    } catch {
      message.error('시스템 설정 저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 섹션 1: 인증 유형 */}
      <Card
        title={
          <Space>
            <SettingOutlined style={{ color: '#1890ff' }} />
            <span>인증 유형</span>
          </Space>
        }
        bordered={false}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">
            ISMS 인증은 80개 통제항목, ISMS-P 인증은 101개 통제항목(개인정보 처리 단계별
            요구사항 포함)을 적용합니다.
          </Text>
          <Radio.Group
            value={settings.certificationType}
            onChange={(e) => update('certificationType', e.target.value)}
            size="large"
          >
            <Radio.Button value="ISMS">ISMS</Radio.Button>
            <Radio.Button value="ISMS-P">ISMS-P</Radio.Button>
          </Radio.Group>
          {settings.certificationType === 'ISMS' ? (
            <Alert
              type="info"
              showIcon
              message="ISMS 인증 모드"
              description="관리체계 수립 및 운영(16개) + 보호대책 요구사항(64개) = 80개 통제항목이 적용됩니다. 개인정보 처리 단계별 요구사항은 제외됩니다."
            />
          ) : (
            <Alert
              type="info"
              showIcon
              message="ISMS-P 인증 모드"
              description="관리체계 수립 및 운영(16개) + 보호대책 요구사항(64개) + 개인정보 처리 단계별 요구사항(21개) = 101개 통제항목이 적용됩니다."
            />
          )}
        </Space>
      </Card>

      {/* 섹션 2: 보안 정책 */}
      <Card
        title={
          <Space>
            <LockOutlined style={{ color: '#faad14' }} />
            <span>보안 정책</span>
          </Space>
        }
        bordered={false}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>최대 로그인 시도 횟수</Text>
            <br />
            <InputNumber
              min={1}
              max={20}
              value={settings.maxLoginAttempts}
              onChange={(v) => update('maxLoginAttempts', v ?? 5)}
              style={{ width: 200, marginTop: 4 }}
              addonAfter="회"
            />
          </div>

          <div>
            <Text strong>계정 잠금 시간</Text>
            <br />
            <InputNumber
              min={1}
              max={1440}
              value={settings.accountLockoutDurationMinutes}
              onChange={(v) => update('accountLockoutDurationMinutes', v ?? 30)}
              style={{ width: 200, marginTop: 4 }}
              addonAfter="분"
            />
          </div>

          <div>
            <Text strong>세션 타임아웃</Text>
            <br />
            <InputNumber
              min={1}
              max={480}
              value={settings.sessionTimeoutMinutes}
              onChange={(v) => update('sessionTimeoutMinutes', v ?? 30)}
              style={{ width: 200, marginTop: 4 }}
              addonAfter="분"
            />
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div>
            <Text strong>비밀번호 최소 길이</Text>
            <br />
            <InputNumber
              min={8}
              max={32}
              value={settings.passwordMinLength}
              onChange={(v) => update('passwordMinLength', v ?? 8)}
              style={{ width: 200, marginTop: 4 }}
              addonAfter="자"
            />
          </div>

          <div>
            <Text strong>비밀번호 만료 기간</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              (0 = 만료 없음)
            </Text>
            <br />
            <InputNumber
              min={0}
              max={365}
              value={settings.passwordExpiryDays}
              onChange={(v) => update('passwordExpiryDays', v ?? 90)}
              style={{ width: 200, marginTop: 4 }}
              addonAfter="일"
            />
          </div>

          <div>
            <Text strong>비밀번호 요구사항</Text>
            <div style={{ marginTop: 8 }}>
              <Space direction="vertical">
                <Checkbox
                  checked={settings.passwordRequireUppercase}
                  onChange={(e) => update('passwordRequireUppercase', e.target.checked)}
                >
                  대문자 포함
                </Checkbox>
                <Checkbox
                  checked={settings.passwordRequireLowercase}
                  onChange={(e) => update('passwordRequireLowercase', e.target.checked)}
                >
                  소문자 포함
                </Checkbox>
                <Checkbox
                  checked={settings.passwordRequireDigit}
                  onChange={(e) => update('passwordRequireDigit', e.target.checked)}
                >
                  숫자 포함
                </Checkbox>
                <Checkbox
                  checked={settings.passwordRequireSpecial}
                  onChange={(e) => update('passwordRequireSpecial', e.target.checked)}
                >
                  특수문자 포함
                </Checkbox>
              </Space>
            </div>
          </div>
        </Space>
      </Card>

      {/* 섹션 3: IP 접근 제한 */}
      <Card
        title={
          <Space>
            <SafetyOutlined style={{ color: '#f5222d' }} />
            <span>IP 접근 제한</span>
          </Space>
        }
        bordered={false}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Space>
              <Switch
                checked={settings.ipWhitelistEnabled}
                onChange={(checked) => update('ipWhitelistEnabled', checked)}
              />
              <Text strong>IP 화이트리스트 활성화</Text>
            </Space>
          </div>

          <div>
            <Text strong>허용 IP 주소 목록</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              (한 줄에 하나의 IP 주소)
            </Text>
            <TextArea
              rows={6}
              placeholder={'예시:\n192.168.1.1\n10.0.0.0/24\n172.16.0.100'}
              value={settings.ipWhitelist}
              onChange={(e) => update('ipWhitelist', e.target.value)}
              disabled={!settings.ipWhitelistEnabled}
              style={{ marginTop: 8 }}
            />
          </div>

          {myIp && (
            <Alert
              type="info"
              showIcon
              message={`현재 접속 IP: ${myIp}`}
              description="이 IP가 화이트리스트에 포함되어 있지 않으면 활성화 후 접근이 차단됩니다."
            />
          )}

          <Alert
            type="warning"
            showIcon
            message="주의"
            description="잘못된 설정 시 관리자 접근이 차단될 수 있습니다. IP 화이트리스트를 활성화하기 전에 현재 접속 중인 IP가 목록에 포함되어 있는지 반드시 확인하세요."
          />
        </Space>
      </Card>

      {/* 섹션 4: 이메일(SMTP) 설정 */}
      <Card
        title={
          <Space>
            <MailOutlined style={{ color: '#1890ff' }} />
            <span>이메일(SMTP) 설정</span>
          </Space>
        }
        bordered={false}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Space>
              <Switch
                checked={settings.smtpEnabled}
                onChange={(checked) => update('smtpEnabled', checked)}
              />
              <Text strong>이메일 발송 활성화</Text>
            </Space>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Text strong>SMTP 서버</Text>
              <Input
                placeholder="smtp.gmail.com"
                value={settings.smtpHost}
                onChange={(e) => update('smtpHost', e.target.value)}
                disabled={!settings.smtpEnabled}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>포트</Text>
              <InputNumber
                min={1}
                max={65535}
                value={settings.smtpPort}
                onChange={(v) => update('smtpPort', v ?? 587)}
                disabled={!settings.smtpEnabled}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Text strong>SMTP 계정</Text>
              <Input
                placeholder="user@example.com"
                value={settings.smtpUser}
                onChange={(e) => update('smtpUser', e.target.value)}
                disabled={!settings.smtpEnabled}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>SMTP 비밀번호</Text>
              <Input.Password
                placeholder="비밀번호 또는 앱 비밀번호"
                value={settings.smtpPassword}
                onChange={(e) => update('smtpPassword', e.target.value)}
                disabled={!settings.smtpEnabled}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Text strong>발신자 이메일</Text>
              <Input
                placeholder="noreply@example.com"
                value={settings.smtpFromEmail}
                onChange={(e) => update('smtpFromEmail', e.target.value)}
                disabled={!settings.smtpEnabled}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Text strong>발신자 이름</Text>
              <Input
                placeholder="ISMS 관리 시스템"
                value={settings.smtpFromName}
                onChange={(e) => update('smtpFromName', e.target.value)}
                disabled={!settings.smtpEnabled}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          <div>
            <Space>
              <Checkbox
                checked={settings.smtpUseTls}
                onChange={(e) => update('smtpUseTls', e.target.checked)}
                disabled={!settings.smtpEnabled}
              >
                TLS 사용 (권장)
              </Checkbox>
            </Space>
          </div>

          <div>
            <Button
              icon={<SendOutlined />}
              onClick={async () => {
                setTestingEmail(true)
                try {
                  // Save first, then test
                  await handleSave()
                  const res = await apiClient.post<{ success: string; message: string }>('/system-settings/test-email')
                  if (res.data.success === 'true') {
                    message.success(res.data.message)
                  } else {
                    message.error(res.data.message)
                  }
                } catch {
                  message.error('테스트 이메일 발송에 실패했습니다')
                } finally {
                  setTestingEmail(false)
                }
              }}
              loading={testingEmail}
              disabled={!settings.smtpEnabled || !settings.smtpHost}
            >
              테스트 이메일 발송
            </Button>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              현재 로그인한 계정의 이메일로 테스트 이메일을 발송합니다.
            </Text>
          </div>

          <Alert
            type="info"
            showIcon
            message="Gmail 사용 시"
            description="Gmail SMTP를 사용하려면 Google 계정에서 '앱 비밀번호'를 생성해야 합니다. SMTP 서버: smtp.gmail.com, 포트: 587, TLS 사용."
          />
        </Space>
      </Card>

      {/* 저장 버튼 */}
      <div>
        <Button type="primary" size="large" onClick={handleSave} loading={saving}>
          저장
        </Button>
      </div>
    </Space>
  )
}

export default SystemSettings
