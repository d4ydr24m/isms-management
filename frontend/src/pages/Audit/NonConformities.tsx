import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Space, Select, Input, Tag, Row, Col, Statistic } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd/es/table'
import DataTable from '@/components/common/DataTable'
import { auditService } from '@/services/audits'
import type { NonConformity, NonConformityType, CorrectiveActionStatus } from '@/types'

const { Option } = Select

interface FilterState {
  search: string
  type?: NonConformityType
  status?: CorrectiveActionStatus
}

const severityColors: Record<NonConformityType, string> = {
  critical: 'red',
  major: 'orange',
  minor: 'gold',
  observation: 'blue',
}

const statusColors: Record<CorrectiveActionStatus, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  verified: 'cyan',
  rejected: 'error',
}

const statusLabels: Record<CorrectiveActionStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  verified: 'Verified',
  rejected: 'Rejected',
}

const NonConformitiesPage = () => {
  const navigate = useNavigate()
  const [nonConformities, setNonConformities] = useState<NonConformity[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: undefined,
    status: undefined,
  })

  const fetchNonConformities = useCallback(async () => {
    setLoading(true)
    try {
      const response = await auditService.getNonConformities({
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
      })
      setNonConformities(response.data || [])
      setPagination((prev) => ({
        ...prev,
        total: response.meta?.total || 0,
      }))
    } catch {
      // Error handling
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters])

  useEffect(() => {
    fetchNonConformities()
  }, [fetchNonConformities])

  const handleTableChange: TableProps<NonConformity>['onChange'] = (paginationConfig) => {
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

  const handleSeverityChange = (value: NonConformityType | undefined) => {
    setFilters((prev) => ({ ...prev, type: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleStatusChange = (value: CorrectiveActionStatus | undefined) => {
    setFilters((prev) => ({ ...prev, status: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleRowClick = (record: NonConformity) => {
    navigate(`/non-conformities/${record.id}`)
  }

  const handleCreate = () => {
    navigate('/non-conformities/create')
  }

  // Calculate statistics
  const stats = useMemo(() => {
    const allItems = nonConformities
    return {
      critical: allItems.filter((nc) => nc.type === 'critical').length,
      major: allItems.filter((nc) => nc.type === 'major').length,
      minor: allItems.filter((nc) => nc.type === 'minor').length,
      observation: allItems.filter((nc) => nc.type === 'observation').length,
      pending: allItems.filter((nc) => nc.status === 'pending').length,
      inProgress: allItems.filter((nc) => nc.status === 'in_progress').length,
      completed: allItems.filter((nc) => nc.status === 'completed').length,
    }
  }, [nonConformities])

  const columns: ColumnsType<NonConformity> = [
    {
      title: 'Control',
      key: 'control',
      width: 100,
      render: (_, record) => (
        <span>{record.controlItem.number}</span>
      ),
      sorter: true,
    },
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
      title: 'Severity',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: NonConformityType) => (
        <Tag color={severityColors[type]}>{type.toUpperCase()}</Tag>
      ),
      sorter: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: CorrectiveActionStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
      sorter: true,
    },
    {
      title: 'Assignee',
      dataIndex: 'assigneeName',
      key: 'assigneeName',
      width: 120,
      render: (name: string | null) => name || '-',
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string | null) => date || '-',
      sorter: true,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      sorter: true,
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

  return (
    <div>
      <Card
        title="Non-conformities"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Register Non-conformity
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Statistics */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#fff1f0', borderColor: '#ffa39e' }}>
                <Statistic
                  title="Critical"
                  value={stats.critical}
                  valueStyle={{ color: '#f5222d', fontSize: 18 }}
                  suffix={<span style={{ fontSize: 12 }}>Critical: {stats.critical}</span>}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#fff7e6', borderColor: '#ffd591' }}>
                <Statistic
                  title="Major"
                  value={stats.major}
                  valueStyle={{ color: '#fa8c16', fontSize: 18 }}
                  suffix={<span style={{ fontSize: 12 }}>Major: {stats.major}</span>}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>
                <Statistic
                  title="Minor"
                  value={stats.minor}
                  valueStyle={{ color: '#faad14', fontSize: 18 }}
                  suffix={<span style={{ fontSize: 12 }}>Minor: {stats.minor}</span>}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small">
                <Statistic
                  title="Pending"
                  value={stats.pending}
                  valueStyle={{ fontSize: 18 }}
                  suffix={<span style={{ fontSize: 12 }}>Pending: {stats.pending}</span>}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }}>
                <Statistic
                  title="In Progress"
                  value={stats.inProgress}
                  valueStyle={{ color: '#1890ff', fontSize: 18 }}
                  suffix={<span style={{ fontSize: 12 }}>In Progress: {stats.inProgress}</span>}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                <Statistic
                  title="Completed"
                  value={stats.completed}
                  valueStyle={{ color: '#52c41a', fontSize: 18 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Filters */}
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="Search by title or control"
                prefix={<SearchOutlined />}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                placeholder="Filter by Severity"
                style={{ width: '100%' }}
                allowClear
                onChange={handleSeverityChange}
                value={filters.type}
              >
                <Option value={undefined}>All Severity</Option>
                <Option value="critical">Critical</Option>
                <Option value="major">Major</Option>
                <Option value="minor">Minor</Option>
                <Option value="observation">Observation</Option>
              </Select>
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
                <Option value="pending">Pending</Option>
                <Option value="in_progress">In Progress</Option>
                <Option value="completed">Completed</Option>
                <Option value="verified">Verified</Option>
                <Option value="rejected">Rejected</Option>
              </Select>
            </Col>
          </Row>

          {/* Table */}
          <DataTable<NonConformity>
            columns={columns}
            dataSource={nonConformities}
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

export default NonConformitiesPage
