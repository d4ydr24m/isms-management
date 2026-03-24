import { useState } from 'react'
import { Layout, Space, Badge, Avatar, Dropdown, Input } from 'antd'
import {
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useAuthStore, useNotificationStore } from '@/stores'
import { useNavigate } from 'react-router-dom'

const { Header: AntHeader } = Layout

const Header = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { unreadCount } = useNotificationStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '설정',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout,
    },
  ]

  return (
    <AntHeader
      style={{
        padding: '0 24px',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="통제항목, 증적, 사용자, 자산 검색..."
        style={{ width: 350 }}
        allowClear
        onPressEnter={(e) => {
          const value = (e.target as HTMLInputElement).value.trim()
          if (value) {
            navigate(`/search?q=${encodeURIComponent(value)}`)
          }
        }}
      />

      <Space size="large">
        <Badge count={unreadCount} offset={[-5, 5]}>
          <BellOutlined
            style={{ fontSize: 20, cursor: 'pointer' }}
            onClick={() => navigate('/notifications')}
          />
        </Badge>

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} />
            <span>{user?.name}</span>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  )
}

export default Header
