// API 응답 공통 타입
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, any>
}

// 페이지네이션 파라미터
export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

// 필터 파라미터 (공통)
export interface FilterParams {
  search?: string
  status?: string
  startDate?: string
  endDate?: string
}
