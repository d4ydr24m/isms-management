// 설정 관련 타입

// 프로필 설정 업데이트 요청
export interface ProfileUpdateRequest {
  name?: string
  departmentId?: number
  phone?: string
  position?: string
}

// 보안 설정
export interface SecuritySettings {
  isMfaEnabled: boolean
  lastPasswordChange: string | null
  sessionTimeout: number // minutes
}

// 시스템 설정
export interface SystemSettings {
  language: 'ko' | 'en'
  timezone: string
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY'
  theme: 'light' | 'dark' | 'auto'
}

// 시스템 설정 업데이트 요청
export interface SystemSettingsUpdateRequest {
  language?: 'ko' | 'en'
  timezone?: string
  dateFormat?: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY'
  theme?: 'light' | 'dark' | 'auto'
}
