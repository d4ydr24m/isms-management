import { Button, Dropdown, Space } from 'antd'
import type { MenuProps } from 'antd'
import { SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons'
import { useThemeStore } from '@/stores/themeStore'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeToggleProps {
  /**
   * 현재 모드 레이블 표시 여부
   */
  showLabel?: boolean
  /**
   * 버튼 크기
   */
  size?: 'small' | 'middle' | 'large'
}

const modeIcons: Record<ThemeMode, React.ReactNode> = {
  light: <SunOutlined />,
  dark: <MoonOutlined />,
  system: <DesktopOutlined />,
}

const modeLabels: Record<ThemeMode, string> = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
}

/**
 * 테마 토글 컴포넌트
 *
 * 드롭다운 메뉴를 통해 3가지 테마 모드(Light, Dark, System) 중 선택 가능
 */
function ThemeToggle({ showLabel = false, size = 'middle' }: ThemeToggleProps) {
  const { mode, setMode } = useThemeStore()

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    setMode(key as ThemeMode)
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'light',
      icon: <SunOutlined />,
      label: '라이트',
    },
    {
      key: 'dark',
      icon: <MoonOutlined />,
      label: '다크',
    },
    {
      key: 'system',
      icon: <DesktopOutlined />,
      label: '시스템',
    },
  ]

  return (
    <Dropdown
      menu={{
        items: menuItems,
        onClick: handleMenuClick,
        selectedKeys: [mode],
      }}
      trigger={['click']}
    >
      <Button
        type="text"
        size={size}
        aria-label={`테마 변경: 현재 ${modeLabels[mode]} 모드`}
        icon={modeIcons[mode]}
      >
        {showLabel && <Space>{modeLabels[mode]}</Space>}
      </Button>
    </Dropdown>
  )
}

export default ThemeToggle
