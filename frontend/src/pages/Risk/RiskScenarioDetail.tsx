/**
 * 위험 시나리오 상세 페이지
 * FR-703: 위험 시나리오 상세 관리
 *
 * 기능:
 * - 시나리오 기본 정보 조회 및 인라인 수정
 * - 평가 통계 대시보드 (고/중/저위험, DoA 초과)
 * - 탭: 평가 목록, 처리 계획, 위험 분포
 * - 상태 워크플로우 (진행, 완료, 취소)
 * - 위험 재산정 / Excel 내보내기
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Row,
  Col,
  message,
  Modal,
  Breadcrumb,
  Statistic,
  Table,
  Spin,
  Badge,
  Progress,
  Tabs,
  Form,
  Input,
  DatePicker,
  Tooltip,
  Empty,
} from 'antd'
import {
  HomeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  WarningOutlined,
  BarChartOutlined,
  EditOutlined,
  DownloadOutlined,
  ReloadOutlined,
  StopOutlined,
  PlayCircleOutlined,
  FileDoneOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getRiskScenario,
  getRiskAssessments,
  deleteRiskScenario,
  updateRiskScenario,
  getRiskReport,
  getRiskTreatmentPlans,
  calculateRiskScenario,
  exportRiskReport,
} from '@/services/risks'
import type {
  RiskScenario,
  RiskScenarioStatus,
  RiskScenarioUpdate,
  RiskAssessment,
  RiskReportSummary,
  RiskTreatmentPlan,
  TreatmentStrategy,
  TreatmentStatus,
} from '@/types'
import type { TableProps } from 'antd'

/** 상태 태그 색상 */
const STATUS_MAP: Record<RiskScenarioStatus, { label: string; color: string }> = {
  draft: { label: '초안', color: 'default' },
  in_progress: { label: '진행중', color: 'processing' },
  completed: { label: '완료', color: 'success' },
  cancelled: { label: '취소', color: 'error' },
}

/** 위험 등급 색상 */
const RISK_LEVEL_COLOR: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
}

const RISK_LEVEL_LABEL: Record<string, string> = {
  high: '고위험',
  medium: '중위험',
  low: '저위험',
}

/** 처리 전략 라벨 */
const STRATEGY_LABEL: Record<TreatmentStrategy, string> = {
  reduce: '감소',
  avoid: '회피',
  transfer: '전가',
  accept: '수용',
}

const STRATEGY_COLOR: Record<TreatmentStrategy, string> = {
  reduce: 'blue',
  avoid: 'red',
  transfer: 'orange',
  accept: 'green',
}

/** 처리 상태 라벨 */
const TREATMENT_STATUS_LABEL: Record<TreatmentStatus, string> = {
  planned: '계획',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
}

const TREATMENT_STATUS_COLOR: Record<TreatmentStatus, string> = {
  planned: 'default',
  in_progress: 'processing',
  completed: 'success',
  cancelled: 'error',
}

const RiskScenarioDetailPage = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()
  const id = Number(scenarioId)

  const [scenario, setScenario] = useState<RiskScenario | null>(null)
  const [assessments, setAssessments] = useState<RiskAssessment[]>([])
  const [treatmentPlans, setTreatmentPlans] = useState<RiskTreatmentPlan[]>([])
  const [report, setReport] = useState<RiskReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [treatmentLoading, setTreatmentLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('assessments')
  const [form] = Form.useForm()

  const [assessmentPagination, setAssessmentPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [treatmentPagination, setTreatmentPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  // === 데이터 로드 ===

  const fetchScenario = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await getRiskScenario(id)
      setScenario(data)
    } catch {
      message.error('시나리오 정보를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchAssessments = useCallback(async () => {
    if (!id) return
    setAssessmentLoading(true)
    try {
      const data = await getRiskAssessments(id, {
        page: assessmentPagination.current,
        size: assessmentPagination.pageSize,
      })
      setAssessments(data.items)
      setAssessmentPagination((prev) => ({ ...prev, total: data.total }))
    } catch {
      // 평가 데이터가 없을 수 있음
    } finally {
      setAssessmentLoading(false)
    }
  }, [id, assessmentPagination.current, assessmentPagination.pageSize])

  const fetchTreatmentPlans = useCallback(async () => {
    if (!id) return
    setTreatmentLoading(true)
    try {
      const data = await getRiskTreatmentPlans({
        page: treatmentPagination.current,
        size: treatmentPagination.pageSize,
        scenario_id: id,
      })
      setTreatmentPlans(data.items)
      setTreatmentPagination((prev) => ({ ...prev, total: data.total }))
    } catch {
      // 처리 계획이 없을 수 있음
    } finally {
      setTreatmentLoading(false)
    }
  }, [id, treatmentPagination.current, treatmentPagination.pageSize])

  const fetchReport = useCallback(async () => {
    if (!id) return
    try {
      const data = await getRiskReport(id)
      setReport(data)
    } catch {
      // 보고서 데이터가 없을 수 있음
    }
  }, [id])

  useEffect(() => {
    fetchScenario()
    fetchReport()
  }, [fetchScenario, fetchReport])

  useEffect(() => {
    fetchAssessments()
  }, [fetchAssessments])

  useEffect(() => {
    if (activeTab === 'treatments') {
      fetchTreatmentPlans()
    }
  }, [activeTab, fetchTreatmentPlans])

  // === 핸들러 ===

  // 시나리오 수정 모달
  const handleEditClick = () => {
    if (!scenario) return
    form.setFieldsValue({
      name: scenario.name,
      description: scenario.description,
      start_date: scenario.start_date ? dayjs(scenario.start_date) : undefined,
      end_date: scenario.end_date ? dayjs(scenario.end_date) : undefined,
    })
    setEditModalVisible(true)
  }

  const handleEditSubmit = async () => {
    if (!scenario) return
    try {
      const values = await form.validateFields()
      const data: RiskScenarioUpdate = {
        name: values.name,
        description: values.description || null,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      }
      await updateRiskScenario(scenario.id, data)
      message.success('시나리오가 수정되었습니다')
      setEditModalVisible(false)
      fetchScenario()
    } catch {
      // 폼 검증 에러
    }
  }

  // 상태 변경 핸들러
  const handleStatusChange = (newStatus: RiskScenarioStatus) => {
    if (!scenario) return

    const labels: Record<string, { title: string; content: string }> = {
      in_progress: {
        title: '평가 시작',
        content: '이 시나리오의 위험 평가를 시작하시겠습니까?',
      },
      completed: {
        title: '평가 완료',
        content: '이 시나리오의 위험 평가를 완료하시겠습니까? 완료 후에는 평가 데이터를 수정할 수 없습니다.',
      },
      cancelled: {
        title: '시나리오 취소',
        content: '이 시나리오를 취소하시겠습니까? 취소 후에는 복원할 수 없습니다.',
      },
    }

    const config = labels[newStatus]
    if (!config) return

    Modal.confirm({
      title: config.title,
      icon: <ExclamationCircleOutlined />,
      content: config.content,
      okText: '확인',
      okType: newStatus === 'cancelled' ? 'danger' : 'primary',
      cancelText: '취소',
      onOk: async () => {
        try {
          await updateRiskScenario(scenario.id, { status: newStatus })
          message.success('상태가 변경되었습니다')
          fetchScenario()
        } catch {
          message.error('상태 변경에 실패했습니다')
        }
      },
    })
  }

  // 삭제 핸들러
  const handleDelete = () => {
    Modal.confirm({
      title: '시나리오 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 시나리오를 삭제하시겠습니까? 관련된 모든 평가 데이터도 삭제됩니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await deleteRiskScenario(id)
          message.success('시나리오가 삭제되었습니다')
          navigate('/risk')
        } catch {
          message.error('시나리오 삭제에 실패했습니다')
        }
      },
    })
  }

  // 위험 재산정
  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await calculateRiskScenario(id)
      message.success('위험도가 재산정되었습니다')
      fetchAssessments()
      fetchReport()
      fetchScenario()
    } catch {
      message.error('위험도 재산정에 실패했습니다')
    } finally {
      setRecalculating(false)
    }
  }

  // Excel 내보내기
  const handleExport = async (format: 'excel' | 'word') => {
    setExporting(true)
    try {
      const result = await exportRiskReport(id, format)
      if (result.download_url) {
        window.open(result.download_url, '_blank')
      }
      message.success(`${format === 'excel' ? 'Excel' : 'Word'} 파일이 생성되었습니다`)
    } catch {
      message.error('내보내기에 실패했습니다')
    } finally {
      setExporting(false)
    }
  }

  // 테이블 페이지 변경
  const handleAssessmentTableChange: TableProps<RiskAssessment>['onChange'] = (pag) => {
    setAssessmentPagination((prev) => ({
      ...prev,
      current: pag.current || 1,
      pageSize: pag.pageSize || 10,
    }))
  }

  const handleTreatmentTableChange: TableProps<RiskTreatmentPlan>['onChange'] = (pag) => {
    setTreatmentPagination((prev) => ({
      ...prev,
      current: pag.current || 1,
      pageSize: pag.pageSize || 10,
    }))
  }

  // === 컬럼 정의 ===

  const assessmentColumns: TableProps<RiskAssessment>['columns'] = [
    {
      title: '자산',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
    },
    {
      title: '위협',
      dataIndex: 'threat_name',
      key: 'threat_name',
      ellipsis: true,
    },
    {
      title: '취약점',
      dataIndex: 'vulnerability_name',
      key: 'vulnerability_name',
      ellipsis: true,
    },
    {
      title: '자산가치',
      dataIndex: 'asset_value',
      key: 'asset_value',
      width: 90,
      align: 'center',
    },
    {
      title: '위협수준',
      dataIndex: 'threat_level',
      key: 'threat_level',
      width: 90,
      align: 'center',
    },
    {
      title: '취약수준',
      dataIndex: 'vulnerability_level',
      key: 'vulnerability_level',
      width: 90,
      align: 'center',
    },
    {
      title: 'DoR',
      dataIndex: 'risk_score',
      key: 'risk_score',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.risk_score ?? 0) - (b.risk_score ?? 0),
      render: (score: number) => (
        <span style={{ fontWeight: 'bold', fontSize: 16 }}>{score}</span>
      ),
    },
    {
      title: '등급',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 90,
      align: 'center',
      filters: [
        { text: '고위험', value: 'high' },
        { text: '중위험', value: 'medium' },
        { text: '저위험', value: 'low' },
      ],
      onFilter: (value, record) => record.risk_level === value,
      render: (level: string) => (
        <Tag color={RISK_LEVEL_COLOR[level] || 'default'}>
          {RISK_LEVEL_LABEL[level] || level}
        </Tag>
      ),
    },
    {
      title: 'DoA',
      dataIndex: 'exceeds_doa',
      key: 'exceeds_doa',
      width: 80,
      align: 'center',
      filters: [
        { text: '초과', value: true },
        { text: '적합', value: false },
      ],
      onFilter: (value, record) => record.exceeds_doa === value,
      render: (exceeds: boolean) =>
        exceeds ? (
          <Badge status="error" text="초과" />
        ) : (
          <Badge status="success" text="적합" />
        ),
    },
    {
      title: '처리',
      dataIndex: 'has_treatment_plan',
      key: 'has_treatment_plan',
      width: 80,
      align: 'center',
      render: (has: boolean) =>
        has ? (
          <Tag color="blue">있음</Tag>
        ) : (
          <Tag>없음</Tag>
        ),
    },
  ]

  const treatmentColumns: TableProps<RiskTreatmentPlan>['columns'] = [
    {
      title: '대상 자산',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
      render: (name: string | null) => name || '-',
    },
    {
      title: '위협',
      dataIndex: 'threat_name',
      key: 'threat_name',
      ellipsis: true,
      render: (name: string | null) => name || '-',
    },
    {
      title: '위험도',
      dataIndex: 'risk_score',
      key: 'risk_score',
      width: 80,
      align: 'center',
      render: (score: number | null, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 'bold' }}>{score ?? '-'}</span>
          {record.risk_level && (
            <Tag color={RISK_LEVEL_COLOR[record.risk_level] || 'default'} style={{ margin: 0 }}>
              {RISK_LEVEL_LABEL[record.risk_level] || record.risk_level}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '전략',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 80,
      align: 'center',
      render: (strategy: TreatmentStrategy) => (
        <Tag color={STRATEGY_COLOR[strategy]}>{STRATEGY_LABEL[strategy]}</Tag>
      ),
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | null) => desc || '-',
    },
    {
      title: '담당자',
      dataIndex: 'assignee_name',
      key: 'assignee_name',
      width: 100,
      render: (name: string | null) => name || '-',
    },
    {
      title: '기한',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (date: string | null) => {
        if (!date) return '-'
        const d = dayjs(date)
        const isOverdue = d.isBefore(dayjs(), 'day')
        return (
          <span style={{ color: isOverdue ? '#cf1322' : undefined }}>
            {d.format('YYYY-MM-DD')}
          </span>
        )
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center',
      render: (status: TreatmentStatus) => (
        <Tag color={TREATMENT_STATUS_COLOR[status]}>
          {TREATMENT_STATUS_LABEL[status]}
        </Tag>
      ),
    },
    {
      title: '잔여위험',
      dataIndex: 'latest_residual_risk',
      key: 'latest_residual_risk',
      width: 90,
      align: 'center',
      render: (score: number | null) => (score !== null ? score : '-'),
    },
  ]

  // === 렌더링 ===

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!scenario) {
    return (
      <Card>
        <p>시나리오를 찾을 수 없습니다.</p>
        <Button onClick={() => navigate('/risk')}>목록으로 돌아가기</Button>
      </Card>
    )
  }

  const isEditable = scenario.status !== 'completed' && scenario.status !== 'cancelled'
  const isDeletable = scenario.status === 'draft'
  const statusConfig = STATUS_MAP[scenario.status]

  // 위험 분포 계산
  const highCount = scenario.high_risk_count
  const totalCount = scenario.assessment_count
  const mediumCount = report?.risk_distribution?.medium || 0
  const lowCount = report?.risk_distribution?.low || 0

  // 처리 진행률
  const treatmentProgress = report?.treatment_progress

  // 상태 전이 가능 버튼
  const renderStatusActions = () => {
    const actions: React.ReactNode[] = []

    if (scenario.status === 'draft') {
      actions.push(
        <Button
          key="start"
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => handleStatusChange('in_progress')}
        >
          평가 시작
        </Button>
      )
    }

    if (scenario.status === 'in_progress') {
      actions.push(
        <Button
          key="complete"
          type="primary"
          icon={<FileDoneOutlined />}
          onClick={() => handleStatusChange('completed')}
          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
        >
          평가 완료
        </Button>
      )
      actions.push(
        <Button
          key="cancel"
          danger
          icon={<StopOutlined />}
          onClick={() => handleStatusChange('cancelled')}
        >
          취소
        </Button>
      )
    }

    return actions
  }

  return (
    <div>
      {/* 브레드크럼 */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <HomeOutlined />, href: '/dashboard' },
          { title: '위험 관리', href: '/risk' },
          { title: scenario.name },
        ]}
      />

      {/* 시나리오 기본 정보 */}
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/risk')}
            />
            <span>{scenario.name}</span>
            <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
          </Space>
        }
        extra={
          <Space wrap>
            {renderStatusActions()}
            {isEditable && (
              <>
                <Button
                  icon={<EditOutlined />}
                  onClick={handleEditClick}
                >
                  수정
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => navigate(`/risk/scenarios/${id}/assessment`)}
                >
                  평가 수행
                </Button>
              </>
            )}
            {isDeletable && (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                삭제
              </Button>
            )}
          </Space>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="시나리오명">{scenario.name}</Descriptions.Item>
          <Descriptions.Item label="상태">
            <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="작성자">{scenario.creator_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="시작일">
            {dayjs(scenario.start_date).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="종료일">
            {scenario.end_date ? dayjs(scenario.end_date).format('YYYY-MM-DD') : '진행중'}
          </Descriptions.Item>
          <Descriptions.Item label="생성일">
            {dayjs(scenario.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          {scenario.completed_at && (
            <Descriptions.Item label="완료일">
              {dayjs(scenario.completed_at).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          )}
          {scenario.description && (
            <Descriptions.Item label="설명" span={3}>
              {scenario.description}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 평가 통계 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="총 평가 건수"
              value={totalCount}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="고위험"
              value={highCount}
              valueStyle={{ color: highCount > 0 ? '#cf1322' : undefined }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="중위험"
              value={mediumCount}
              valueStyle={{ color: mediumCount > 0 ? '#fa8c16' : undefined }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="DoA 초과"
              value={scenario.exceeding_doa_count}
              valueStyle={{ color: scenario.exceeding_doa_count > 0 ? '#cf1322' : undefined }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 위험 분포 + 처리 진행률 */}
      {totalCount > 0 && (
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col xs={24} md={14}>
            <Card title="위험 등급 분포" size="small">
              <Row gutter={24}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={Math.round((highCount / totalCount) * 100)}
                      strokeColor="#cf1322"
                      size={80}
                    />
                    <div style={{ marginTop: 8 }}>고위험 {highCount}건</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={Math.round((mediumCount / totalCount) * 100)}
                      strokeColor="#fa8c16"
                      size={80}
                    />
                    <div style={{ marginTop: 8 }}>중위험 {mediumCount}건</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="circle"
                      percent={Math.round((lowCount / totalCount) * 100)}
                      strokeColor="#52c41a"
                      size={80}
                    />
                    <div style={{ marginTop: 8 }}>저위험 {lowCount}건</div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={10}>
            <Card title="처리 계획 진행률" size="small">
              {treatmentProgress ? (
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="dashboard"
                    percent={Math.round(treatmentProgress.completion_rate)}
                    size={120}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#52c41a',
                    }}
                  />
                  <Row gutter={8} style={{ marginTop: 12 }}>
                    <Col span={6}>
                      <Statistic title="계획" value={treatmentProgress.planned} valueStyle={{ fontSize: 16 }} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="진행" value={treatmentProgress.in_progress} valueStyle={{ fontSize: 16 }} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="완료" value={treatmentProgress.completed} valueStyle={{ fontSize: 16, color: '#52c41a' }} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="합계" value={treatmentProgress.total} valueStyle={{ fontSize: 16 }} />
                    </Col>
                  </Row>
                </div>
              ) : (
                <Empty description="처리 계획 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* 탭 영역 */}
      <Card style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            <Space>
              {isEditable && (
                <Tooltip title="모든 평가의 위험도를 재산정합니다">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleRecalculate}
                    loading={recalculating}
                  >
                    위험 재산정
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Excel로 내보내기">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleExport('excel')}
                  loading={exporting}
                >
                  Excel
                </Button>
              </Tooltip>
            </Space>
          }
          items={[
            {
              key: 'assessments',
              label: `평가 목록 (${totalCount})`,
              children: (
                <>
                  {isEditable && (
                    <div style={{ marginBottom: 16 }}>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => navigate(`/risk/scenarios/${id}/assessment`)}
                      >
                        평가 수행
                      </Button>
                    </div>
                  )}
                  <Table
                    columns={assessmentColumns}
                    dataSource={assessments}
                    loading={assessmentLoading}
                    rowKey="id"
                    pagination={{
                      ...assessmentPagination,
                      showSizeChanger: true,
                      showTotal: (total) => `총 ${total}건`,
                    }}
                    onChange={handleAssessmentTableChange}
                    size="small"
                    scroll={{ x: 1000 }}
                  />
                </>
              ),
            },
            {
              key: 'treatments',
              label: `처리 계획 (${treatmentProgress?.total || 0})`,
              children: (
                <Table
                  columns={treatmentColumns}
                  dataSource={treatmentPlans}
                  loading={treatmentLoading}
                  rowKey="id"
                  pagination={{
                    ...treatmentPagination,
                    showSizeChanger: true,
                    showTotal: (total) => `총 ${total}건`,
                  }}
                  onChange={handleTreatmentTableChange}
                  size="small"
                  scroll={{ x: 900 }}
                  locale={{ emptyText: <Empty description="등록된 처리 계획이 없습니다" /> }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 수정 모달 */}
      <Modal
        title="시나리오 수정"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        okText="저장"
        cancelText="취소"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="시나리오명"
            rules={[{ required: true, message: '시나리오명을 입력해주세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            name="start_date"
            label="시작일"
            rules={[{ required: true, message: '시작일을 입력해주세요' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="end_date" label="종료일">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RiskScenarioDetailPage
