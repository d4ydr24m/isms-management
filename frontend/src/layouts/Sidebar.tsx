import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  DatabaseOutlined,
  WarningOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { apiClient } from '@/services/api'

const { Sider } = Layout

interface SidebarProps {
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
}

const Sidebar = ({ collapsed, onCollapse }: SidebarProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const res = await apiClient.get<{ data: { permissions: string[] } }>('/auth/me')
        setPermissions(res.data.data?.permissions || [])
      } catch { /* ignore */ }
    }
    loadPermissions()
  }, [])

  const hasPermission = (perm: string): boolean => {
    if (permissions.includes('all')) return true
    // Check wildcard (e.g., "evidence:*" matches "evidence:read")
    const [category] = perm.split(':')
    if (permissions.includes(`${category}:*`)) return true
    return permissions.includes(perm)
  }

  const menuItems = useMemo(() => {
    const items: any[] = [
      {
        key: '/dashboard',
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
        key: '/assets',
        icon: <DatabaseOutlined />,
        label: '자산 관리',
      },
      {
        key: 'risk-group',
        icon: <WarningOutlined />,
        label: '위험 관리',
        children: [
          { key: '/risk', label: '위험 시나리오' },
          { key: '/risk/doa', label: 'DoA 설정' },
          { key: '/risk/treatments', label: '처리 계획' },
          { key: '/risk/soa', label: 'SOA 관리' },
          { key: '/risk/report', label: '보고서' },
          { key: '/risk/threats', label: '위협 DB' },
          { key: '/risk/vulnerabilities', label: '취약점 DB' },
        ],
      },
    ]

    // 사용자 관리 / 부서 관리: user:read 권한 필요
    if (hasPermission('user:read')) {
      items.push({
        key: '/users',
        icon: <UserOutlined />,
        label: '사용자 관리',
      })
      items.push({
        key: '/departments',
        icon: <TeamOutlined />,
        label: '부서 관리',
      })
    }

    // 감사 로그: system:admin 권한 필요
    if (hasPermission('system:admin')) {
      items.push({
        key: '/audit-logs',
        icon: <FileSearchOutlined />,
        label: '감사 로그',
      })
    }

    items.push({
      key: '/settings',
      icon: <SettingOutlined />,
      label: '설정',
    })

    return items
  }, [permissions])

  // 현재 경로에 맞는 선택된 메뉴 키 계산
  const selectedKeys = useMemo(() => {
    const pathname = location.pathname
    if (pathname === '/risk/threats') return ['/risk/threats']
    if (pathname === '/risk/vulnerabilities') return ['/risk/vulnerabilities']
    if (pathname === '/risk/doa') return ['/risk/doa']
    if (pathname === '/risk/treatments') return ['/risk/treatments']
    if (pathname === '/risk/soa') return ['/risk/soa']
    if (pathname === '/risk/report') return ['/risk/report']
    if (pathname.startsWith('/risk')) return ['/risk']
    return [pathname]
  }, [location.pathname])

  // 위험 관리 하위 경로인 경우 서브메뉴 자동 열기
  const defaultOpenKeys = useMemo(() => {
    if (location.pathname.startsWith('/risk')) return ['risk-group']
    return []
  }, [location.pathname])

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
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
        selectedKeys={selectedKeys}
        defaultOpenKeys={defaultOpenKeys}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  )
}

export default Sidebar
