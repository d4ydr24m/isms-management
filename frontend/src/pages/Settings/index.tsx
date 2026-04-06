import { useState, useEffect } from 'react'
import { Tabs } from 'antd'
import { UserOutlined, SafetyOutlined, BellOutlined, SettingOutlined, DatabaseOutlined } from '@ant-design/icons'
import { ProfileSettings, SecuritySettings, NotificationSettings, SystemSettings, BackupSettings } from './components'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/services/api'

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile')
  const [isAdmin, setIsAdmin] = useState(false)
  const { user } = useAuthStore()

  useEffect(() => {
    // Check permissions from /auth/me
    const checkPermissions = async () => {
      try {
        const res = await apiClient.get<{ data: { permissions: string[] } }>('/auth/me')
        const perms = res.data.data?.permissions || []
        setIsAdmin(perms.includes('all') || perms.includes('system:admin'))
      } catch {
        setIsAdmin(false)
      }
    }
    checkPermissions()
  }, [user])

  const items = [
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined />
          프로필
        </span>
      ),
      children: <ProfileSettings />,
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyOutlined />
          보안
        </span>
      ),
      children: <SecuritySettings />,
    },
    {
      key: 'notification',
      label: (
        <span>
          <BellOutlined />
          알림
        </span>
      ),
      children: <NotificationSettings />,
    },
    ...(isAdmin
      ? [
          {
            key: 'system',
            label: (
              <span>
                <SettingOutlined />
                시스템
              </span>
            ),
            children: <SystemSettings />,
          },
          {
            key: 'backup',
            label: (
              <span>
                <DatabaseOutlined />
                백업/복원
              </span>
            ),
            children: <BackupSettings />,
          },
        ]
      : []),
  ]

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ margin: 0, marginBottom: 24, fontSize: '24px', fontWeight: 'bold' }}>
        설정
      </h1>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
      />
    </div>
  )
}

export default Settings
