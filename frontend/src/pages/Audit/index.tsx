import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Space, Select, Input, Tag, Row, Col, Statistic } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd/es/table'
import DataTable from '@/components/common/DataTable'
import { auditService } from '@/services/audits'
import type { AuditPlan, AuditStatus } from '@/types'

const { Option } = Select

interface FilterState {
  search: string
  status?: AuditStatus
  auditType?: string
}

const statusColors: Record<AuditStatus, string> = {
  planned: 'blue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
}

const statusLabels: Record<AuditStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const auditTypeLabels: Record<string, string> = {
  internal: 'Internal',
  external: 'External',
  certification: 'Certification',
  surveillance: 'Surveillance',
}

const AuditListPage = () => {
  const navigate = useNavigate()
  const [audits, setAudits] = useState<AuditPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: undefined,
    auditType: undefined,
  })

  const fetchAudits = useCallback(async () => {
    setLoading(true)
    try {
      const response = await auditService.getAudits({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        status: filters.status,
      })
      setAudits(response.data || [])
      setPagination((prev) => ({
        ...prev,
        total: response.meta?.total || 0,
      }))
    } catch {
      // Error handling is done silently
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters])

  useEffect(() => {
    fetchAudits()
  }, [fetchAudits])

  const handleTableChange: TableProps<AuditPlan>['onChange'] = (paginationConfig) => {
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

  const handleStatusChange = (value: AuditStatus | undefined) => {
    setFilters((prev) => ({ ...prev, status: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleTypeChange = (value: string | undefined) => {
    setFilters((prev) => ({ ...prev, auditType: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleRowClick = (record: AuditPlan) => {
    navigate(`/audits/${record.id}`)
  }

  const handleCreate = () => {
    navigate('/audits/create')
  }

  const columns: ColumnsType<AuditPlan> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleRowClick(record)}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'auditType',
      key: 'auditType',
      width: 120,
      render: (type: string) => (
        <Tag>{auditTypeLabels[type] || type}</Tag>
      ),
    },
    {
      title: 'Period',
      key: 'period',
      width: 200,
      render: (_, record) => (
        <span>
          {record.startDate} ~ {record.endDate}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: AuditStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: 'Auditors',
      dataIndex: 'auditors',
      key: 'auditors',
      width: 150,
      render: (auditors: AuditPlan['auditors']) => (
        <span>{auditors.map((a) => a.name).join(', ') || '-'}</span>
      ),
    },
    {
      title: 'Non-conformities',
      dataIndex: 'nonConformityCount',
      key: 'nonConformityCount',
      width: 130,
      align: 'center',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleRowClick(record)}
          aria-label="View"
        >
          View
        </Button>
      ),
    },
  ]

  // Calculate statistics
  const stats = {
    planned: audits.filter((a) => a.status === 'planned').length,
    inProgress: audits.filter((a) => a.status === 'in_progress').length,
    completed: audits.filter((a) => a.status === 'completed').length,
  }

  return (
    <div>
      <Card
        title="Audit Management"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Audit Plan
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Planned" value={stats.planned} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="In Progress" value={stats.inProgress} valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Completed" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Total" value={pagination.total} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="Search by title"
                prefix={<SearchOutlined />}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                placeholder="Filter by Status"
                style={{ width: '100%' }}
                allowClear
                onChange={handleStatusChange}
                value={filters.status}
              >
                <Option value={undefined}>All Status</Option>
                <Option value="planned">Planned</Option>
                <Option value="in_progress">In Progress</Option>
                <Option value="completed">Completed</Option>
                <Option value="cancelled">Cancelled</Option>
              </Select>
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                placeholder="Filter by Type"
                style={{ width: '100%' }}
                allowClear
                onChange={handleTypeChange}
                value={filters.auditType}
              >
                <Option value={undefined}>All Types</Option>
                <Option value="internal">Internal</Option>
                <Option value="external">External</Option>
                <Option value="certification">Certification</Option>
                <Option value="surveillance">Surveillance</Option>
              </Select>
            </Col>
          </Row>

          <DataTable<AuditPlan>
            columns={columns}
            dataSource={audits}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} items`,
            }}
            onChange={handleTableChange}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: 'pointer' },
            })}
          />
        </Space>
      </Card>
    </div>
  )
}

export default AuditListPage
