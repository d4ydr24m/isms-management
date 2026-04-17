/**
 * 자산 목록 페이지
 * FR-502: 자산 등록 및 관리
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { App, Card, Button, Space, Modal } from 'antd'
import { PlusOutlined, UploadOutlined, DownloadOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { AssetTable, AssetFilter } from './components'
import { assetService } from '@/services/assets'
import { usePermissions } from '@/hooks'
import type { Asset, AssetType, AssetStatus, AssetFilterParams } from '@/types'
import type { TableProps } from 'antd'

const AssetListPage = () => {
  const { message, modal } = App.useApp()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission('asset:create')
  const canUpdate = hasPermission('asset:update')
  const canDelete = hasPermission('asset:delete')
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [filters, setFilters] = useState<AssetFilterParams>({
    search: '',
    assetTypeId: undefined,
    status: undefined,
    importanceLevel: undefined,
  })
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [sorter, setSorter] = useState<{ sort?: string; order?: string }>({})

  // 자산 유형 목록 조회
  const fetchAssetTypes = useCallback(async () => {
    try {
      const response = await assetService.getAssetTypes()
      setAssetTypes(response.items)
    } catch {
      message.error('자산 유형을 불러오는데 실패했습니다')
    }
  }, [])

  // 자산 목록 조회
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const response = await assetService.getAssets({
        page: pagination.current,
        size: pagination.pageSize,
        ...filters,
        ...sorter,
      })
      setAssets(response.items)
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }))
    } catch {
      message.error('자산 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters, sorter])

  useEffect(() => {
    fetchAssetTypes()
  }, [fetchAssetTypes])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // 테이블 변경 핸들러 (페이지네이션 + 정렬)
  const handleTableChange: TableProps<Asset>['onChange'] = (paginationConfig, _filters, sorterResult) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 10,
    }))
    // antd sorter → API sort/order 변환
    const s = Array.isArray(sorterResult) ? sorterResult[0] : sorterResult
    if (s?.field && s?.order) {
      // camelCase dataIndex → snake_case 변환
      const fieldMap: Record<string, string> = {
        assetCode: 'asset_code',
        name: 'name',
        assetTypeName: 'asset_type_name',
        status: 'status',
        importanceLevel: 'importance_level',
      }
      setSorter({
        sort: fieldMap[s.field as string] || s.field as string,
        order: s.order === 'ascend' ? 'asc' : 'desc',
      })
    } else {
      setSorter({})
    }
  }

  // 검색어 변경 핸들러
  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 자산 유형 필터 변경 핸들러
  const handleAssetTypeChange = (value?: number) => {
    setFilters((prev) => ({ ...prev, assetTypeId: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 상태 필터 변경 핸들러
  const handleStatusChange = (value?: AssetStatus) => {
    setFilters((prev) => ({ ...prev, status: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 중요도 필터 변경 핸들러
  const handleImportanceChange = (value?: number) => {
    setFilters((prev) => ({ ...prev, importanceLevel: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // EoL 상태 필터 변경 핸들러
  const handleEolStatusChange = (value?: 'expired' | 'soon' | 'none') => {
    setFilters((prev) => ({ ...prev, eolStatus: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 상태 변경 핸들러 (테이블 인라인)
  const handleAssetStatusChange = async (id: number, status: string) => {
    try {
      await assetService.updateAsset(id, { status } as any)
      message.success('상태가 변경되었습니다')
      fetchAssets()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '상태 변경에 실패했습니다')
    }
  }

  // 삭제 핸들러
  const handleDelete = (id: number) => {
    modal.confirm({
      title: '자산 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 자산을 삭제하시겠습니까? 삭제된 자산은 복구할 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await assetService.deleteAsset(id)
          message.success('자산이 삭제되었습니다')
          fetchAssets()
        } catch (err: any) {
          const detail = err?.response?.data?.detail || err?.message
          message.error(detail || '자산 삭제에 실패했습니다')
        }
      },
    })
  }

  // 일괄 삭제 핸들러
  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return
    modal.confirm({
      title: '자산 일괄 삭제',
      icon: <ExclamationCircleOutlined />,
      content: `선택한 ${selectedRowKeys.length}건의 자산을 삭제하시겠습니까?`,
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          const result = await assetService.bulkDeleteAssets(selectedRowKeys as number[])
          message.success(`${result.deleted}건의 자산이 삭제되었습니다`)
          setSelectedRowKeys([])
          fetchAssets()
        } catch (err: any) {
          const detail = err?.response?.data?.detail || err?.message
          message.error(detail || '일괄 삭제에 실패했습니다')
        }
      },
    })
  }

  // 내보내기 핸들러
  const handleExport = async () => {
    try {
      await assetService.exportAssets(filters)
      message.success('자산 목록을 내보냈습니다')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '자산 내보내기에 실패했습니다')
    }
  }

  return (
    <div>
      <Card
        title="정보자산 관리"
        extra={
          <Space>
            {canDelete && selectedRowKeys.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={handleBulkDelete}>
                선택 삭제 ({selectedRowKeys.length})
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              내보내기
            </Button>
            {canCreate && (
              <Link to="/assets/import">
                <Button icon={<UploadOutlined />}>일괄 등록</Button>
              </Link>
            )}
            {canCreate && (
              <Link to="/assets/create">
                <Button type="primary" icon={<PlusOutlined />}>
                  자산 등록
                </Button>
              </Link>
            )}
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <AssetFilter
            filters={filters}
            assetTypes={assetTypes}
            onSearchChange={handleSearchChange}
            onAssetTypeChange={handleAssetTypeChange}
            onStatusChange={handleStatusChange}
            onImportanceChange={handleImportanceChange}
            onEolStatusChange={handleEolStatusChange}
          />

          <AssetTable
            data={assets}
            loading={loading}
            pagination={pagination}
            onTableChange={handleTableChange}
            onDelete={handleDelete}
            onStatusChange={handleAssetStatusChange}
            selectedRowKeys={selectedRowKeys}
            onSelectionChange={setSelectedRowKeys}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </Space>
      </Card>
    </div>
  )
}

export default AssetListPage
