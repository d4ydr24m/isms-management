import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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

const { Title, Text } = Typography
const { Option } = Select

interface FilterState {
  search: string
  domainId?: number
  isRequired?: boolean
}

const ControlListPage = () => {
  const navigate = useNavigate()
  const [controls, setControls] = useState<ControlItem[]>([])
  const [domains, setDomains] = useState<ControlDomain[]>([])
  const [progress, setProgress] = useState<ControlProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [domainsLoading, setDomainsLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
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
        limit: pagination.pageSize,
        ...filters,
      })
      setControls(response.data || [])
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
    navigate(`/controls/${record.id}`)
  }

  const columns: ColumnsType<ControlItem> = [
    {
      title: 'Number',
      dataIndex: 'number',
      key: 'number',
      width: 100,
      sorter: true,
    },
    {
      title: 'Title',
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
          {record.isRequired && <Tag color="red">Required</Tag>}
        </Space>
      ),
    },
    {
      title: 'Evidence',
      dataIndex: 'evidenceCount',
      key: 'evidenceCount',
      width: 120,
      align: 'center',
      render: (count, record) => (
        <Space>
          {record.hasEvidence ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
          <span>{count}</span>
        </Space>
      ),
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
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Card title="Control Domains" size="small">
            <ControlTree
              domains={domains}
              onSelect={handleTreeSelect}
              selectedKey={selectedTreeKey}
              loading={domainsLoading}
            />
          </Card>

          {progress && (
            <Card title="Progress" size="small" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">Overall Progress</Text>
                  <Progress
                    percent={progress.progressPercentage}
                    status="active"
                  />
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <Statistic
                      title="Total"
                      value={progress.totalControls}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="With Evidence"
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
          <Card title="Control Items">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={10}>
                  <Input
                    placeholder="Search by number or title"
                    prefix={<SearchOutlined />}
                    onChange={(e) => handleSearch(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Filter by Type"
                    style={{ width: '100%' }}
                    allowClear
                    onChange={handleRequiredChange}
                    value={filters.isRequired}
                  >
                    <Option value={undefined}>All Items</Option>
                    <Option value={true}>Required Only</Option>
                    <Option value={false}>Optional Only</Option>
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
        </Col>
      </Row>
    </div>
  )
}

export default ControlListPage
