import { describe, it, expect, beforeEach, vi } from 'vitest'
import { evidenceService } from './evidences'
import { apiClient, uploadFile, downloadFile } from './api'

vi.mock('./api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  handleApiError: vi.fn((error) => {
    throw error
  }),
}))

describe('evidenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getEvidences', () => {
    it('증적 목록을 조회한다', async () => {
      const mockResponse = {
        data: {
          items: [
            { id: 1, title: 'Evidence 1' },
            { id: 2, title: 'Evidence 2' },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

      const result = await evidenceService.getEvidences({ page: 1, limit: 10 })

      expect(apiClient.get).toHaveBeenCalledWith('/evidences', {
        params: { page: 1, limit: 10 },
      })
      expect(result.items).toHaveLength(2)
    })
  })

  describe('getEvidence', () => {
    it('증적 상세 정보를 조회한다', async () => {
      const mockEvidence = {
        id: 1,
        title: 'Test Evidence',
        description: 'Test Description',
      }

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: mockEvidence },
      })

      const result = await evidenceService.getEvidence(1)

      expect(apiClient.get).toHaveBeenCalledWith('/evidences/1')
      expect(result).toEqual(mockEvidence)
    })
  })

  describe('createEvidence', () => {
    it('증적을 생성한다', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const newEvidence = {
        title: 'New Evidence',
        description: 'New Description',
        file: mockFile,
        controlItemIds: [1, 2],
      }

      const mockResponse = {
        data: { id: 1, ...newEvidence },
      }

      vi.mocked(uploadFile).mockResolvedValue(mockResponse)

      const result = await evidenceService.createEvidence(newEvidence)

      expect(uploadFile).toHaveBeenCalled()
      expect(result.title).toBe('New Evidence')
    })

    it('업로드 진행률 콜백을 호출한다', async () => {
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const onProgress = vi.fn()

      const mockResponse = {
        data: { id: 1 },
      }

      vi.mocked(uploadFile).mockImplementation(async (url, file, data, progressCallback) => {
        if (progressCallback) {
          progressCallback({ loaded: 50, total: 100 })
          progressCallback({ loaded: 100, total: 100 })
        }
        return mockResponse
      })

      await evidenceService.createEvidence({ title: 'Test', file: mockFile }, onProgress)

      expect(onProgress).toHaveBeenCalledWith(50)
      expect(onProgress).toHaveBeenCalledWith(100)
    })
  })

  describe('updateEvidence', () => {
    it('증적을 수정한다', async () => {
      const updateData = {
        title: 'Updated Evidence',
        description: 'Updated Description',
      }

      vi.mocked(apiClient.put).mockResolvedValue({
        data: { data: { id: 1, ...updateData } },
      })

      const result = await evidenceService.updateEvidence(1, updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/evidences/1', updateData)
      expect(result.title).toBe('Updated Evidence')
    })
  })

  describe('deleteEvidence', () => {
    it('증적을 삭제한다', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({})

      await evidenceService.deleteEvidence(1)

      expect(apiClient.delete).toHaveBeenCalledWith('/evidences/1')
    })
  })

  describe('uploadVersion', () => {
    it('새 버전을 업로드한다', async () => {
      const mockFile = new File(['test'], 'test-v2.pdf', { type: 'application/pdf' })
      const changes = 'Updated section 3'

      vi.mocked(uploadFile).mockResolvedValue({
        data: { id: 1, version: 2, changes },
      })

      const result = await evidenceService.uploadVersion(1, mockFile, changes)

      expect(uploadFile).toHaveBeenCalled()
      expect(result.version).toBe(2)
    })
  })

  describe('getVersions', () => {
    it('버전 히스토리를 조회한다', async () => {
      const mockVersions = [
        { id: 1, version: 1, changes: 'Initial' },
        { id: 2, version: 2, changes: 'Updated' },
      ]

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: mockVersions },
      })

      const result = await evidenceService.getVersions(1)

      expect(apiClient.get).toHaveBeenCalledWith('/evidences/1/versions')
      expect(result).toHaveLength(2)
    })
  })

  describe('downloadEvidence', () => {
    it('증적 파일을 다운로드한다', async () => {
      vi.mocked(downloadFile).mockResolvedValue(undefined)

      await evidenceService.downloadEvidence(1, 'test.pdf')

      expect(downloadFile).toHaveBeenCalledWith('/evidences/1/download', 'test.pdf')
    })
  })

  describe('getPreviewUrl', () => {
    it('미리보기 URL을 조회한다', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: { url: 'https://example.com/preview.pdf' } },
      })

      const result = await evidenceService.getPreviewUrl(1)

      expect(apiClient.get).toHaveBeenCalledWith('/evidences/1/preview')
      expect(result).toBe('https://example.com/preview.pdf')
    })
  })

  describe('mapControls', () => {
    it('통제항목을 매핑한다', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({})

      await evidenceService.mapControls(1, [1, 2, 3])

      expect(apiClient.post).toHaveBeenCalledWith('/evidences/1/controls', {
        controlItemIds: [1, 2, 3],
      })
    })
  })

  describe('unmapControl', () => {
    it('통제항목 매핑을 해제한다', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue({})

      await evidenceService.unmapControl(1, 2)

      expect(apiClient.delete).toHaveBeenCalledWith('/evidences/1/controls/2')
    })
  })

  describe('getExpiringEvidences', () => {
    it('만료 예정 증적을 조회한다', async () => {
      const mockEvidences = [
        { id: 1, title: 'Expiring Evidence' },
      ]

      vi.mocked(apiClient.get).mockResolvedValue({
        data: { data: mockEvidences },
      })

      const result = await evidenceService.getExpiringEvidences(30)

      expect(apiClient.get).toHaveBeenCalledWith('/evidences/expiring', {
        params: { days: 30 },
      })
      expect(result).toHaveLength(1)
    })
  })
})
