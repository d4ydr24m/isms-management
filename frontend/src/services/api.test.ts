import { describe, it, expect, beforeEach } from 'vitest'
import { apiClient, handleApiError } from './api'

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should create axios instance with correct base URL', () => {
    const expectedURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
    expect(apiClient.defaults.baseURL).toBe(expectedURL)
  })

  it('should have correct timeout', () => {
    expect(apiClient.defaults.timeout).toBe(30000)
  })

  it('should have default headers', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('should handle API response errors correctly', () => {
    const error = {
      response: {
        data: {
          error: 'Test error message',
        },
        status: 400,
      },
    }

    expect(() => handleApiError(error)).toThrow('Test error message')
  })

  it('should handle API response errors with message field', () => {
    const error = {
      response: {
        data: {
          message: 'Another error message',
        },
        status: 500,
      },
    }

    expect(() => handleApiError(error)).toThrow('Another error message')
  })

  it('should handle network errors', () => {
    const error = {
      request: {},
      message: 'Network Error',
    }

    expect(() => handleApiError(error)).toThrow('네트워크 오류가 발생했습니다')
  })

  it('should handle generic errors', () => {
    const error = {
      message: 'Unknown error',
    }

    expect(() => handleApiError(error)).toThrow('Unknown error')
  })
})
