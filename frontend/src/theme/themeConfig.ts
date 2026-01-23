import { theme, ThemeConfig } from 'antd'

/**
 * 라이트 테마 커스텀 토큰
 */
export const lightThemeTokens = {
  colorPrimary: '#1890ff',
  borderRadius: 6,
  colorBgContainer: '#ffffff',
  colorBgLayout: '#f5f5f5',
  colorText: 'rgba(0, 0, 0, 0.88)',
  colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
  colorBorder: '#d9d9d9',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorInfo: '#1890ff',
}

/**
 * 다크 테마 커스텀 토큰
 */
export const darkThemeTokens = {
  colorPrimary: '#1890ff',
  borderRadius: 6,
  colorBgContainer: '#141414',
  colorBgLayout: '#000000',
  colorText: 'rgba(255, 255, 255, 0.85)',
  colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
  colorBorder: '#434343',
  colorSuccess: '#49aa19',
  colorWarning: '#d89614',
  colorError: '#a61d24',
  colorInfo: '#177ddc',
}

/**
 * isDark 값에 따라 Ant Design 테마 설정을 반환
 * @param isDark - 다크 모드 여부
 * @returns Ant Design ThemeConfig
 */
export function getThemeConfig(isDark: boolean): ThemeConfig {
  const tokens = isDark ? darkThemeTokens : lightThemeTokens

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: tokens.colorPrimary,
      borderRadius: tokens.borderRadius,
      colorBgContainer: tokens.colorBgContainer,
      colorBgLayout: tokens.colorBgLayout,
      colorText: tokens.colorText,
      colorTextSecondary: tokens.colorTextSecondary,
      colorBorder: tokens.colorBorder,
      colorSuccess: tokens.colorSuccess,
      colorWarning: tokens.colorWarning,
      colorError: tokens.colorError,
      colorInfo: tokens.colorInfo,
    },
    components: {
      Layout: {
        headerBg: isDark ? '#141414' : '#001529',
        siderBg: isDark ? '#141414' : '#001529',
        bodyBg: isDark ? '#000000' : '#f5f5f5',
      },
      Menu: {
        darkItemBg: isDark ? '#141414' : '#001529',
        darkSubMenuItemBg: isDark ? '#1f1f1f' : '#000c17',
      },
      Card: {
        colorBgContainer: tokens.colorBgContainer,
      },
      Table: {
        colorBgContainer: tokens.colorBgContainer,
        headerBg: isDark ? '#1f1f1f' : '#fafafa',
      },
      Modal: {
        contentBg: tokens.colorBgContainer,
        headerBg: tokens.colorBgContainer,
      },
    },
  }
}
