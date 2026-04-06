import { Layout, Menu, Button } from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  TeamOutlined,
  SettingOutlined,
  DatabaseOutlined,
  WarningOutlined,
  FileSearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
        key: '/controls',
        icon: <SafetyCertificateOutlined />,
        label: '통제항목',
      },
      {
        key: '/evidence',
        icon: <FileTextOutlined />,
        label: '증적 관리',
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
          { key: '/risk/vuln-check', label: '취약점 점검' },
        ],
      },
      {
        key: 'audit-group',
        icon: <AuditOutlined />,
        label: '감사 관리',
        children: [
          { key: '/audits', label: '감사 계획' },
          { key: '/auditor-accounts', label: '외부 심사원' },
        ],
      },
    ]

    // 조직 관리: user:read 권한 필요
    if (hasPermission('user:read')) {
      items.push({
        key: 'org-group',
        icon: <TeamOutlined />,
        label: '조직 관리',
        children: [
          { key: '/users', label: '사용자 관리' },
          { key: '/departments', label: '부서 관리' },
          { key: '/personnel', label: '담당자 관리' },
        ],
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
    if (pathname === '/risk/vuln-check') return ['/risk/vuln-check']
    if (pathname.startsWith('/risk')) return ['/risk']
    return [pathname]
  }, [location.pathname])

  // 하위 경로인 경우 서브메뉴 자동 열기
  const defaultOpenKeys = useMemo(() => {
    const keys: string[] = []
    if (location.pathname.startsWith('/risk')) keys.push('risk-group')
    if (location.pathname.startsWith('/audits') || location.pathname.startsWith('/auditor-accounts')) keys.push('audit-group')
    if (location.pathname.startsWith('/users') || location.pathname.startsWith('/departments') || location.pathname.startsWith('/personnel')) keys.push('org-group')
    return keys
  }, [location.pathname])

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        scrollbarWidth: 'thin',
      }}
    >
      <div
        style={{
          height: 48,
          margin: '8px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: collapsed ? '0' : '0 12px',
          cursor: 'pointer',
        }}
        onClick={() => onCollapse(!collapsed)}
      >
        {collapsed ? (
          <MenuUnfoldOutlined style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18 }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 6,
                padding: '4px 12px',
                textAlign: 'center',
                color: '#fff',
                fontWeight: 'bold',
                flex: 1,
              }}
            >
              ISMS 관리
            </div>
            <MenuFoldOutlined style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginLeft: 8 }} />
          </div>
        )}
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
