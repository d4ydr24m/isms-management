import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'

// snake_case → camelCase 변환
const toCamelCase = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

// camelCase → snake_case 변환
const toSnakeCase = (str: string): string =>
  str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

const convertKeys = (obj: any, converter: (key: string) => string): any => {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeys(item, converter))
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof File) && !(obj instanceof Blob)) {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      acc[converter(key)] = convertKeys(obj[key], converter)
      return acc
    }, {})
  }
  return obj
}

// Axios 인스턴스 생성
// withCredentials: true ensures HttpOnly cookies are sent with cross-origin requests
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request 인터셉터: camelCase → snake_case 변환
apiClient.interceptors.request.use(
  (config) => {
    if (config.data && !(config.data instanceof FormData)) {
      config.data = convertKeys(config.data, toSnakeCase)
    }
    if (config.params) {
      config.params = convertKeys(config.params, toSnakeCase)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response 인터셉터: snake_case → camelCase 변환 및 에러 처리
apiClient.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object') {
      response.data = convertKeys(response.data, toCamelCase)
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // 401 에러이고 재시도하지 않은 경우 토큰 갱신 시도
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Cookie-based refresh (refresh_token cookie sent automatically)
        const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
        await axios.post(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        )

        // Retry the original request (new cookies are set by the refresh response)
        return apiClient(originalRequest)
      } catch (refreshError) {
        // 토큰 갱신 실패 시 로그아웃 처리
        // Clear persisted auth state
        try {
          localStorage.removeItem('auth-storage')
        } catch { /* ignore */ }
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // 401 에러이고 이미 재시도한 경우 (or non-401)
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('auth-storage')
      } catch { /* ignore */ }
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

// API 에러 처리 헬퍼
export const handleApiError = (error: any): never => {
  if (error.response) {
    // 서버 응답 에러
    const message = error.response.data?.error || error.response.data?.message || '서버 오류가 발생했습니다'
    throw new Error(message)
  } else if (error.request) {
    // 네트워크 에러
    throw new Error('네트워크 오류가 발생했습니다')
  } else {
    // 기타 에러
    throw new Error(error.message || '알 수 없는 오류가 발생했습니다')
  }
}

// 파일 다운로드 헬퍼
export const downloadFile = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await apiClient.get(url, {
      responseType: 'blob',
    })

    const blob = new Blob([response.data])
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(link.href)
  } catch (error) {
    handleApiError(error)
  }
}

// 파일 업로드 헬퍼
export const uploadFile = async (
  url: string,
  file: File,
  additionalData?: Record<string, any>,
  onUploadProgress?: (progressEvent: any) => void
): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      // Convert camelCase key to snake_case for FormData
      const snakeKey = toSnakeCase(key)
      if (value === null || value === undefined) return
      if (Array.isArray(value)) {
        // Arrays sent as comma-separated string
        formData.append(snakeKey, value.join(','))
      } else if (typeof value === 'object') {
        formData.append(snakeKey, JSON.stringify(value))
      } else {
        formData.append(snakeKey, String(value))
      }
    })
  }

  try {
    const response = await apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    })

    return response.data
  } catch (error) {
    handleApiError(error)
  }
}
