import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchService } from './search'
import { apiClient } from './api'
import type { SearchResponse } from '@/types'

vi.mock('./api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  handleApiError: vi.fn((error) => {
    throw new Error(error.message || '에러 발생')
  }),
}))

describe('searchService', () => {
  const mockSearchResponse: SearchResponse = {
    query: 'test',
    totalCount: 5,
    controls: [
      {
        id: 1,
        number: '1.1.1',
        title: 'Test Control',
        description: 'Test description',
        categoryName: 'Category A',
        evidenceCount: 3,
      },
    ],
    evidences: [
      {
        id: 1,
        title: 'Test Evidence',
        description: 'Evidence description',
        status: 'active',
        uploaderName: 'John Doe',
        controlItems: ['1.1.1', '1.1.2'],
        createdAt: '2025-01-01T00:00:00Z',
      },
    ],
    users: [
      {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        department: 'IT',
        roles: ['admin'],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('search', () => {
    it('검색어로 통합 검색을 수행함', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: mockSearchResponse },
      })

      const result = await searchService.search({ query: 'test' })

      expect(apiClient.get).toHaveBeenCalledWith('/search', {
        params: { query: 'test' },
      })
      expect(result).toEqual(mockSearchResponse)
    })

    it('카테고리 필터가 있을 때 해당 카테고리만 검색함', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: mockSearchResponse },
      })

      await searchService.search({ query: 'test', category: 'controls' })

      expect(apiClient.get).toHaveBeenCalledWith('/search', {
        params: { query: 'test', category: 'controls' },
      })
    })

    it('limit 파라미터를 전달함', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: mockSearchResponse },
      })

      await searchService.search({ query: 'test', limit: 10 })

      expect(apiClient.get).toHaveBeenCalledWith('/search', {
        params: { query: 'test', limit: 10 },
      })
    })

    it('빈 쿼리는 빈 결과를 반환함', async () => {
      const emptyResponse: SearchResponse = {
        query: '',
        totalCount: 0,
        controls: [],
        evidences: [],
        users: [],
      }

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: emptyResponse },
      })

      const result = await searchService.search({ query: '' })

      expect(result.totalCount).toBe(0)
      expect(result.controls).toHaveLength(0)
      expect(result.evidences).toHaveLength(0)
      expect(result.users).toHaveLength(0)
    })

    it('API 에러 발생 시 에러를 던짐', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'))

      await expect(searchService.search({ query: 'test' })).rejects.toThrow()
    })
  })

  describe('searchControls', () => {
    it('통제항목만 검색함', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: mockSearchResponse },
      })

      const result = await searchService.searchControls('test')

      expect(apiClient.get).toHaveBeenCalledWith('/search', {
        params: { query: 'test', category: 'controls' },
      })
      expect(result).toEqual(mockSearchResponse.controls)
    })
  })

  describe('searchEvidences', () => {
    it('증적만 검색함', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: mockSearchResponse },
      })

      const result = await searchService.searchEvidences('test')

      expect(apiClient.get).toHaveBeenCalledWith('/search', {
        params: { query: 'test', category: 'evidences' },
      })
      expect(result).toEqual(mockSearchResponse.evidences)
    })
  })

  describe('searchUsers', () => {
    it('사용자만 검색함', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: mockSearchResponse },
      })

      const result = await searchService.searchUsers('test')

      expect(apiClient.get).toHaveBeenCalledWith('/search', {
        params: { query: 'test', category: 'users' },
      })
      expect(result).toEqual(mockSearchResponse.users)
    })
  })
})
