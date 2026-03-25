import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Tag, Space, Input, Select, DatePicker, Typography, Tooltip } from 'antd'
import { FileSearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiClient } from '@/services/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Text } = Typography

interface AuditLog {
  id: number
  userId: number | null
  userEmail: string
  userName: string
  action: string
  resourceType: string
  resourceId: number | null
  ipAddress: string
  requestMethod: string
  requestPath: string
  statusCode: number
  createdAt: string
}

const actionLabels: Record<string, string> = {
  create: '생성',
  update: '수정',
  delete: '삭제',
  view: '조회',
  download: '다운로드',
  login: '로그인',
  logout: '로그아웃',
}

const actionColors: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  view: 'default',
  download: 'purple',
  login: 'cyan',
  logout: 'default',
}

const actionFilterOptions = [
  { value: 'create', label: '생성' },
  { value: 'update', label: '수정' },
  { value: 'delete', label: '삭제' },
  { value: 'view', label: '조회' },
  { value: 'download', label: '다운로드' },
  { value: 'login', label: '로그인' },
  { value: 'logout', label: '로그아웃' },
]

const resourceLabels: Record<string, string> = {
  auth: '인증',
  users: '사용자',
  roles: '역할',
  departments: '부서',
  evidence: '증적',
  evidences: '증적',
  controls: '통제항목',
  assets: '자산',
  audits: '감사',
  notifications: '알림',
  'system-settings': '시스템 설정',
  nonconformities: '부적합',
  'audit-logs': '감사 로그',
  risks: '위험',
  soa: 'SOA',
  bulk: '일괄 등록',
  personnel: '담당자',
  'auditor-accounts': '외부 심사원',
  'risk-control-linkage': '위험-통제 연계',
  dashboard: '대시보드',
  search: '검색',
}

const methodColors: Record<string, string> = {
  POST: 'green',
  PUT: 'blue',
  DELETE: 'red',
  PATCH: 'orange',
}

function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<{
    action?: string
    resourceType?: string
    ipAddress?: string
    startDate?: string
    endDate?: string
  }>({})

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, size: pageSize, ...filters }
      const response = await apiClient.get<{ items: AuditLog[]; total: number }>('/audit-logs', { params })
      setLogs(response.data.items || [])
      setTotal(response.data.total || 0)
    } catch {
      // Permission denied or error
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filters])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const columns: ColumnsType<AuditLog> = [
    {
      title: '시간',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (date: string) =>
        date ? dayjs(date.endsWith('Z') ? date : date + 'Z').format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '사용자',
      key: 'user',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.userName || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.userEmail}</Text>
        </Space>
      ),
    },
    {
      title: '액션',
      dataIndex: 'action',
      key: 'action',
      width: 90,
      render: (action: string) => (
        <Tag color={actionColors[action] || 'default'}>
          {actionLabels[action] || action}
        </Tag>
      ),
    },
    {
      title: '대상',
      dataIndex: 'resourceType',
      key: 'resourceType',
      width: 120,
      render: (type: string) => resourceLabels[type] || type,
    },
    {
      title: '메서드',
      dataIndex: 'requestMethod',
      key: 'requestMethod',
      width: 80,
      align: 'center',
      render: (method: string) => (
        <Tag color={methodColors[method] || 'default'}>{method}</Tag>
      ),
    },
    {
      title: '경로',
      dataIndex: 'requestPath',
      key: 'requestPath',
      ellipsis: true,
      render: (path: string) => (
        <Tooltip title={path}>
          <Text code style={{ fontSize: 12 }}>{path}</Text>
        </Tooltip>
      ),
    },
    {
      title: '상태',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 80,
      align: 'center',
      render: (code: number) => {
        const color = code < 300 ? 'green' : code < 400 ? 'blue' : code < 500 ? 'orange' : 'red'
        return <Tag color={color}>{code}</Tag>
      },
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (ip: string) => <Text code style={{ fontSize: 12 }}>{ip}</Text>,
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <FileSearchOutlined />
            <span>감사 로그</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
              관리자 활동 기록
            </Text>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 필터 */}
          <Space wrap>
            <Select
              placeholder="액션"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => { setFilters(f => ({ ...f, action: v || undefined })); setPage(1) }}
              options={actionFilterOptions}
            />
            <Select
              placeholder="대상"
              allowClear
              style={{ width: 140 }}
              onChange={(v) => { setFilters(f => ({ ...f, resourceType: v || undefined })); setPage(1) }}
              options={Object.entries(resourceLabels).map(([key, label]) => ({ value: key, label }))}
            />
            <Input.Search
              placeholder="IP 주소"
              allowClear
              style={{ width: 200 }}
              onSearch={(v) => {
                setFilters(f => ({ ...f, ipAddress: v || undefined }))
                setPage(1)
              }}
              onChange={(e) => {
                if (!e.target.value) {
                  setFilters(f => ({ ...f, ipAddress: undefined }))
                  setPage(1)
                }
              }}
            />
            <RangePicker
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setFilters(f => ({
                    ...f,
                    startDate: dates[0]!.toISOString(),
                    endDate: dates[1]!.toISOString(),
                  }))
                } else {
                  setFilters(f => ({ ...f, startDate: undefined, endDate: undefined }))
                }
                setPage(1)
              }}
            />
          </Space>

          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p, ps) => { setPage(p); setPageSize(ps || 20) },
              showSizeChanger: true,
              showTotal: (t) => `총 ${t}건`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            size="small"
            scroll={{ x: 1000 }}
          />
        </Space>
      </Card>
    </div>
  )
}

export default AuditLogsPage
