import { describe, it, expect } from 'vitest'
import { theme } from 'antd'
import { getThemeConfig, lightThemeTokens, darkThemeTokens } from './themeConfig'

describe('themeConfig', () => {
  describe('lightThemeTokens', () => {
    it('primary color가 정의되어 있어야 한다', () => {
      expect(lightThemeTokens.colorPrimary).toBeDefined()
    })

    it('border radius가 정의되어 있어야 한다', () => {
      expect(lightThemeTokens.borderRadius).toBeDefined()
    })

    it('적절한 primary color 값을 가져야 한다', () => {
      expect(lightThemeTokens.colorPrimary).toBe('#1890ff')
    })
  })

  describe('darkThemeTokens', () => {
    it('primary color가 정의되어 있어야 한다', () => {
      expect(darkThemeTokens.colorPrimary).toBeDefined()
    })

    it('border radius가 정의되어 있어야 한다', () => {
      expect(darkThemeTokens.borderRadius).toBeDefined()
    })

    it('라이트 테마와 동일한 primary color를 가져야 한다', () => {
      expect(darkThemeTokens.colorPrimary).toBe(lightThemeTokens.colorPrimary)
    })
  })

  describe('getThemeConfig', () => {
    it('isDark=false일 때 defaultAlgorithm을 사용해야 한다', () => {
      const config = getThemeConfig(false)

      expect(config.algorithm).toBe(theme.defaultAlgorithm)
    })

    it('isDark=true일 때 darkAlgorithm을 사용해야 한다', () => {
      const config = getThemeConfig(true)

      expect(config.algorithm).toBe(theme.darkAlgorithm)
    })

    it('isDark=false일 때 lightThemeTokens를 사용해야 한다', () => {
      const config = getThemeConfig(false)

      expect(config.token?.colorPrimary).toBe(lightThemeTokens.colorPrimary)
      expect(config.token?.borderRadius).toBe(lightThemeTokens.borderRadius)
    })

    it('isDark=true일 때 darkThemeTokens를 사용해야 한다', () => {
      const config = getThemeConfig(true)

      expect(config.token?.colorPrimary).toBe(darkThemeTokens.colorPrimary)
      expect(config.token?.borderRadius).toBe(darkThemeTokens.borderRadius)
    })

    it('반환된 config가 Ant Design ThemeConfig 형식이어야 한다', () => {
      const config = getThemeConfig(false)

      expect(config).toHaveProperty('algorithm')
      expect(config).toHaveProperty('token')
    })

    it('컴포넌트 토큰이 정의되어 있어야 한다', () => {
      const lightConfig = getThemeConfig(false)
      const darkConfig = getThemeConfig(true)

      expect(lightConfig.components).toBeDefined()
      expect(darkConfig.components).toBeDefined()
    })
  })
})
