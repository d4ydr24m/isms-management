import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Space, Select, Input, Tag, Row, Col, Statistic } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd/es/table'
import DataTable from '@/components/common/DataTable'
import { auditService } from '@/services/audits'
import { formatDateTime } from '@/utils/format'
import type { NonConformity } from '@/types'

const { Option } = Select

interface FilterState {
  search: string
  ncType?: string
  status?: string
}

const ncTypeColors: Record<string, string> = {
  major: 'orange',
  minor: 'gold',
  observation: 'blue',
}

const ncTypeLabels: Record<string, string> = {
  major: '중결함',
  minor: '경결함',
  observation: '관찰사항',
}

const statusColors: Record<string, string> = {
  open: 'red',
  in_progress: 'processing',
  resolved: 'success',
  closed: 'default',
  reopened: 'warning',
}

const statusLabels: Record<string, string> = {
  open: '열림',
  in_progress: '진행 중',
  resolved: '해결됨',
  closed: '종료',
  reopened: '재개',
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
        size: pagination.pageSize,
        status: filters.status,
      })
      setNonConformities(response.items || [])
      setPagination((prev) => ({
        ...prev,
        total: response.total || 0,
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

  const handleSeverityChange = (value: string | undefined) => {
    setFilters((prev) => ({ ...prev, ncType: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleStatusChange = (value: string | undefined) => {
    setFilters((prev) => ({ ...prev, status: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleRowClick = (record: NonConformity) => {
    navigate(`/non-conformities/${record.id}`, { state: { from: '/non-conformities' } })
  }

  const handleCreate = () => {
    navigate('/non-conformities/create')
  }

  // Calculate statistics
  const stats = useMemo(() => {
    const allItems = nonConformities
    return {
      major: allItems.filter((nc) => nc.ncType === 'major').length,
      minor: allItems.filter((nc) => nc.ncType === 'minor').length,
      observation: allItems.filter((nc) => nc.ncType === 'observation').length,
      open: allItems.filter((nc) => nc.status === 'open').length,
      inProgress: allItems.filter((nc) => nc.status === 'in_progress').length,
      resolved: allItems.filter((nc) => nc.status === 'resolved' || nc.status === 'closed').length,
    }
  }, [nonConformities])

  const columns: ColumnsType<NonConformity> = [
    {
      title: '통제항목',
      key: 'control',
      width: 100,
      render: (_, record) => (
        <span>{record.controlItemCode || '-'}</span>
      ),
      sorter: true,
    },
    {
      title: '제목',
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
      title: '유형',
      dataIndex: 'ncType',
      key: 'ncType',
      width: 100,
      render: (ncType: string) => (
        <Tag color={ncTypeColors[ncType] || 'default'}>{ncTypeLabels[ncType] || ncType}</Tag>
      ),
      sorter: true,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>{statusLabels[status] || status}</Tag>
      ),
      sorter: true,
    },
    {
      title: '담당자',
      dataIndex: 'responsiblePersonName',
      key: 'responsiblePersonName',
      width: 120,
      render: (name: string | null) => name || '-',
    },
    {
      title: '기한',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string | null) => date || '-',
      sorter: true,
    },
    {
      title: '등록일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      sorter: true,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '작업',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleRowClick(record)}
          aria-label="보기"
        >
          보기
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="부적합 관리"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            부적합 등록
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Statistics */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#fff7e6', borderColor: '#ffd591' }}>
                <Statistic title="중결함" value={stats.major} valueStyle={{ color: '#fa8c16', fontSize: 18 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}>
                <Statistic title="경결함" value={stats.minor} valueStyle={{ color: '#faad14', fontSize: 18 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#fff1f0', borderColor: '#ffa39e' }}>
                <Statistic title="열림" value={stats.open} valueStyle={{ color: '#f5222d', fontSize: 18 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#e6f7ff', borderColor: '#91d5ff' }}>
                <Statistic title="진행 중" value={stats.inProgress} valueStyle={{ color: '#1890ff', fontSize: 18 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Card size="small" style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}>
                <Statistic title="해결/종료" value={stats.resolved} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
              </Card>
            </Col>
          </Row>

          {/* Filters */}
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="제목 또는 통제항목으로 검색"
                prefix={<SearchOutlined />}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                placeholder="유형 필터"
                style={{ width: '100%' }}
                allowClear
                onChange={handleSeverityChange}
                value={filters.ncType ?? undefined}
              >
                <Option value="major">중결함</Option>
                <Option value="minor">경결함</Option>
                <Option value="observation">관찰사항</Option>
              </Select>
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                placeholder="상태 필터"
                style={{ width: '100%' }}
                allowClear
                onChange={handleStatusChange}
                value={filters.status ?? undefined}
              >
                <Option value="open">열림</Option>
                <Option value="in_progress">진행 중</Option>
                <Option value="resolved">해결됨</Option>
                <Option value="closed">종료</Option>
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
              showTotal: (total) => `총 ${total}건`,
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
