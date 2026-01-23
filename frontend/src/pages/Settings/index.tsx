import { useState } from 'react'
import { Tabs } from 'antd'
import { UserOutlined, SafetyOutlined, BellOutlined } from '@ant-design/icons'
import { ProfileSettings, SecuritySettings, NotificationSettings } from './components'

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile')

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
