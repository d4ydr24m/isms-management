/**
 * 자산 등록 페이지
 * FR-502: 자산 등록
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, message, Breadcrumb } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import AssetForm from './components/AssetForm'
import { assetService } from '@/services/assets'
import type { AssetCreate as AssetCreateType, AssetType, AssetCategory } from '@/types'

// TODO: 실제 부서/사용자 API 연동 필요
const mockDepartments = [
  { id: 1, name: 'IT부서' },
  { id: 2, name: '경영지원부' },
  { id: 3, name: '개발팀' },
  { id: 4, name: '보안팀' },
]

const mockUsers = [
  { id: 1, name: '김철수', email: 'chulsoo@example.com' },
  { id: 2, name: '이영희', email: 'younghee@example.com' },
  { id: 3, name: '박지민', email: 'jimin@example.com' },
  { id: 4, name: '최수현', email: 'suhyun@example.com' },
]

const AssetCreatePage = () => {
  const navigate = useNavigate()
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(true)

  // 초기 데이터 로드
  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [typesRes, categoriesRes] = await Promise.all([
        assetService.getAssetTypes(),
        assetService.getAssetCategories(),
      ])
      setAssetTypes(typesRes.items)
      setCategories(categoriesRes.items)
    } catch {
      message.error('초기 데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // 자산 등록 핸들러
  const handleSubmit = async (values: AssetCreateType) => {
    try {
      const result = await assetService.createAsset(values)
      message.success(`자산이 등록되었습니다. (자산코드: ${result.assetCode})`)
      navigate(`/assets/${result.id}`)
    } catch {
      message.error('자산 등록에 실패했습니다')
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
          { title: '자산 등록' },
        ]}
      />

      <Card title="자산 등록">
        <AssetForm
          assetTypes={assetTypes}
          categories={categories}
          departments={mockDepartments}
          users={mockUsers}
          loading={loading}
          onSubmit={handleSubmit as (values: AssetCreateType | import('@/types').AssetUpdate) => Promise<void>}
          onCancel={handleCancel}
        />
      </Card>
    </div>
  )
}

export default AssetCreatePage
