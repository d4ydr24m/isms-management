import { useState, useEffect, useCallback } from 'react'
import { App, Button, Card, Table, Tag, Space, Input, Select, DatePicker, Typography, Tooltip } from 'antd'
import { FileSearchOutlined, DownloadOutlined } from '@ant-design/icons'
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
  oldValue: string | null
  newValue: string | null
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
  'vuln-check': '취약점 점검',
  backup: '백업/복원',
  dashboard: '대시보드',
  search: '검색',
}

const methodColors: Record<string, string> = {
  POST: 'green',
  PUT: 'blue',
  DELETE: 'red',
  PATCH: 'orange',
}

// new_value payload에서 대상 엔티티의 사람이 읽을 수 있는 라벨 추출
function extractTargetLabel(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    const target = data?._target
    if (!target || typeof target !== 'object') return null
    const name = target.name || target.title || target.email || target.code
    if (!name) return null
    return target.id ? `${name} (#${target.id})` : String(name)
  } catch {
    return null
  }
}

function AuditLogsPage() {
  const { modal, message } = App.useApp()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
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

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const params: Record<string, string> = { format: 'xlsx' }
      if (filters.startDate) params.start_date = filters.startDate
      if (filters.endDate) params.end_date = filters.endDate

      const response = await apiClient.get('/audit-logs/export', {
        params,
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `감사로그_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('엑셀 다운로드가 완료되었습니다')
    } catch {
      message.error('엑셀 다운로드에 실패했습니다')
    } finally {
      setExporting(false)
    }
  }

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
      render: (_, record) => {
        if (!record.userName && !record.userEmail) return <Text type="secondary">-</Text>
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{record.userName || record.userEmail || '-'}</Text>
            {record.userName && record.userEmail && (
              <Text type="secondary" style={{ fontSize: 12 }}>{record.userEmail}</Text>
            )}
          </Space>
        )
      },
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
      key: 'resourceType',
      width: 200,
      render: (_, record) => {
        const typeLabel = resourceLabels[record.resourceType] || record.resourceType
        const targetLabel = extractTargetLabel(record.newValue) ||
          (record.resourceId ? `#${record.resourceId}` : null)
        return (
          <Space direction="vertical" size={0}>
            <Text>{typeLabel}</Text>
            {targetLabel && (
              <Text type="secondary" style={{ fontSize: 12 }}>{targetLabel}</Text>
            )}
          </Space>
        )
      },
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
    {
      title: '상세',
      key: 'detail',
      width: 60,
      align: 'center',
      render: (_, record) => record.newValue ? (
        <Tooltip title="상세 보기">
          <Button type="link" size="small" onClick={() => {
            try {
              const data = JSON.parse(record.newValue)
              const { _target, ...changes } = data || {}
              const targetLabel = extractTargetLabel(record.newValue)
              modal.info({
                title: `${actionLabels[record.action] || record.action} 상세`,
                width: 600,
                content: (
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {targetLabel && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>대상</Text>
                        <div><Text strong>{targetLabel}</Text></div>
                      </div>
                    )}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>변경 내용</Text>
                      <pre style={{ maxHeight: 360, overflow: 'auto', fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 4, marginTop: 4 }}>
                        {JSON.stringify(_target ? changes : data, null, 2)}
                      </pre>
                    </div>
                  </Space>
                ),
              })
            } catch {
              modal.info({
                title: '상세',
                content: <Text>{record.newValue}</Text>,
              })
            }
          }}>보기</Button>
        </Tooltip>
      ) : '-',
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
        extra={
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportExcel}
            loading={exporting}
          >
            엑셀 다운로드
          </Button>
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
