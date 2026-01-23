import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Button, Space, Select, Input, message, Modal, Row, Col } from 'antd'
import { PlusOutlined, SearchOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { EvidenceTable } from './components'
import { evidenceService } from '@/services/evidences'
import type { EvidenceListItem, EvidenceStatus, EvidenceFilterParams } from '@/types'
import type { TableProps } from 'antd'

const { Option } = Select

const EvidenceListPage = () => {
  const navigate = useNavigate()
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
        limit: pagination.pageSize,
        ...filters,
      })
      setEvidences(response.data || [])
      setPagination((prev) => ({
        ...prev,
        total: response.meta?.total || 0,
      }))
    } catch {
      message.error('Failed to load evidences')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters])

  useEffect(() => {
    fetchEvidences()
  }, [fetchEvidences])

  const handleTableChange: TableProps<EvidenceListItem>['onChange'] = (
    paginationConfig,
    _tableFilters,
    sorter
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
    Modal.confirm({
      title: 'Delete Evidence',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this evidence? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await evidenceService.deleteEvidence(id)
          message.success('Evidence deleted successfully')
          fetchEvidences()
        } catch {
          message.error('Failed to delete evidence')
        }
      },
    })
  }

  const handleDownload = async (id: number, fileName: string) => {
    try {
      await evidenceService.downloadEvidence(id, fileName)
      message.success('Download started')
    } catch {
      message.error('Failed to download file')
    }
  }

  return (
    <div>
      <Card
        title="Evidence Management"
        extra={
          <Link to="/evidence/create">
            <Button type="primary" icon={<PlusOutlined />}>
              Create Evidence
            </Button>
          </Link>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="Search by title or file name"
                prefix={<SearchOutlined />}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder="Filter by Status"
                style={{ width: '100%' }}
                allowClear
                onChange={handleStatusChange}
                value={filters.status}
              >
                <Option value={undefined}>All Status</Option>
                <Option value="active">Active</Option>
                <Option value="draft">Draft</Option>
                <Option value="expired">Expired</Option>
                <Option value="archived">Archived</Option>
              </Select>
            </Col>
          </Row>

          <EvidenceTable
            data={evidences}
            loading={loading}
            pagination={pagination}
            onTableChange={handleTableChange}
            onDelete={handleDelete}
            onDownload={handleDownload}
          />
        </Space>
      </Card>
    </div>
  )
}

export default EvidenceListPage
