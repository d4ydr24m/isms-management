/**
 * 취약점 점검 스크립트 관리 페이지
 *
 * 기능:
 * - 스크립트 업로드/목록/수정/삭제
 * - 스케줄 관리 (Cron 기반 주기 설정)
 * - 수동 실행 및 실행 결과 조회
 * - 통계 대시보드
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Input,
  Select,
  message,
  Modal,
  Form,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic,
  Drawer,
  Descriptions,
  Typography,
  Tabs,
  Upload,
  Badge,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  CodeOutlined,
  ScheduleOutlined,
  ThunderboltOutlined,
  BugOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import {
  getVulnCheckScripts,
  createVulnCheckScript,
  updateVulnCheckScript,
  deleteVulnCheckScript,
  downloadVulnCheckScript,
  getVulnCheckSchedules,
  createVulnCheckSchedule,
  updateVulnCheckSchedule,
  deleteVulnCheckSchedule,
  getVulnCheckExecutions,
  createVulnCheckExecution,
  updateVulnCheckExecution,
  getVulnCheckStats,
} from '@/services/vulnCheck'
import type {
  VulnCheckScript,
  VulnCheckSchedule,
  VulnCheckExecution,
  VulnCheckStats,
  ScriptType,
} from '@/types/vulnCheck'

const { Search } = Input
const { Text } = Typography
const { TextArea } = Input

const SCRIPT_TYPE_OPTIONS: { value: ScriptType; label: string; color: string }[] = [
  { value: 'python', label: 'Python', color: 'blue' },
  { value: 'shell', label: 'Shell', color: 'green' },
  { value: 'powershell', label: 'PowerShell', color: 'purple' },
  { value: 'custom', label: 'Custom', color: 'orange' },
]

const EXECUTION_STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '대기' },
  running: { color: 'processing', label: '실행 중' },
  completed: { color: 'success', label: '완료' },
  failed: { color: 'error', label: '실패' },
  cancelled: { color: 'warning', label: '취소' },
}

const CRON_PRESETS = [
  { label: '매일 02:00', value: '0 2 * * *' },
  { label: '매주 월요일 02:00', value: '0 2 * * 1' },
  { label: '매월 1일 02:00', value: '0 2 1 * *' },
  { label: '매분기 (1,4,7,10월 1일)', value: '0 2 1 1,4,7,10 *' },
]

const VulnCheckScriptsPage = () => {
  const [activeTab, setActiveTab] = useState('scripts')

  // 스크립트 상태
  const [scripts, setScripts] = useState<VulnCheckScript[]>([])
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [scriptModalVisible, setScriptModalVisible] = useState(false)
  const [editingScript, setEditingScript] = useState<VulnCheckScript | null>(null)
  const [scriptForm] = Form.useForm()
  const [uploadFile, setUploadFile] = useState<UploadFile | null>(null)
  const [searchText, setSearchText] = useState('')

  // 스케줄 상태
  const [schedules, setSchedules] = useState<VulnCheckSchedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<VulnCheckSchedule | null>(null)
  const [scheduleForm] = Form.useForm()

  // 실행 상태
  const [executions, setExecutions] = useState<VulnCheckExecution[]>([])
  const [executionsLoading, setExecutionsLoading] = useState(false)
  const [executionPagination, setExecutionPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })
  const [runModalVisible, setRunModalVisible] = useState(false)
  const [runForm] = Form.useForm()

  // 상세 Drawer
  const [executionDetailOpen, setExecutionDetailOpen] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<VulnCheckExecution | null>(null)

  // 결과 입력 모달
  const [resultModalVisible, setResultModalVisible] = useState(false)
  const [resultTargetExecution, setResultTargetExecution] = useState<VulnCheckExecution | null>(null)
  const [resultForm] = Form.useForm()

  // 통계
  const [stats, setStats] = useState<VulnCheckStats | null>(null)

  // =========================================================================
  // 데이터 로드
  // =========================================================================

  const loadScripts = useCallback(async () => {
    setScriptsLoading(true)
    try {
      const result = await getVulnCheckScripts({ search: searchText || undefined })
      setScripts(result.items)
    } catch {
      message.error('스크립트 목록 조회 실패')
    } finally {
      setScriptsLoading(false)
    }
  }, [searchText])

  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    try {
      const result = await getVulnCheckSchedules()
      setSchedules(result.items)
    } catch {
      message.error('스케줄 목록 조회 실패')
    } finally {
      setSchedulesLoading(false)
    }
  }, [])

  const loadExecutions = useCallback(async (page = 1) => {
    setExecutionsLoading(true)
    try {
      const result = await getVulnCheckExecutions({ page, size: 20 })
      setExecutions(result.items)
      setExecutionPagination({
        current: result.page,
        pageSize: result.size,
        total: result.total,
      })
    } catch {
      message.error('실행 결과 조회 실패')
    } finally {
      setExecutionsLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const result = await getVulnCheckStats()
      setStats(result)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadScripts()
    loadStats()
  }, [loadScripts, loadStats])

  useEffect(() => {
    if (activeTab === 'schedules') loadSchedules()
    if (activeTab === 'executions') loadExecutions()
  }, [activeTab, loadSchedules, loadExecutions])

  // =========================================================================
  // 스크립트 핸들러
  // =========================================================================

  const handleCreateScript = () => {
    setEditingScript(null)
    setUploadFile(null)
    scriptForm.resetFields()
    scriptForm.setFieldsValue({ scriptType: 'python', version: '1.0' })
    setScriptModalVisible(true)
  }

  const handleEditScript = (script: VulnCheckScript) => {
    setEditingScript(script)
    scriptForm.setFieldsValue({
      name: script.name,
      description: script.description,
      scriptType: script.scriptType,
      version: script.version,
    })
    setScriptModalVisible(true)
  }

  const handleScriptSubmit = async () => {
    try {
      const values = await scriptForm.validateFields()

      if (editingScript) {
        await updateVulnCheckScript(editingScript.id, values)
        message.success('스크립트가 수정되었습니다.')
      } else {
        if (!uploadFile) {
          message.error('스크립트 파일을 선택해주세요.')
          return
        }
        await createVulnCheckScript(uploadFile as unknown as File, values)
        message.success('스크립트가 업로드되었습니다.')
      }

      setScriptModalVisible(false)
      loadScripts()
      loadStats()
    } catch {
      // validation error
    }
  }

  const handleDeleteScript = async (id: number) => {
    try {
      await deleteVulnCheckScript(id)
      message.success('스크립트가 삭제되었습니다.')
      loadScripts()
      loadStats()
    } catch {
      message.error('스크립트 삭제 실패')
    }
  }

  const handleDownloadScript = async (script: VulnCheckScript) => {
    try {
      const result = await downloadVulnCheckScript(script.id)
      window.open(result.downloadUrl, '_blank')
    } catch {
      message.error('다운로드 실패')
    }
  }

  // =========================================================================
  // 스케줄 핸들러
  // =========================================================================

  const handleCreateSchedule = () => {
    setEditingSchedule(null)
    scheduleForm.resetFields()
    setScheduleModalVisible(true)
  }

  const handleEditSchedule = (schedule: VulnCheckSchedule) => {
    setEditingSchedule(schedule)
    scheduleForm.setFieldsValue({
      scriptId: schedule.scriptId,
      name: schedule.name,
      description: schedule.description,
      cronExpression: schedule.cronExpression,
    })
    setScheduleModalVisible(true)
  }

  const handleScheduleSubmit = async () => {
    try {
      const values = await scheduleForm.validateFields()

      if (editingSchedule) {
        await updateVulnCheckSchedule(editingSchedule.id, values)
        message.success('스케줄이 수정되었습니다.')
      } else {
        await createVulnCheckSchedule(values)
        message.success('스케줄이 생성되었습니다.')
      }

      setScheduleModalVisible(false)
      loadSchedules()
      loadStats()
    } catch {
      // validation error
    }
  }

  const handleDeleteSchedule = async (id: number) => {
    try {
      await deleteVulnCheckSchedule(id)
      message.success('스케줄이 삭제되었습니다.')
      loadSchedules()
      loadStats()
    } catch {
      message.error('스케줄 삭제 실패')
    }
  }

  // =========================================================================
  // 실행 핸들러
  // =========================================================================

  const handleManualRun = () => {
    runForm.resetFields()
    setRunModalVisible(true)
  }

  const handleRunSubmit = async () => {
    try {
      const values = await runForm.validateFields()
      const assetIdsStr = values.assetIds as string
      const assetIds = assetIdsStr
        .split(',')
        .map((s: string) => parseInt(s.trim(), 10))
        .filter((n: number) => !isNaN(n))

      if (assetIds.length === 0) {
        message.error('유효한 자산 ID를 입력해주세요.')
        return
      }

      await createVulnCheckExecution({
        scriptId: values.scriptId,
        assetIds,
      })
      message.success(`${assetIds.length}개 자산에 대해 점검이 시작되었습니다.`)
      setRunModalVisible(false)
      loadExecutions()
      loadStats()
    } catch {
      // validation error
    }
  }

  const handleViewExecution = (execution: VulnCheckExecution) => {
    setSelectedExecution(execution)
    setExecutionDetailOpen(true)
  }

  const handleOpenResultInput = (execution: VulnCheckExecution) => {
    setResultTargetExecution(execution)
    resultForm.setFieldsValue({
      status: 'completed',
      resultSummary: execution.resultSummary || '',
      resultDetail: execution.resultDetail || '',
      vulnerabilitiesFound: execution.vulnerabilitiesFound || 0,
      severityHigh: execution.severityHigh || 0,
      severityMedium: execution.severityMedium || 0,
      severityLow: execution.severityLow || 0,
      errorMessage: '',
    })
    setResultModalVisible(true)
  }

  const handleResultSubmit = async () => {
    if (!resultTargetExecution) return
    try {
      const values = await resultForm.validateFields()
      await updateVulnCheckExecution(resultTargetExecution.id, values)
      message.success('결과가 입력되었습니다.')
      setResultModalVisible(false)
      setExecutionDetailOpen(false)
      loadExecutions(executionPagination.current)
      loadStats()
    } catch {
      // validation error
    }
  }

  // =========================================================================
  // 테이블 컬럼 정의
  // =========================================================================

  const scriptColumns: ColumnsType<VulnCheckScript> = [
    {
      title: '스크립트명',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <CodeOutlined />
          <Text strong>{name}</Text>
          {!record.isActive && <Tag color="default">비활성</Tag>}
        </Space>
      ),
    },
    {
      title: '유형',
      dataIndex: 'scriptType',
      key: 'scriptType',
      width: 120,
      render: (type: ScriptType) => {
        const opt = SCRIPT_TYPE_OPTIONS.find((o) => o.value === type)
        return <Tag color={opt?.color || 'default'}>{opt?.label || type}</Tag>
      },
    },
    {
      title: '파일명',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '버전',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '대상 유형',
      dataIndex: 'targetAssetTypeName',
      key: 'targetAssetTypeName',
      width: 120,
      render: (name: string | null) => name || '전체',
    },
    {
      title: '스케줄',
      dataIndex: 'scheduleCount',
      key: 'scheduleCount',
      width: 80,
      align: 'center',
      render: (count: number) => <Badge count={count} showZero color={count > 0 ? 'blue' : 'default'} />,
    },
    {
      title: '실행',
      dataIndex: 'executionCount',
      key: 'executionCount',
      width: 80,
      align: 'center',
      render: (count: number) => <Badge count={count} showZero overflowCount={999} color="cyan" />,
    },
    {
      title: '업로드일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="다운로드">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadScript(record)}
            />
          </Tooltip>
          <Tooltip title="수정">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditScript(record)}
            />
          </Tooltip>
          <Popconfirm
            title="이 스크립트를 삭제하시겠습니까?"
            onConfirm={() => handleDeleteScript(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Tooltip title="삭제">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const scheduleColumns: ColumnsType<VulnCheckSchedule> = [
    {
      title: '스케줄명',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <ScheduleOutlined />
          <Text strong>{name}</Text>
          {!record.isActive && <Tag color="default">비활성</Tag>}
        </Space>
      ),
    },
    {
      title: '스크립트',
      dataIndex: 'scriptName',
      key: 'scriptName',
      width: 200,
    },
    {
      title: 'Cron 표현식',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      width: 160,
      render: (cron: string) => <Tag icon={<ClockCircleOutlined />}>{cron}</Tag>,
    },
    {
      title: '마지막 실행',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 160,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '다음 실행',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 160,
      render: (date: string | null) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="수정">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditSchedule(record)}
            />
          </Tooltip>
          <Popconfirm
            title="이 스케줄을 삭제하시겠습니까?"
            onConfirm={() => handleDeleteSchedule(record.id)}
            okText="삭제"
            cancelText="취소"
          >
            <Tooltip title="삭제">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const executionColumns: ColumnsType<VulnCheckExecution> = [
    {
      title: '스크립트',
      dataIndex: 'scriptName',
      key: 'scriptName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '대상 자산',
      key: 'asset',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.assetName}</Text>
          {record.assetCode && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.assetCode}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const info = EXECUTION_STATUS_MAP[status] || { color: 'default', label: status }
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: '발견 취약점',
      dataIndex: 'vulnerabilitiesFound',
      key: 'vulnerabilitiesFound',
      width: 120,
      align: 'center',
      render: (count: number, record) => (
        <Space size={4}>
          <Text>{count}</Text>
          {record.severityHigh > 0 && <Tag color="red">{record.severityHigh}</Tag>}
          {record.severityMedium > 0 && <Tag color="orange">{record.severityMedium}</Tag>}
          {record.severityLow > 0 && <Tag color="blue">{record.severityLow}</Tag>}
        </Space>
      ),
    },
    {
      title: '실행 시간',
      key: 'time',
      width: 160,
      render: (_, record) =>
        record.startedAt ? dayjs(record.startedAt).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '실행자',
      dataIndex: 'executorName',
      key: 'executorName',
      width: 100,
      render: (name: string | null, record) =>
        name || (record.scheduleId ? '자동' : '-'),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="상세">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewExecution(record)}
            />
          </Tooltip>
          <Tooltip title="결과 입력">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenResultInput(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // =========================================================================
  // 렌더링
  // =========================================================================

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        <BugOutlined /> 취약점 점검 스크립트
      </Typography.Title>

      {/* 통계 카드 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="등록 스크립트"
                value={stats.activeScripts}
                suffix={`/ ${stats.totalScripts}`}
                prefix={<CodeOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="활성 스케줄"
                value={stats.activeSchedules}
                suffix={`/ ${stats.totalSchedules}`}
                prefix={<ScheduleOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="최근 30일 실행"
                value={stats.recentExecutions}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="고위험"
                value={stats.severityDistribution.high}
                valueStyle={{ color: '#cf1322' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="중위험"
                value={stats.severityDistribution.medium}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="저위험"
                value={stats.severityDistribution.low}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 탭 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            activeTab === 'scripts' ? (
              <Space>
                <Search
                  placeholder="스크립트 검색"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onSearch={loadScripts}
                  style={{ width: 240 }}
                  allowClear
                />
                <Button type="primary" icon={<UploadOutlined />} onClick={handleCreateScript}>
                  스크립트 업로드
                </Button>
              </Space>
            ) : activeTab === 'schedules' ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateSchedule}>
                스케줄 추가
              </Button>
            ) : (
              <Space>
                <Button icon={<SyncOutlined />} onClick={() => loadExecutions()}>
                  새로고침
                </Button>
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleManualRun}>
                  수동 실행
                </Button>
              </Space>
            )
          }
          items={[
            {
              key: 'scripts',
              label: (
                <span>
                  <CodeOutlined /> 스크립트
                </span>
              ),
              children: (
                <Table
                  columns={scriptColumns}
                  dataSource={scripts}
                  rowKey="id"
                  loading={scriptsLoading}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                />
              ),
            },
            {
              key: 'schedules',
              label: (
                <span>
                  <ScheduleOutlined /> 스케줄
                </span>
              ),
              children: (
                <Table
                  columns={scheduleColumns}
                  dataSource={schedules}
                  rowKey="id"
                  loading={schedulesLoading}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                />
              ),
            },
            {
              key: 'executions',
              label: (
                <span>
                  <ThunderboltOutlined /> 실행 결과
                </span>
              ),
              children: (
                <Table
                  columns={executionColumns}
                  dataSource={executions}
                  rowKey="id"
                  loading={executionsLoading}
                  pagination={{
                    ...executionPagination,
                    onChange: (page) => loadExecutions(page),
                    showSizeChanger: false,
                  }}
                  size="middle"
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 스크립트 업로드/수정 모달 */}
      <Modal
        title={editingScript ? '스크립트 수정' : '스크립트 업로드'}
        open={scriptModalVisible}
        onOk={handleScriptSubmit}
        onCancel={() => setScriptModalVisible(false)}
        width={600}
        okText={editingScript ? '수정' : '업로드'}
      >
        <Form form={scriptForm} layout="vertical">
          <Form.Item
            name="name"
            label="스크립트명"
            rules={[{ required: true, message: '스크립트명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 웹 서버 SSL 인증서 점검" />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <TextArea rows={3} placeholder="스크립트에 대한 설명" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scriptType"
                label="스크립트 유형"
                rules={[{ required: true, message: '유형을 선택해주세요.' }]}
              >
                <Select
                  options={SCRIPT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="version" label="버전">
                <Input placeholder="1.0" />
              </Form.Item>
            </Col>
          </Row>

          {!editingScript && (
            <Form.Item
              label="스크립트 파일"
              required
              help="허용 형식: .py, .sh, .ps1, .bat, .rb, .pl, .yaml, .yml, .json, .xml, .txt (최대 10MB)"
            >
              <Upload
                beforeUpload={(file) => {
                  setUploadFile(file as unknown as UploadFile)
                  return false
                }}
                maxCount={1}
                fileList={uploadFile ? [uploadFile] : []}
                onRemove={() => setUploadFile(null)}
              >
                <Button icon={<UploadOutlined />}>파일 선택</Button>
              </Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 스케줄 생성/수정 모달 */}
      <Modal
        title={editingSchedule ? '스케줄 수정' : '스케줄 추가'}
        open={scheduleModalVisible}
        onOk={handleScheduleSubmit}
        onCancel={() => setScheduleModalVisible(false)}
        width={600}
        okText={editingSchedule ? '수정' : '생성'}
      >
        <Form form={scheduleForm} layout="vertical">
          {!editingSchedule && (
            <Form.Item
              name="scriptId"
              label="스크립트"
              rules={[{ required: true, message: '스크립트를 선택해주세요.' }]}
            >
              <Select
                placeholder="스크립트 선택"
                options={scripts
                  .filter((s) => s.isActive)
                  .map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="스케줄명"
            rules={[{ required: true, message: '스케줄명을 입력해주세요.' }]}
          >
            <Input placeholder="예: 주간 웹서버 점검" />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <TextArea rows={2} placeholder="스케줄 설명" />
          </Form.Item>

          <Form.Item
            name="cronExpression"
            label="실행 주기 (Cron 표현식)"
            rules={[{ required: true, message: 'Cron 표현식을 입력해주세요.' }]}
            help="형식: 분 시 일 월 요일 (예: 0 2 * * 1 = 매주 월요일 02:00)"
          >
            <Input placeholder="0 2 * * 1" />
          </Form.Item>

          <Space wrap style={{ marginBottom: 16 }}>
            {CRON_PRESETS.map((preset) => (
              <Tag
                key={preset.value}
                style={{ cursor: 'pointer' }}
                onClick={() => scheduleForm.setFieldsValue({ cronExpression: preset.value })}
              >
                {preset.label}
              </Tag>
            ))}
          </Space>
        </Form>
      </Modal>

      {/* 수동 실행 모달 */}
      <Modal
        title="수동 점검 실행"
        open={runModalVisible}
        onOk={handleRunSubmit}
        onCancel={() => setRunModalVisible(false)}
        okText="실행"
      >
        <Form form={runForm} layout="vertical">
          <Form.Item
            name="scriptId"
            label="스크립트"
            rules={[{ required: true, message: '스크립트를 선택해주세요.' }]}
          >
            <Select
              placeholder="스크립트 선택"
              options={scripts
                .filter((s) => s.isActive)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>

          <Form.Item
            name="assetIds"
            label="대상 자산 ID"
            rules={[{ required: true, message: '자산 ID를 입력해주세요.' }]}
            help="콤마로 구분하여 여러 자산 ID를 입력할 수 있습니다. (예: 1,2,3)"
          >
            <Input placeholder="1,2,3" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 실행 결과 상세 Drawer */}
      <Drawer
        title="실행 결과 상세"
        open={executionDetailOpen}
        onClose={() => setExecutionDetailOpen(false)}
        width={640}
        extra={
          selectedExecution && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => handleOpenResultInput(selectedExecution)}
            >
              결과 입력
            </Button>
          )
        }
      >
        {selectedExecution && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="스크립트">
                {selectedExecution.scriptName}
              </Descriptions.Item>
              <Descriptions.Item label="대상 자산">
                {selectedExecution.assetName} ({selectedExecution.assetCode})
              </Descriptions.Item>
              <Descriptions.Item label="상태">
                <Tag
                  color={
                    EXECUTION_STATUS_MAP[selectedExecution.status]?.color || 'default'
                  }
                >
                  {EXECUTION_STATUS_MAP[selectedExecution.status]?.label ||
                    selectedExecution.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="실행자">
                {selectedExecution.executorName ||
                  (selectedExecution.scheduleId ? '자동 (스케줄)' : '-')}
              </Descriptions.Item>
              <Descriptions.Item label="시작 시간">
                {selectedExecution.startedAt
                  ? dayjs(selectedExecution.startedAt).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="완료 시간">
                {selectedExecution.completedAt
                  ? dayjs(selectedExecution.completedAt).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="발견 취약점">
                <Space>
                  <Text strong>{selectedExecution.vulnerabilitiesFound}건</Text>
                  <Tag color="red">고위험 {selectedExecution.severityHigh}</Tag>
                  <Tag color="orange">중위험 {selectedExecution.severityMedium}</Tag>
                  <Tag color="blue">저위험 {selectedExecution.severityLow}</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {selectedExecution.resultSummary && (
              <Card title="결과 요약" size="small" style={{ marginTop: 16 }}>
                <Text>{selectedExecution.resultSummary}</Text>
              </Card>
            )}

            {selectedExecution.resultDetail && (
              <Card title="상세 결과" size="small" style={{ marginTop: 16 }}>
                <pre
                  style={{
                    maxHeight: 400,
                    overflow: 'auto',
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {selectedExecution.resultDetail}
                </pre>
              </Card>
            )}

            {selectedExecution.errorMessage && (
              <Card
                title="에러 메시지"
                size="small"
                style={{ marginTop: 16 }}
                styles={{ header: { background: '#fff2f0' } }}
              >
                <Text type="danger">{selectedExecution.errorMessage}</Text>
              </Card>
            )}
          </div>
        )}
      </Drawer>

      {/* 결과 입력 모달 */}
      <Modal
        title={`결과 입력 — ${resultTargetExecution?.assetName || ''}`}
        open={resultModalVisible}
        onOk={handleResultSubmit}
        onCancel={() => setResultModalVisible(false)}
        width={640}
        okText="저장"
      >
        <Form form={resultForm} layout="vertical">
          <Form.Item
            name="status"
            label="상태"
            rules={[{ required: true, message: '상태를 선택해주세요.' }]}
          >
            <Select
              options={[
                { value: 'completed', label: '완료' },
                { value: 'failed', label: '실패' },
                { value: 'cancelled', label: '취소' },
              ]}
            />
          </Form.Item>

          <Form.Item name="resultSummary" label="결과 요약">
            <TextArea rows={3} placeholder="점검 결과를 요약해주세요." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="vulnerabilitiesFound"
                label="총 취약점 수"
              >
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="severityHigh" label="고위험">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="severityMedium" label="중위험">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="severityLow" label="저위험">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="resultDetail" label="상세 결과">
            <TextArea
              rows={6}
              placeholder="상세 점검 결과를 입력해주세요. (스크립트 출력 등)"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>

          <Form.Item name="errorMessage" label="에러 메시지">
            <TextArea rows={2} placeholder="실패 시 에러 메시지" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default VulnCheckScriptsPage
