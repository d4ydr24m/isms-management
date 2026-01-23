import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'

const { Sider } = Layout

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '대시보드',
    },
    {
      key: '/evidence',
      icon: <FileTextOutlined />,
      label: '증적 관리',
    },
    {
      key: '/controls',
      icon: <SafetyCertificateOutlined />,
      label: '통제항목',
    },
    {
      key: '/audits',
      icon: <AuditOutlined />,
      label: '감사 관리',
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '사용자 관리',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '설정',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={(value) => setCollapsed(value)}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <div
        style={{
          height: 32,
          margin: 16,
          background: 'rgba(255, 255, 255, 0.2)',
          textAlign: 'center',
          lineHeight: '32px',
          color: '#fff',
          fontWeight: 'bold',
        }}
      >
        {collapsed ? 'ISMS' : 'ISMS 관리'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  )
}

export default Sidebar
