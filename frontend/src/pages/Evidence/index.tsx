import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { App, Card, Button, Space, Select, Input, Row, Col } from 'antd'
import { PlusOutlined, SearchOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { EvidenceTable } from './components'
import { evidenceService } from '@/services/evidences'
import { usePermissions } from '@/hooks'
import type { EvidenceListItem, EvidenceStatus, EvidenceFilterParams } from '@/types'
import type { TableProps } from 'antd'

const { Option } = Select

const EvidenceListPage = () => {
  const { message, modal } = App.useApp()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission('evidence:create')
  const canUpdate = hasPermission('evidence:update')
  const canDelete = hasPermission('evidence:delete')
  const [evidences, setEvidences] = useState<EvidenceListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [filters, setFilters] = useState<EvidenceFilterParams>({
    search: '',
    status: undefined,
    controlItemId: undefined,
  })

  const fetchEvidences = useCallback(async () => {
    setLoading(true)
    try {
      const response = await evidenceService.getEvidences({
        page: pagination.current,
        size: pagination.pageSize,
        ...filters,
      })
      setEvidences(response.items || [])
      setPagination((prev) => ({
        ...prev,
        total: response.total || 0,
      }))
    } catch {
      message.error('증적 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters])

  useEffect(() => {
    fetchEvidences()
  }, [fetchEvidences])

  const handleTableChange: TableProps<EvidenceListItem>['onChange'] = (
    paginationConfig,
    _tableFilters
  ) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 10,
    }))
  }

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleStatusChange = (value: EvidenceStatus | undefined) => {
    setFilters((prev) => ({ ...prev, status: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleDelete = (id: number) => {
    modal.confirm({
      title: '증적 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 증적을 삭제하시겠습니까? 삭제된 증적은 복구할 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await evidenceService.deleteEvidence(id)
          message.success('증적이 삭제되었습니다')
          fetchEvidences()
        } catch (err: any) {
          const detail = err?.response?.data?.detail || err?.message
          message.error(detail || '증적 삭제에 실패했습니다')
        }
      },
    })
  }

  const handleArchive = (id: number) => {
    modal.confirm({
      title: '증적 보관',
      icon: <ExclamationCircleOutlined />,
      content: '이 증적을 보관 처리하시겠습니까? 보관된 증적은 증적 확보 현황에서 제외됩니다.',
      okText: '보관',
      cancelText: '취소',
      onOk: async () => {
        try {
          await evidenceService.updateEvidence(id, { status: 'archived' })
          message.success('증적이 보관 처리되었습니다')
          fetchEvidences()
        } catch (err: any) {
          const detail = err?.response?.data?.detail || err?.message
          message.error(detail || '증적 보관에 실패했습니다')
        }
      },
    })
  }

  const handleDownload = async (id: number, fileName: string) => {
    try {
      await evidenceService.downloadEvidence(id, fileName)
      message.success('다운로드가 시작되었습니다')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '파일 다운로드에 실패했습니다')
    }
  }

  return (
    <div>
      <Card
        title="증적 관리"
        extra={
          canCreate ? (
            <Link to="/evidence/create">
              <Button type="primary" icon={<PlusOutlined />}>
                증적 등록
              </Button>
            </Link>
          ) : null
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="제목 또는 파일명으로 검색"
                prefix={<SearchOutlined />}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder="상태 필터"
                style={{ width: '100%' }}
                allowClear
                onChange={handleStatusChange}
                value={filters.status ?? undefined}
              >
                <Option value="active">유효</Option>
                <Option value="draft">초안</Option>
                <Option value="expired">만료</Option>
                <Option value="archived">보관</Option>
              </Select>
            </Col>
          </Row>

          <EvidenceTable
            data={evidences}
            loading={loading}
            pagination={pagination}
            onTableChange={handleTableChange}
            onDelete={canDelete ? handleDelete : undefined}
            onArchive={canUpdate ? handleArchive : undefined}
            onDownload={handleDownload}
          />
        </Space>
      </Card>
    </div>
  )
}

export default EvidenceListPage
