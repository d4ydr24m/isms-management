/**
 * 자산 서비스 테스트
 * TDD: RED -> GREEN
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assetService } from './assets'
import { apiClient } from './api'

// Mock apiClient
vi.mock('./api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  handleApiError: vi.fn((error) => {
    throw new Error(error.message || 'API Error')
  }),
  downloadFile: vi.fn(),
  uploadFile: vi.fn(),
}))

describe('assetService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // 자산 유형 API (FR-501)
  // ==========================================================================
  describe('Asset Types', () => {
    describe('getAssetTypes', () => {
      it('should fetch asset types list', async () => {
        const mockResponse = {
          data: {
            items: [
              { id: 1, code: 'SERVER', name: '서버', isCustom: false, isActive: true },
              { id: 2, code: 'NETWORK', name: '네트워크 장비', isCustom: false, isActive: true },
            ],
            total: 2,
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetTypes()

        expect(apiClient.get).toHaveBeenCalledWith('/assets/types')
        expect(result.items).toHaveLength(2)
        expect(result.items[0].code).toBe('SERVER')
      })
    })

    describe('createAssetType', () => {
      it('should create a custom asset type', async () => {
        const newType = { code: 'CUSTOM', name: '커스텀 유형', sortOrder: 99 }
        const mockResponse = {
          data: { data: { id: 10, ...newType, isCustom: true, isActive: true } },
        }
        vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

        const result = await assetService.createAssetType(newType)

        expect(apiClient.post).toHaveBeenCalledWith('/assets/types', newType)
        expect(result.isCustom).toBe(true)
      })
    })
  })

  // ==========================================================================
  // 자산 분류 API (FR-501)
  // ==========================================================================
  describe('Asset Categories', () => {
    describe('getAssetCategories', () => {
      it('should fetch asset categories tree', async () => {
        const mockResponse = {
          data: {
            items: [
              {
                id: 1,
                code: 'IT',
                name: 'IT 자산',
                level: 1,
                children: [
                  { id: 2, code: 'IT-HW', name: '하드웨어', level: 2, parentId: 1, children: [] },
                ],
              },
            ],
            total: 1,
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetCategories()

        expect(apiClient.get).toHaveBeenCalledWith('/assets/categories')
        expect(result.items[0].children).toHaveLength(1)
      })
    })

    describe('createAssetCategory', () => {
      it('should create a new category', async () => {
        const newCategory = { code: 'NEW', name: '새 분류', level: 1 as const, sortOrder: 1 }
        const mockResponse = { data: { data: { id: 5, ...newCategory, isActive: true, children: [] } } }
        vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

        const result = await assetService.createAssetCategory(newCategory)

        expect(apiClient.post).toHaveBeenCalledWith('/assets/categories', newCategory)
        expect(result.id).toBe(5)
      })
    })

    describe('updateAssetCategory', () => {
      it('should update an existing category', async () => {
        const updateData = { name: '수정된 분류명' }
        const mockResponse = { data: { data: { id: 1, code: 'IT', name: '수정된 분류명' } } }
        vi.mocked(apiClient.put).mockResolvedValue(mockResponse)

        const result = await assetService.updateAssetCategory(1, updateData)

        expect(apiClient.put).toHaveBeenCalledWith('/assets/categories/1', updateData)
        expect(result.name).toBe('수정된 분류명')
      })
    })
  })

  // ==========================================================================
  // 자산 CRUD API (FR-502)
  // ==========================================================================
  describe('Assets CRUD', () => {
    describe('getAssets', () => {
      it('should fetch assets with pagination', async () => {
        const mockResponse = {
          data: {
            items: [
              { id: 1, assetCode: 'AST-SRV-202401-001', name: '웹서버1', status: 'operating' },
            ],
            total: 100,
            page: 1,
            size: 10,
            pages: 10,
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssets({ page: 1, limit: 10 })

        expect(apiClient.get).toHaveBeenCalledWith('/assets', { params: { page: 1, limit: 10 } })
        expect(result.total).toBe(100)
        expect(result.pages).toBe(10)
      })

      it('should fetch assets with filters', async () => {
        const mockResponse = {
          data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        await assetService.getAssets({
          page: 1,
          limit: 10,
          assetTypeId: 1,
          status: 'operating',
          search: '웹서버',
        })

        expect(apiClient.get).toHaveBeenCalledWith('/assets', {
          params: { page: 1, limit: 10, assetTypeId: 1, status: 'operating', search: '웹서버' },
        })
      })
    })

    describe('getAsset', () => {
      it('should fetch single asset by id', async () => {
        const mockResponse = {
          data: {
            data: {
              id: 1,
              assetCode: 'AST-SRV-202401-001',
              name: '메인 웹서버',
              status: 'operating',
            },
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAsset(1)

        expect(apiClient.get).toHaveBeenCalledWith('/assets/1')
        expect(result.assetCode).toBe('AST-SRV-202401-001')
      })
    })

    describe('createAsset', () => {
      it('should create a new asset', async () => {
        const newAsset = {
          name: '새 서버',
          assetTypeId: 1,
          location: '서울 DC',
        }
        const mockResponse = {
          data: {
            data: {
              id: 10,
              assetCode: 'AST-SRV-202401-010',
              ...newAsset,
              status: 'introduced',
            },
          },
        }
        vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

        const result = await assetService.createAsset(newAsset)

        expect(apiClient.post).toHaveBeenCalledWith('/assets', newAsset)
        expect(result.status).toBe('introduced')
        expect(result.assetCode).toMatch(/^AST-/)
      })
    })

    describe('updateAsset', () => {
      it('should update an existing asset', async () => {
        const updateData = { name: '수정된 서버', location: '부산 DC' }
        const mockResponse = {
          data: { data: { id: 1, ...updateData, status: 'changed' } },
        }
        vi.mocked(apiClient.put).mockResolvedValue(mockResponse)

        const result = await assetService.updateAsset(1, updateData)

        expect(apiClient.put).toHaveBeenCalledWith('/assets/1', updateData)
        expect(result.location).toBe('부산 DC')
      })
    })

    describe('deleteAsset', () => {
      it('should delete (deactivate) an asset', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue({ data: {} })

        await assetService.deleteAsset(1)

        expect(apiClient.delete).toHaveBeenCalledWith('/assets/1')
      })
    })
  })

  // ==========================================================================
  // 자산 가치 평가 API (FR-503)
  // ==========================================================================
  describe('Asset Valuation', () => {
    describe('getAssetValuation', () => {
      it('should fetch current valuation', async () => {
        const mockResponse = {
          data: {
            data: {
              id: 1,
              assetId: 1,
              confidentiality: 3,
              integrity: 2,
              availability: 3,
              importanceLevel: 3,
            },
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetValuation(1)

        expect(apiClient.get).toHaveBeenCalledWith('/assets/1/valuation')
        expect(result.importanceLevel).toBe(3)
      })
    })

    describe('createAssetValuation', () => {
      it('should create/update valuation', async () => {
        const valuation = { confidentiality: 3 as const, integrity: 2 as const, availability: 3 as const }
        const mockResponse = {
          data: { data: { id: 1, assetId: 1, ...valuation, importanceLevel: 3 } },
        }
        vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

        const result = await assetService.createAssetValuation(1, valuation)

        expect(apiClient.post).toHaveBeenCalledWith('/assets/1/valuation', valuation)
        expect(result.importanceLevel).toBe(3)
      })
    })

    describe('getAssetValuationHistory', () => {
      it('should fetch valuation history', async () => {
        const mockResponse = {
          data: {
            data: {
              items: [
                { id: 1, assetId: 1, confidentiality: 3, integrity: 2, availability: 3 },
                { id: 2, assetId: 1, confidentiality: 2, integrity: 2, availability: 2 },
              ],
            },
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetValuationHistory(1)

        expect(apiClient.get).toHaveBeenCalledWith('/assets/1/valuation/history')
        expect(result.items).toHaveLength(2)
      })
    })
  })

  // ==========================================================================
  // 자산 이력 API (FR-504)
  // ==========================================================================
  describe('Asset History', () => {
    describe('getAssetHistory', () => {
      it('should fetch asset change history', async () => {
        const mockResponse = {
          data: {
            data: [
              { id: 1, assetId: 1, changeType: 'created', changedAt: '2024-01-01' },
              { id: 2, assetId: 1, changeType: 'updated', fieldName: 'location', changedAt: '2024-01-15' },
            ],
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetHistory(1)

        expect(apiClient.get).toHaveBeenCalledWith('/assets/1/history')
        expect(result).toHaveLength(2)
      })
    })

    describe('disposeAsset', () => {
      it('should dispose an asset', async () => {
        const disposalData = {
          disposalDate: '2024-06-01',
          disposalReason: '노후화',
          dataDeletionConfirmed: true,
        }
        const mockResponse = {
          data: { data: { id: 1, assetId: 1, ...disposalData } },
        }
        vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

        const result = await assetService.disposeAsset(1, disposalData)

        expect(apiClient.post).toHaveBeenCalledWith('/assets/1/dispose', disposalData)
        expect(result.disposalDate).toBe('2024-06-01')
      })
    })

    describe('getLifecycleStats', () => {
      it('should fetch lifecycle statistics', async () => {
        const mockResponse = {
          data: {
            data: {
              byStatus: { introduced: 10, operating: 80, changed: 5, disposed: 5 },
              total: 100,
              introducedThisMonth: 3,
              disposedThisMonth: 1,
            },
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getLifecycleStats()

        expect(apiClient.get).toHaveBeenCalledWith('/assets/lifecycle-stats')
        expect(result.total).toBe(100)
      })
    })
  })

  // ==========================================================================
  // 자산 담당자 API (FR-505)
  // ==========================================================================
  describe('Asset Assignments', () => {
    describe('getAssetAssignments', () => {
      it('should fetch asset assignments', async () => {
        const mockResponse = {
          data: {
            data: [
              { id: 1, assetId: 1, userId: 10, userName: '김담당', role: 'owner', isActive: true },
            ],
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetAssignments(1)

        expect(apiClient.get).toHaveBeenCalledWith('/assets/1/assignments')
        expect(result[0].role).toBe('owner')
      })
    })

    describe('createAssetAssignment', () => {
      it('should assign a user to asset', async () => {
        const assignment = { userId: 10, role: 'manager' as const }
        const mockResponse = {
          data: { data: { id: 5, assetId: 1, ...assignment, isActive: true } },
        }
        vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

        const result = await assetService.createAssetAssignment(1, assignment)

        expect(apiClient.post).toHaveBeenCalledWith('/assets/1/assignments', assignment)
        expect(result.role).toBe('manager')
      })
    })

    describe('updateAssetAssignment', () => {
      it('should update assignment', async () => {
        const updateData = { role: 'owner' as const }
        const mockResponse = {
          data: { data: { id: 5, assetId: 1, userId: 10, role: 'owner', isActive: true } },
        }
        vi.mocked(apiClient.put).mockResolvedValue(mockResponse)

        const result = await assetService.updateAssetAssignment(1, 5, updateData)

        expect(apiClient.put).toHaveBeenCalledWith('/assets/1/assignments/5', updateData)
        expect(result.role).toBe('owner')
      })
    })

    describe('deleteAssetAssignment', () => {
      it('should remove assignment', async () => {
        vi.mocked(apiClient.delete).mockResolvedValue({ data: {} })

        await assetService.deleteAssetAssignment(1, 5)

        expect(apiClient.delete).toHaveBeenCalledWith('/assets/1/assignments/5')
      })
    })

    describe('getAssetHandover', () => {
      it('should fetch handover checklist', async () => {
        const mockResponse = {
          data: {
            data: {
              id: 1,
              assetId: 1,
              fromUserId: 10,
              toUserId: 20,
              checklistCompleted: false,
            },
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetHandover(1)

        expect(apiClient.get).toHaveBeenCalledWith('/assets/1/handover')
        expect(result.checklistCompleted).toBe(false)
      })
    })
  })

  // ==========================================================================
  // 자산 임포트/익스포트 API (FR-502)
  // ==========================================================================
  describe('Asset Import/Export', () => {
    describe('downloadTemplate', () => {
      it('should download import template', async () => {
        const { downloadFile } = await import('./api')
        vi.mocked(downloadFile).mockResolvedValue(undefined)

        await assetService.downloadTemplate()

        expect(downloadFile).toHaveBeenCalledWith('/assets/template', 'asset_import_template.xlsx')
      })
    })

    describe('importAssets', () => {
      it('should import assets from file', async () => {
        const { uploadFile } = await import('./api')
        const mockFile = new File([''], 'assets.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const mockResult = { total: 50, success: 48, failed: 2, errors: [] }
        vi.mocked(uploadFile).mockResolvedValue({ data: mockResult })

        const result = await assetService.importAssets(mockFile)

        expect(uploadFile).toHaveBeenCalledWith('/assets/import', mockFile, undefined, expect.any(Function))
        expect(result.success).toBe(48)
      })
    })

    describe('exportAssets', () => {
      it('should export assets to excel', async () => {
        const { downloadFile } = await import('./api')
        vi.mocked(downloadFile).mockResolvedValue(undefined)

        await assetService.exportAssets({ assetTypeId: 1 })

        expect(downloadFile).toHaveBeenCalledWith(
          '/assets/export?assetTypeId=1',
          'assets_export.xlsx'
        )
      })
    })
  })

  // ==========================================================================
  // 자산 통계 API
  // ==========================================================================
  describe('Asset Statistics', () => {
    describe('getAssetStats', () => {
      it('should fetch overall statistics', async () => {
        const mockResponse = {
          data: {
            data: {
              totalCount: 500,
              activeCount: 450,
              byStatus: { introduced: 50, operating: 380, changed: 20, disposed: 50 },
              byImportance: { 1: 100, 2: 200, 3: 150 },
              recentAdded: 15,
              recentDisposed: 5,
            },
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetStats()

        expect(apiClient.get).toHaveBeenCalledWith('/assets/stats')
        expect(result.totalCount).toBe(500)
      })
    })

    describe('getAssetsByType', () => {
      it('should fetch assets grouped by type', async () => {
        const mockResponse = {
          data: {
            data: [
              { typeId: 1, typeCode: 'SERVER', typeName: '서버', count: 100, activeCount: 95 },
              { typeId: 2, typeCode: 'NETWORK', typeName: '네트워크', count: 50, activeCount: 48 },
            ],
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetsByType()

        expect(apiClient.get).toHaveBeenCalledWith('/assets/by-type')
        expect(result).toHaveLength(2)
      })
    })

    describe('getAssetsByDepartment', () => {
      it('should fetch assets grouped by department', async () => {
        const mockResponse = {
          data: {
            data: [
              { departmentId: 1, departmentName: 'IT부서', count: 200, byImportance: { 1: 50, 2: 100, 3: 50 } },
            ],
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetsByDepartment()

        expect(apiClient.get).toHaveBeenCalledWith('/assets/by-department')
        expect(result[0].count).toBe(200)
      })
    })

    describe('getAssetsByImportance', () => {
      it('should fetch assets grouped by importance', async () => {
        const mockResponse = {
          data: {
            data: [
              { importanceLevel: 3, label: '상', count: 150, percentage: 30 },
              { importanceLevel: 2, label: '중', count: 200, percentage: 40 },
              { importanceLevel: 1, label: '하', count: 150, percentage: 30 },
            ],
          },
        }
        vi.mocked(apiClient.get).mockResolvedValue(mockResponse)

        const result = await assetService.getAssetsByImportance()

        expect(apiClient.get).toHaveBeenCalledWith('/assets/by-importance')
        expect(result).toHaveLength(3)
      })
    })
  })
})
