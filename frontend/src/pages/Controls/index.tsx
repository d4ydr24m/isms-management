import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Progress,
  Typography,
  Space,
  Tag,
  Button,
  Statistic,
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd/es/table'
import DataTable from '@/components/common/DataTable'
import { ControlTree } from './components'
import type { TreeSelectInfo } from './components'
import { controlService } from '@/services/controls'
import type { ControlItem, ControlDomain, ControlProgress } from '@/types'

const { Text } = Typography
const { Option } = Select

interface FilterState {
  search: string
  domainId?: number
  isRequired?: boolean
}

const ControlListPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [controls, setControls] = useState<ControlItem[]>([])
  const [domains, setDomains] = useState<ControlDomain[]>([])
  const [progress, setProgress] = useState<ControlProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [domainsLoading, setDomainsLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: Number(searchParams.get('page')) || 1,
    pageSize: Number(searchParams.get('pageSize')) || 10,
    total: 0,
  })
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    domainId: undefined,
    isRequired: undefined,
  })
  const [selectedTreeKey, setSelectedTreeKey] = useState<string | undefined>()

  const fetchControls = useCallback(async () => {
    setLoading(true)
    try {
      const response = await controlService.getControls({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      })
      setControls(response.items || [])
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

  const fetchDomains = useCallback(async () => {
    setDomainsLoading(true)
    try {
      const data = await controlService.getDomains()
      setDomains(data || [])
    } catch {
      // Error handling is done silently
    } finally {
      setDomainsLoading(false)
    }
  }, [])

  const fetchProgress = useCallback(async () => {
    try {
      const data = await controlService.getProgress()
      setProgress(data)
    } catch {
      // Error handling is done silently
    }
  }, [])

  useEffect(() => {
    fetchDomains()
    fetchProgress()
  }, [fetchDomains, fetchProgress])

  useEffect(() => {
    fetchControls()
  }, [fetchControls])

  const handleTableChange: TableProps<ControlItem>['onChange'] = (
    paginationConfig
  ) => {
    const newPage = paginationConfig.current || 1
    const newPageSize = paginationConfig.pageSize || 10
    setPagination((prev) => ({
      ...prev,
      current: newPage,
      pageSize: newPageSize,
    }))
    setSearchParams({ page: String(newPage), pageSize: String(newPageSize) }, { replace: true })
  }

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleRequiredChange = (value: boolean | undefined) => {
    setFilters((prev) => ({ ...prev, isRequired: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleTreeSelect = (info: TreeSelectInfo) => {
    if (info.type === 'domain') {
      setFilters((prev) => ({ ...prev, domainId: info.id }))
      setSelectedTreeKey(`domain-${info.id}`)
      setPagination((prev) => ({ ...prev, current: 1 }))
    }
  }

  const handleRowClick = (record: ControlItem) => {
    navigate(`/controls/${record.id}`, {
      state: { page: pagination.current, pageSize: pagination.pageSize }
    })
  }

  const columns: ColumnsType<ControlItem> = [
    {
      title: '번호',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      sorter: true,
    },
    {
      title: '통제항목명',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Space>
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => handleRowClick(record)}
          >
            {text}
          </span>
          {record.isRequired && <Tag color="red">필수</Tag>}
        </Space>
      ),
    },
    {
      title: '증적',
      dataIndex: 'evidenceCount',
      key: 'evidenceCount',
      width: 120,
      align: 'center',
      render: (count: number) => (
        <Space>
          {count > 0 ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
          <span>{count}</span>
        </Space>
      ),
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
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Card title="통제 영역" size="small">
            <ControlTree
              domains={domains}
              onSelect={handleTreeSelect}
              selectedKey={selectedTreeKey}
              loading={domainsLoading}
            />
          </Card>

          {progress && (
            <Card title="진척률" size="small" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">전체 진척률</Text>
                  <Progress
                    percent={progress.coverageRate}
                    status="active"
                  />
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <Statistic
                      title="전체"
                      value={progress.totalControls}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="증적 확보"
                      value={progress.controlsWithEvidence}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                </Row>
              </Space>
            </Card>
          )}
        </Col>

        <Col xs={24} md={18}>
          <Card title="통제항목 목록">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={10}>
                  <Input
                    placeholder="번호 또는 제목으로 검색"
                    prefix={<SearchOutlined />}
                    onChange={(e) => handleSearch(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="유형 필터"
                    style={{ width: '100%' }}
                    allowClear
                    onChange={handleRequiredChange}
                    value={filters.isRequired ?? undefined}
                  >
                    <Option value={true}>필수 항목만</Option>
                    <Option value={false}>선택 항목만</Option>
                  </Select>
                </Col>
              </Row>

              <DataTable<ControlItem>
                columns={columns}
                dataSource={controls}
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
        </Col>
      </Row>
    </div>
  )
}

export default ControlListPage
