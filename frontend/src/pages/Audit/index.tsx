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
  planned: '예정',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소',
}

const auditTypeLabels: Record<string, string> = {
  internal: '내부 감사',
  external: '외부 감사',
  certification: '인증 심사',
  surveillance: '사후 심사',
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
        size: pagination.pageSize,
        search: filters.search || undefined,
        status: filters.status,
      })
      setAudits(response.items || [])
      setPagination((prev) => ({
        ...prev,
        total: response.total || 0,
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
      dataIndex: 'auditType',
      key: 'auditType',
      width: 120,
      render: (type: string) => (
        <Tag>{auditTypeLabels[type] || type}</Tag>
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 200,
      render: (_, record) => (
        <span>
          {record.startDate} ~ {record.endDate}
        </span>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: AuditStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '감사원',
      dataIndex: 'auditors',
      key: 'auditors',
      width: 150,
      render: (auditors: AuditPlan['auditors']) => (
        <span>{auditors.map((a) => a.name).join(', ') || '-'}</span>
      ),
    },
    {
      title: '부적합',
      dataIndex: 'nonConformityCount',
      key: 'nonConformityCount',
      width: 130,
      align: 'center',
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

  // Calculate statistics
  const stats = {
    planned: audits.filter((a) => a.status === 'planned').length,
    inProgress: audits.filter((a) => a.status === 'in_progress').length,
    completed: audits.filter((a) => a.status === 'completed').length,
  }

  return (
    <div>
      <Card
        title="감사 관리"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            감사 계획 등록
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="예정" value={stats.planned} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="진행 중" value={stats.inProgress} valueStyle={{ color: '#fa8c16' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="완료" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="전체" value={pagination.total} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="제목으로 검색"
                prefix={<SearchOutlined />}
                onChange={(e) => handleSearch(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                placeholder="상태 필터"
                style={{ width: '100%' }}
                allowClear
                onChange={handleStatusChange}
                value={filters.status ?? undefined}
              >
                <Option value="planned">예정</Option>
                <Option value="in_progress">진행 중</Option>
                <Option value="completed">완료</Option>
                <Option value="cancelled">취소</Option>
              </Select>
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select
                placeholder="유형 필터"
                style={{ width: '100%' }}
                allowClear
                onChange={handleTypeChange}
                value={filters.auditType ?? undefined}
              >
                <Option value="internal">내부 감사</Option>
                <Option value="external">외부 감사</Option>
                <Option value="certification">인증 심사</Option>
                <Option value="surveillance">사후 심사</Option>
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

export default AuditListPage
