/**
 * 자산 타입 정의 테스트
 * TDD: GREEN - 타입 정의가 올바르게 작동하는지 검증
 */
import { describe, it, expect } from 'vitest'
import type {
  AssetStatus,
  AssetAssignmentRole,
  AssetChangeType,
  AssetType,
  AssetCategory,
  Asset,
  AssetValuation,
  AssetHistory,
  AssetAssignment,
  AssetHandover,
  AssetFilterParams,
  AssetImportResult,
  AssetStats,
} from './asset'

describe('Asset Types', () => {
  describe('AssetStatus', () => {
    it('should accept valid status values', () => {
      const statuses: AssetStatus[] = ['introduced', 'operating', 'changed', 'disposed']
      expect(statuses).toHaveLength(4)
    })
  })

  describe('AssetAssignmentRole', () => {
    it('should accept valid role values', () => {
      const roles: AssetAssignmentRole[] = ['owner', 'manager', 'user']
      expect(roles).toHaveLength(3)
    })
  })

  describe('AssetChangeType', () => {
    it('should accept valid change type values', () => {
      const changeTypes: AssetChangeType[] = [
        'created',
        'updated',
        'status_changed',
        'valuation_changed',
        'assignment_changed',
        'disposed',
      ]
      expect(changeTypes).toHaveLength(6)
    })
  })

  describe('AssetType', () => {
    it('should have required properties', () => {
      const assetType: AssetType = {
        id: 1,
        code: 'SERVER',
        name: '서버',
        sortOrder: 1,
        isCustom: false,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      }
      expect(assetType.id).toBe(1)
      expect(assetType.code).toBe('SERVER')
      expect(assetType.isCustom).toBe(false)
    })

    it('should allow optional properties', () => {
      const assetType: AssetType = {
        id: 1,
        code: 'CUSTOM',
        name: '커스텀 유형',
        description: '사용자 정의 자산 유형',
        icon: 'custom-icon',
        sortOrder: 99,
        isCustom: true,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      }
      expect(assetType.description).toBe('사용자 정의 자산 유형')
      expect(assetType.icon).toBe('custom-icon')
      expect(assetType.updatedAt).toBeDefined()
    })
  })

  describe('AssetCategory', () => {
    it('should support hierarchical structure with children', () => {
      const category: AssetCategory = {
        id: 1,
        code: 'IT',
        name: 'IT 자산',
        level: 1,
        sortOrder: 1,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        children: [
          {
            id: 2,
            code: 'IT-HW',
            name: '하드웨어',
            level: 2,
            parentId: 1,
            sortOrder: 1,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            children: [],
          },
        ],
      }
      expect(category.children).toHaveLength(1)
      expect(category.children[0].parentId).toBe(1)
    })
  })

  describe('Asset', () => {
    it('should have required properties', () => {
      const asset: Asset = {
        id: 1,
        assetCode: 'AST-SRV-202401-001',
        name: '메인 웹서버',
        assetTypeId: 1,
        status: 'operating',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      }
      expect(asset.assetCode).toMatch(/^AST-/)
      expect(asset.status).toBe('operating')
    })

    it('should support CIA evaluation properties', () => {
      const asset: Asset = {
        id: 1,
        assetCode: 'AST-SRV-202401-001',
        name: '메인 웹서버',
        assetTypeId: 1,
        status: 'operating',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        importanceLevel: 3,
        confidentiality: 3,
        integrity: 2,
        availability: 3,
      }
      expect(asset.importanceLevel).toBe(3)
      expect(asset.confidentiality).toBe(3)
    })
  })

  describe('AssetValuation', () => {
    it('should have CIA values between 1 and 3', () => {
      const valuation: AssetValuation = {
        id: 1,
        assetId: 1,
        confidentiality: 3,
        integrity: 2,
        availability: 3,
        importanceLevel: 3,
        createdAt: '2024-01-01T00:00:00Z',
      }
      expect(valuation.confidentiality).toBeGreaterThanOrEqual(1)
      expect(valuation.confidentiality).toBeLessThanOrEqual(3)
    })
  })

  describe('AssetHistory', () => {
    it('should track changes with old and new values', () => {
      const history: AssetHistory = {
        id: 1,
        assetId: 1,
        changeType: 'updated',
        fieldName: 'location',
        oldValue: '서울 데이터센터',
        newValue: '부산 데이터센터',
        changedAt: '2024-01-01T00:00:00Z',
      }
      expect(history.changeType).toBe('updated')
      expect(history.oldValue).not.toBe(history.newValue)
    })
  })

  describe('AssetAssignment', () => {
    it('should have user and role information', () => {
      const assignment: AssetAssignment = {
        id: 1,
        assetId: 1,
        userId: 10,
        userName: '김담당',
        role: 'owner',
        assignedAt: '2024-01-01T00:00:00Z',
        isActive: true,
      }
      expect(assignment.role).toBe('owner')
      expect(assignment.isActive).toBe(true)
    })
  })

  describe('AssetHandover', () => {
    it('should have from and to user information', () => {
      const handover: AssetHandover = {
        id: 1,
        assetId: 1,
        fromUserId: 10,
        fromUserName: '김이전',
        toUserId: 20,
        toUserName: '박신규',
        handoverDate: '2024-01-15',
        checklistCompleted: true,
        createdAt: '2024-01-01T00:00:00Z',
      }
      expect(handover.fromUserId).not.toBe(handover.toUserId)
      expect(handover.checklistCompleted).toBe(true)
    })
  })

  describe('AssetFilterParams', () => {
    it('should support multiple filter criteria', () => {
      const filters: AssetFilterParams = {
        search: '웹서버',
        assetTypeId: 1,
        departmentId: 5,
        status: 'operating',
        importanceLevel: 3,
      }
      expect(filters.search).toBe('웹서버')
      expect(filters.status).toBe('operating')
    })

    it('should allow empty filters', () => {
      const filters: AssetFilterParams = {}
      expect(Object.keys(filters)).toHaveLength(0)
    })
  })

  describe('AssetImportResult', () => {
    it('should track import success and failures', () => {
      const result: AssetImportResult = {
        total: 100,
        success: 95,
        failed: 5,
        errors: [
          { row: 10, field: 'ipAddress', message: '잘못된 IP 주소 형식' },
          { row: 25, message: '필수 필드 누락' },
        ],
      }
      expect(result.success + result.failed).toBe(result.total)
      expect(result.errors).toHaveLength(2)
    })
  })

  describe('AssetStats', () => {
    it('should contain comprehensive statistics', () => {
      const stats: AssetStats = {
        totalCount: 500,
        activeCount: 450,
        byStatus: {
          introduced: 50,
          operating: 400,
          changed: 30,
          disposed: 20,
        },
        byImportance: {
          1: 100,
          2: 200,
          3: 150,
        },
        recentAdded: 15,
        recentDisposed: 5,
      }
      expect(stats.totalCount).toBeGreaterThan(0)
      expect(stats.byStatus.operating).toBe(400)
    })
  })
})
