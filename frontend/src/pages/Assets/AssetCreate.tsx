/**
 * 자산 등록 페이지
 * FR-502: 자산 등록
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { App, Card, Breadcrumb } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import AssetForm from './components/AssetForm'
import type { AssigneeEntry } from './components/AssetForm'
import { assetService } from '@/services/assets'
import { apiClient } from '@/services/api'
import type { AssetCreate as AssetCreateType, AssetType, AssetCategory, Asset, AssetUpdate } from '@/types'

const AssetCreatePage = () => {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const location = useLocation()
  const copyFrom = (location.state as any)?.copyFrom as Asset | undefined
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: number; name: string; email: string }>>([])
  const [existingAsset, setExistingAsset] = useState<Asset | undefined>(undefined)
  const [existingAssignees, setExistingAssignees] = useState<AssigneeEntry[]>([])
  const [loading, setLoading] = useState(true)

  // 초기 데이터 로드
  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [typesRes, categoriesRes] = await Promise.all([
        assetService.getAssetTypes(),
        assetService.getAssetCategories(),
      ])
      setAssetTypes(typesRes.items || [])
      setCategories(categoriesRes.items || [])
    } catch {
      message.error('자산 유형/분류를 불러오는데 실패했습니다')
    }
    // 부서/사용자는 별도 로드 (실패해도 폼 표시)
    try {
      const deptRes = await apiClient.get<{ items: Array<{ id: number; name: string }>; total: number }>('/departments', { params: { isActive: true } })
      setDepartments(deptRes.data.items || [])
    } catch { /* ignore */ }
    try {
      const usersRes = await apiClient.get<Array<{ id: number; name: string; email: string }>>('/personnel/search', { params: { q: '' } })
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : [])
    } catch (e) {
      console.warn('소유자 목록 로드 실패:', e)
    }
    // 수정 모드: 기존 자산 및 CIA 평가 로드
    if (id) {
      try {
        const asset = await assetService.getAsset(parseInt(id))
        // CIA 평가 데이터도 가져와서 자산 데이터에 병합
        try {
          const valuation = await assetService.getAssetValuation(parseInt(id))
          if (valuation) {
            (asset as any).confidentiality = valuation.confidentiality;
            (asset as any).integrity = valuation.integrity;
            (asset as any).availability = valuation.availability;
            (asset as any).evaluationReason = valuation.evaluationReason
          }
        } catch { /* 평가 없는 경우 무시 */ }
        // 기존 담당자 로드
        try {
          const assignments = await assetService.getAssetAssignments(parseInt(id))
          setExistingAssignees(assignments.map(a => ({
            assignmentId: a.id,
            personnelId: a.personnelId || a.userId || 0,
            role: a.role as 'owner' | 'manager' | 'user',
          })).filter(a => a.personnelId))
        } catch { /* 담당자 없는 경우 무시 */ }
        setExistingAsset(asset)
      } catch {
        message.error('자산 정보를 불러오는데 실패했습니다')
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // 자산 등록/수정 핸들러
  const handleSubmit = async (values: AssetCreateType | AssetUpdate, extra?: { ciaData?: { confidentiality: number; integrity: number; availability: number; evaluationReason?: string }; assignees?: AssigneeEntry[] }) => {
    try {
      let assetId: number
      if (isEdit) {
        await assetService.updateAsset(parseInt(id!), values as AssetUpdate)
        assetId = parseInt(id!)
        message.success('자산이 수정되었습니다')
      } else {
        const result = await assetService.createAsset(values as AssetCreateType)
        assetId = result.id
        message.success(`자산이 등록되었습니다. (자산코드: ${result.assetCode})`)
      }
      // CIA 평가 데이터가 있으면 저장
      if (extra?.ciaData) {
        try {
          await assetService.createAssetValuation(assetId, extra.ciaData)
        } catch {
          message.warning('자산은 저장되었으나 중요도 평가 저장에 실패했습니다')
        }
      }
      // 담당자 동기화 (추가/역할변경/삭제) — 병렬 처리
      if (extra?.assignees !== undefined) {
        try {
          const newAssignees = extra.assignees || []
          const existingNonOwner = existingAssignees.filter(a => a.role !== 'owner')
          const existingMap = new Map(existingNonOwner.map(a => [a.personnelId, a]))
          const newIds = new Set(newAssignees.map(a => a.personnelId))
          const promises: Promise<any>[] = []

          for (const assignee of newAssignees) {
            const existing = existingMap.get(assignee.personnelId)
            if (!existing) {
              promises.push(assetService.createAssetAssignment(assetId, {
                userId: assignee.personnelId,
                role: assignee.role,
              }))
            } else if (existing.role !== assignee.role && existing.assignmentId) {
              promises.push(assetService.updateAssetAssignment(assetId, existing.assignmentId, {
                role: assignee.role,
              }))
            }
          }
          for (const existing of existingNonOwner) {
            if (!newIds.has(existing.personnelId) && existing.assignmentId) {
              promises.push(assetService.deleteAssetAssignment(assetId, existing.assignmentId))
            }
          }
          await Promise.all(promises)
        } catch {
          message.warning('자산은 저장되었으나 일부 담당자 처리에 실패했습니다')
        }
      }
      navigate(`/assets/${assetId}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || (isEdit ? '자산 수정에 실패했습니다' : '자산 등록에 실패했습니다'))
    }
  }

  // 취소 핸들러
  const handleCancel = () => {
    navigate('/assets')
  }

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/assets">정보자산 관리</Link> },
          { title: isEdit ? '자산 수정' : copyFrom ? '자산 복제' : '자산 등록' },
        ]}
      />

      <Card title={isEdit ? '자산 수정' : copyFrom ? '자산 복제' : '자산 등록'}>
        <AssetForm
          initialValues={isEdit ? existingAsset : copyFrom ? { ...copyFrom, name: `${copyFrom.name} (복제)`, id: undefined as any, assetCode: undefined } : undefined}
          assetTypes={assetTypes}
          categories={categories}
          departments={departments}
          users={users}
          existingAssignees={isEdit ? existingAssignees : undefined}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </Card>
    </div>
  )
}

export default AssetCreatePage
