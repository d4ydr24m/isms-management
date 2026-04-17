/**
 * 위험 처리 계획 페이지
 * FR-605: 위험 처리 계획 수립 및 관리
 *
 * 기능:
 * - 처리 계획 목록 (필터: 전략, 상태, 담당자)
 * - 처리 계획 생성/수정
 * - 처리 조치(Action) 등록
 * - 진행률 통계 카드
 * - 잔여 위험 표시
 */
import { useState, useEffect, useCallback } from 'react'
import {
  App,
  Card,
  Button,
  Space,
  Table,
  Select,
  Modal,
  Form,
  Tag,
  Tooltip,
  Input,
  InputNumber,
  Statistic,
  Row,
  Col,
  Progress,
  DatePicker,
  Badge,
  Descriptions,
  Timeline,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowDownOutlined,
  StopOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileAddOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import {
  getRiskScenarios,
  getRiskAssessments,
  getRiskTreatmentPlans,
  getRiskTreatmentPlan,
  createRiskTreatmentPlan,
  updateRiskTreatmentPlan,
  deleteRiskTreatmentPlan,
  createRiskTreatmentAction,
  getRiskTreatmentActions,
  getRiskTreatmentProgress,
} from '@/services/risks'
import { apiClient } from '@/services/api'
import { usePermissions } from '@/hooks'
import type {
  RiskScenario,
  RiskAssessment,
  RiskTreatmentPlan,
  RiskTreatmentPlanCreate,
  RiskTreatmentPlanUpdate,
  RiskTreatmentAction,
  RiskTreatmentActionCreate,
  RiskTreatmentProgress,
  TreatmentStrategy,
  TreatmentStatus,
} from '@/types'
import { TREATMENT_STRATEGIES, TREATMENT_STATUSES, RISK_LEVELS } from '@/types/risk'

const { Option } = Select

// 전략 아이콘 매핑
const strategyIcons: Record<TreatmentStrategy, React.ReactNode> = {
  reduce: <ArrowDownOutlined style={{ color: '#1890ff' }} />,
  avoid: <StopOutlined style={{ color: '#ff4d4f' }} />,
  transfer: <SwapOutlined style={{ color: '#faad14' }} />,
  accept: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
}

interface TreatmentFilters {
  strategy?: TreatmentStrategy
  status?: TreatmentStatus
}

const RiskTreatmentPage = () => {
  const { message, modal } = App.useApp()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission('risk:create')
  const canUpdate = hasPermission('risk:update')
  const canDelete = hasPermission('risk:delete')
  // 목록 상태
  const [plans, setPlans] = useState<RiskTreatmentPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState<TreatmentFilters>({})
  const [progress, setProgress] = useState<RiskTreatmentProgress | null>(null)

  // 수정 모달
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingPlan, setEditingPlan] = useState<RiskTreatmentPlan | null>(null)
  const [editForm] = Form.useForm()
  const [editLoading, setEditLoading] = useState(false)

  // 조치 등록 모달
  const [actionModalVisible, setActionModalVisible] = useState(false)
  const [actionTargetPlan, setActionTargetPlan] = useState<RiskTreatmentPlan | null>(null)
  const [actionForm] = Form.useForm()
  const [actionLoading, setActionLoading] = useState(false)

  // 상세 조회 모달
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailPlan, setDetailPlan] = useState<RiskTreatmentPlan | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailActions, setDetailActions] = useState<RiskTreatmentAction[]>([])

  // 생성 모달
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [createForm] = Form.useForm()
  const [createLoading, setCreateLoading] = useState(false)
  const [scenarios, setScenarios] = useState<RiskScenario[]>([])
  const [assessmentsForCreate, setAssessmentsForCreate] = useState<RiskAssessment[]>([])
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)
  const [personnelList, setPersonnelList] = useState<{ id: number; name: string; position?: string; departmentName?: string }[]>([])

  // 담당자 목록 조회
  const fetchPersonnel = useCallback(async () => {
    try {
      const response = await apiClient.get<{ items: any[]; total: number }>('/personnel', { params: { pageSize: 100, isActive: true } })
      setPersonnelList((response.data.items || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        departmentName: p.departmentName,
      })))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchPersonnel()
  }, [fetchPersonnel])

  // 목록 조회
  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getRiskTreatmentPlans({
        page: pagination.current,
        size: pagination.pageSize,
        ...filters,
      })
      setPlans(response.items)
      setPagination((prev) => ({ ...prev, total: response.total }))
    } catch {
      message.error('처리 계획 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters])

  // 진행률 조회
  const fetchProgress = useCallback(async () => {
    try {
      const data = await getRiskTreatmentProgress()
      setProgress(data)
    } catch {
      console.warn('진행률을 불러올 수 없습니다')
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  // 테이블 변경
  const handleTableChange: TableProps<RiskTreatmentPlan>['onChange'] = (paginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 10,
    }))
  }

  // 수정 모달 열기
  const handleEditClick = (plan: RiskTreatmentPlan) => {
    setEditingPlan(plan)
    editForm.setFieldsValue({
      strategy: plan.strategy,
      description: plan.description,
      assigneeId: plan.assigneeId,
      dueDate: plan.dueDate ? dayjs(plan.dueDate) : null,
      budget: plan.budget,
      status: plan.status,
    })
    setEditModalVisible(true)
  }

  // 수정 저장
  const handleEditSave = async () => {
    if (!editingPlan) return
    try {
      const values = await editForm.validateFields()
      setEditLoading(true)

      const data: RiskTreatmentPlanUpdate = {
        strategy: values.strategy,
        description: values.description || null,
        assigneeId: values.assigneeId ?? null,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        budget: values.budget ?? null,
        status: values.status,
      }

      await updateRiskTreatmentPlan(editingPlan.id, data)
      message.success('처리 계획이 수정되었습니다')
      setEditModalVisible(false)
      editForm.resetFields()
      fetchPlans()
      fetchProgress()
    } catch {
      // 폼 검증 에러
    } finally {
      setEditLoading(false)
    }
  }

  // 조치 등록 모달 열기
  const handleActionClick = (plan: RiskTreatmentPlan) => {
    setActionTargetPlan(plan)
    actionForm.resetFields()
    setActionModalVisible(true)
  }

  // 조치 저장
  const handleActionSave = async () => {
    if (!actionTargetPlan) return
    try {
      const values = await actionForm.validateFields()
      setActionLoading(true)

      const data: RiskTreatmentActionCreate = {
        actionDescription: values.actionDescription,
        result: values.result || null,
        residualRiskScore: values.residualRiskScore ?? null,
        evidenceFilePath: values.evidenceFilePath || null,
      }

      await createRiskTreatmentAction(actionTargetPlan.id, data)
      message.success('처리 조치가 등록되었습니다')
      setActionModalVisible(false)
      actionForm.resetFields()
      fetchPlans()
      fetchProgress()
    } catch {
      // 폼 검증 에러
    } finally {
      setActionLoading(false)
    }
  }

  // 상세 조회
  const handleDetailClick = async (plan: RiskTreatmentPlan) => {
    setDetailModalVisible(true)
    setDetailLoading(true)
    try {
      const [detail, actions] = await Promise.all([
        getRiskTreatmentPlan(plan.id),
        getRiskTreatmentActions(plan.id),
      ])
      setDetailPlan(detail)
      setDetailActions(actions)
    } catch {
      message.error('상세 정보를 불러오는데 실패했습니다')
    } finally {
      setDetailLoading(false)
    }
  }

  // 생성 모달 열기
  const handleCreateClick = async () => {
    createForm.resetFields()
    setAssessmentsForCreate([])
    setCreateModalVisible(true)
    try {
      const data = await getRiskScenarios({ size: 100 })
      setScenarios(data.items || [])
    } catch {
      message.error('시나리오 목록을 불러오는데 실패했습니다')
    }
  }

  // 시나리오 선택 시 평가 목록 조회 (처리 계획 미등록 건만)
  const handleScenarioChange = async (scenarioId: number) => {
    createForm.setFieldsValue({ assessmentId: undefined })
    setAssessmentsLoading(true)
    try {
      const data = await getRiskAssessments(scenarioId, { size: 100 })
      const withoutPlan = (data.items || []).filter((a: RiskAssessment) => !a.hasTreatmentPlan)
      setAssessmentsForCreate(withoutPlan)
    } catch {
      message.error('평가 목록을 불러오는데 실패했습니다')
    } finally {
      setAssessmentsLoading(false)
    }
  }

  // 생성 저장
  const handleCreateSave = async () => {
    try {
      const values = await createForm.validateFields()
      setCreateLoading(true)

      const data: RiskTreatmentPlanCreate = {
        strategy: values.strategy,
        description: values.description || null,
        assigneeId: values.assigneeId ?? null,
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        budget: values.budget ?? null,
      }

      await createRiskTreatmentPlan(values.assessmentId, data)
      message.success('처리 계획이 생성되었습니다')
      setCreateModalVisible(false)
      createForm.resetFields()
      fetchPlans()
      fetchProgress()
    } catch {
      // 폼 검증 에러
    } finally {
      setCreateLoading(false)
    }
  }

  // 삭제 핸들러
  const handleDeleteClick = (plan: RiskTreatmentPlan) => {
    modal.confirm({
      title: '처리 계획 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 처리 계획을 삭제하시겠습니까? 관련된 조치 이력도 함께 삭제됩니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await deleteRiskTreatmentPlan(plan.id)
          message.success('처리 계획이 삭제되었습니다')
          fetchPlans()
          fetchProgress()
        } catch {
          message.error('처리 계획 삭제에 실패했습니다')
        }
      },
    })
  }

  // 전략 태그 렌더
  const renderStrategyTag = (strategy: TreatmentStrategy) => {
    const config = TREATMENT_STRATEGIES.find((s) => s.value === strategy)
    return (
      <Space size={4}>
        {strategyIcons[strategy]}
        <span>{config?.label || strategy}</span>
      </Space>
    )
  }

  // 상태 태그 렌더
  const renderStatusTag = (status: TreatmentStatus) => {
    const config = TREATMENT_STATUSES.find((s) => s.value === status)
    return <Tag color={config?.color}>{config?.label || status}</Tag>
  }

  // 테이블 컬럼
  const columns: TableProps<RiskTreatmentPlan>['columns'] = [
    {
      title: '자산/위협',
      key: 'risk_info',
      width: 200,
      render: (_: unknown, record: RiskTreatmentPlan) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.assetName || '-'}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            {record.threatName || '-'} / {record.vulnerabilityName || '-'}
          </span>
        </Space>
      ),
    },
    {
      title: '위험 점수',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.riskScore ?? 0) - (b.riskScore ?? 0),
      render: (score: number | null, record: RiskTreatmentPlan) => {
        if (score === null) return '-'
        const levelConfig = RISK_LEVELS.find((l) => l.value === record.riskLevel)
        return (
          <Tag color={levelConfig?.color} style={{ fontWeight: 'bold' }}>
            {score}
          </Tag>
        )
      },
    },
    {
      title: '처리 전략',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 130,
      filters: TREATMENT_STRATEGIES.map((s) => ({ text: s.label, value: s.value })),
      onFilter: (value, record) => record.strategy === value,
      render: (strategy: TreatmentStrategy) => renderStrategyTag(strategy),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      filters: TREATMENT_STATUSES.map((s) => ({ text: s.label, value: s.value })),
      onFilter: (value, record) => record.status === value,
      render: (status: TreatmentStatus) => renderStatusTag(status),
    },
    {
      title: '담당자',
      dataIndex: 'assigneeName',
      key: 'assigneeName',
      width: 100,
      render: (name: string | null) => name || '-',
    },
    {
      title: '기한',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 110,
      render: (date: string | null) => {
        if (!date) return '-'
        const isOverdue = dayjs(date).isBefore(dayjs(), 'day')
        const isPending = !['completed', 'cancelled'].includes('')
        return (
          <span style={{ color: isOverdue && isPending ? '#ff4d4f' : undefined }}>
            {dayjs(date).format('YYYY-MM-DD')}
            {isOverdue && isPending && (
              <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />
            )}
          </span>
        )
      },
    },
    {
      title: '조치',
      dataIndex: 'actionCount',
      key: 'actionCount',
      width: 60,
      align: 'center',
      render: (count: number) => (
        <Badge count={count} showZero style={{ backgroundColor: count > 0 ? '#1890ff' : '#d9d9d9' }} />
      ),
    },
    {
      title: '잔여 위험',
      dataIndex: 'latestResidualRisk',
      key: 'latestResidualRisk',
      width: 100,
      align: 'center',
      render: (score: number | null, record: RiskTreatmentPlan) => {
        if (score === null) return <span style={{ color: '#d9d9d9' }}>-</span>
        const originalScore = record.riskScore ?? 0
        const reduction = originalScore - score
        return (
          <Tooltip title={`원래 ${originalScore} → 잔여 ${score} (${reduction > 0 ? '-' : ''}${reduction})`}>
            <Space size={4}>
              <span style={{ fontWeight: 'bold' }}>{score}</span>
              {reduction > 0 && (
                <ArrowDownOutlined style={{ color: '#52c41a', fontSize: 11 }} />
              )}
            </Space>
          </Tooltip>
        )
      },
    },
    {
      title: '작업',
      key: 'actions',
      width: 180,
      align: 'center',
      render: (_: unknown, record: RiskTreatmentPlan) => (
        <Space size={4}>
          <Tooltip title="상세 보기">
            <Button type="link" size="small" onClick={() => handleDetailClick(record)}>
              상세
            </Button>
          </Tooltip>
          {canUpdate && (
            <Tooltip title="수정">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditClick(record)}
              />
            </Tooltip>
          )}
          {canCreate && (
            <Tooltip title="조치 등록">
              <Button
                type="link"
                size="small"
                icon={<FileAddOutlined />}
                onClick={() => handleActionClick(record)}
                disabled={record.status === 'completed' || record.status === 'cancelled'}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="삭제">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteClick(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 진행률 통계 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={4}>
            <Statistic title="전체 계획" value={progress?.total ?? 0} suffix="건" />
          </Col>
          <Col span={4}>
            <Statistic
              title="완료"
              value={progress?.completed ?? 0}
              suffix="건"
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="진행 중"
              value={progress?.inProgress ?? 0}
              suffix="건"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="계획됨"
              value={progress?.planned ?? 0}
              suffix="건"
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="취소"
              value={progress?.cancelled ?? 0}
              suffix="건"
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>완료율</div>
              <Progress
                type="circle"
                percent={Math.round(progress?.completionRate ?? 0)}
                size={64}
                strokeColor={
                  (progress?.completionRate ?? 0) >= 80
                    ? '#52c41a'
                    : (progress?.completionRate ?? 0) >= 50
                      ? '#faad14'
                      : '#ff4d4f'
                }
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 처리 계획 목록 */}
      <Card
        title="위험 처리 계획"
        extra={
          <Space>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClick}>
                처리 계획 생성
              </Button>
            )}
            <Select
              placeholder="전략"
              allowClear
              style={{ width: 140 }}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, strategy: value }))
                setPagination((prev) => ({ ...prev, current: 1 }))
              }}
            >
              {TREATMENT_STRATEGIES.map((s) => (
                <Option key={s.value} value={s.value}>
                  {s.label}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="상태"
              allowClear
              style={{ width: 120 }}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, status: value }))
                setPagination((prev) => ({ ...prev, current: 1 }))
              }}
            >
              {TREATMENT_STATUSES.map((s) => (
                <Option key={s.value} value={s.value}>
                  {s.label}
                </Option>
              ))}
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={plans}
          loading={loading}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`,
          }}
          onChange={handleTableChange}
          rowClassName={(record) => {
            if (record.status === 'completed') return ''
            if (record.dueDate && dayjs(record.dueDate).isBefore(dayjs(), 'day')) {
              return 'overdue-row'
            }
            return ''
          }}
        />
      </Card>

      {/* 수정 모달 */}
      <Modal
        title="처리 계획 수정"
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => {
          setEditModalVisible(false)
          editForm.resetFields()
        }}
        okText="저장"
        cancelText="취소"
        confirmLoading={editLoading}
        width={600}
      >
        {editingPlan && (
          <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="자산">{editingPlan.assetName || '-'}</Descriptions.Item>
            <Descriptions.Item label="위험 점수">
              <Tag
                color={
                  RISK_LEVELS.find((l) => l.value === editingPlan.riskLevel)?.color
                }
              >
                {editingPlan.riskScore ?? '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="위협">{editingPlan.threatName || '-'}</Descriptions.Item>
            <Descriptions.Item label="취약점">{editingPlan.vulnerabilityName || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        <Form form={editForm} layout="vertical">
          <Form.Item
            name="strategy"
            label="처리 전략"
            rules={[{ required: true, message: '처리 전략을 선택해주세요' }]}
          >
            <Select>
              {TREATMENT_STRATEGIES.map((s) => (
                <Option key={s.value} value={s.value}>
                  <Space>
                    {strategyIcons[s.value as TreatmentStrategy]}
                    <span>{s.label}</span>
                    <span style={{ fontSize: 12, color: '#8c8c8c' }}>- {s.description}</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="상태"
            rules={[{ required: true, message: '상태를 선택해주세요' }]}
          >
            <Select>
              {TREATMENT_STATUSES.map((s) => (
                <Option key={s.value} value={s.value}>
                  <Tag color={s.color}>{s.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="assigneeId" label="담당자">
            <Select placeholder="담당자 선택" allowClear showSearch optionFilterProp="children">
              {personnelList.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}{p.position ? ` (${p.position})` : ''}{p.departmentName ? ` - ${p.departmentName}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} placeholder="처리 계획 설명" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dueDate" label="기한">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="budget" label="예산 (원)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  }
                  parser={(value) => (value?.replace(/,/g, '') || '0') as unknown as 0}
                  placeholder="예산"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 조치 등록 모달 */}
      <Modal
        title="처리 조치 등록"
        open={actionModalVisible}
        onOk={handleActionSave}
        onCancel={() => {
          setActionModalVisible(false)
          actionForm.resetFields()
        }}
        okText="등록"
        cancelText="취소"
        confirmLoading={actionLoading}
        width={600}
      >
        {actionTargetPlan && (
          <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="자산">{actionTargetPlan.assetName || '-'}</Descriptions.Item>
            <Descriptions.Item label="전략">
              {renderStrategyTag(actionTargetPlan.strategy)}
            </Descriptions.Item>
            <Descriptions.Item label="현재 위험 점수">
              {actionTargetPlan.riskScore ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="최근 잔여 위험">
              {actionTargetPlan.latestResidualRisk ?? '없음'}
            </Descriptions.Item>
          </Descriptions>
        )}

        <Form form={actionForm} layout="vertical">
          <Form.Item
            name="actionDescription"
            label="조치 내용"
            rules={[{ required: true, message: '조치 내용을 입력해주세요' }]}
          >
            <Input.TextArea rows={3} placeholder="수행한 조치 내용을 상세히 기술해주세요" />
          </Form.Item>

          <Form.Item name="result" label="조치 결과">
            <Input.TextArea rows={2} placeholder="조치 결과 (선택)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="residualRiskScore" label="잔여 위험 점수">
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={27}
                  placeholder="1~27"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="evidenceFilePath" label="증적 파일 경로">
                <Input placeholder="증적 파일 경로 (선택)" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 상세 보기 모달 */}
      <Modal
        title="처리 계획 상세"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setDetailPlan(null)
          setDetailActions([])
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            닫기
          </Button>,
          detailPlan && detailPlan.status !== 'completed' && detailPlan.status !== 'cancelled' && (
            <Button
              key="action"
              type="primary"
              icon={<FileAddOutlined />}
              onClick={() => {
                setDetailModalVisible(false)
                if (detailPlan) handleActionClick(detailPlan)
              }}
            >
              조치 등록
            </Button>
          ),
        ]}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>로딩 중...</div>
        ) : detailPlan ? (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="자산">{detailPlan.assetName || '-'}</Descriptions.Item>
              <Descriptions.Item label="위험 점수">
                <Tag color={RISK_LEVELS.find((l) => l.value === detailPlan.riskLevel)?.color}>
                  {detailPlan.riskScore ?? '-'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="위협">{detailPlan.threatName || '-'}</Descriptions.Item>
              <Descriptions.Item label="취약점">{detailPlan.vulnerabilityName || '-'}</Descriptions.Item>
              <Descriptions.Item label="처리 전략">
                {renderStrategyTag(detailPlan.strategy)}
              </Descriptions.Item>
              <Descriptions.Item label="상태">
                {renderStatusTag(detailPlan.status)}
              </Descriptions.Item>
              <Descriptions.Item label="담당자">{detailPlan.assigneeName || '-'}</Descriptions.Item>
              <Descriptions.Item label="기한">
                {detailPlan.dueDate ? dayjs(detailPlan.dueDate).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="예산" span={2}>
                {detailPlan.budget
                  ? `${detailPlan.budget.toLocaleString()}원`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="설명" span={2}>
                {detailPlan.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="잔여 위험">
                {detailPlan.latestResidualRisk ?? '없음'}
              </Descriptions.Item>
              <Descriptions.Item label="조치 횟수">
                {detailPlan.actionCount}회
              </Descriptions.Item>
            </Descriptions>

            {/* 위험 감소 시각화 */}
            {detailPlan.riskScore && detailPlan.latestResidualRisk !== null && (
              <Card size="small" title="위험 감소 현황" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>원래 위험</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
                      {detailPlan.riskScore}
                    </div>
                  </div>
                  <div style={{ fontSize: 24, color: '#8c8c8c' }}>→</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>잔여 위험</div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                      {detailPlan.latestResidualRisk}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Progress
                      percent={Math.round(
                        ((detailPlan.riskScore - detailPlan.latestResidualRisk) /
                          detailPlan.riskScore) *
                          100
                      )}
                      strokeColor="#52c41a"
                      format={(pct) => `${pct}% 감소`}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 조치 이력 */}
            <Card
              size="small"
              title={
                <Space>
                  <HistoryOutlined />
                  <span>조치 이력</span>
                </Space>
              }
            >
              {detailActions.length > 0 ? (
                <Timeline
                  items={detailActions.map((action) => ({
                    color: action.residualRiskScore ? 'green' : 'blue',
                    children: (
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>
                          {action.actionDescription}
                        </div>
                        {action.result && (
                          <div style={{ fontSize: 12, color: '#595959', marginBottom: 2 }}>
                            결과: {action.result}
                          </div>
                        )}
                        {action.residualRiskScore !== null && (
                          <div style={{ fontSize: 12 }}>
                            잔여 위험: <Tag>{action.residualRiskScore}</Tag>
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                          {action.completerName && `${action.completerName} · `}
                          {action.completedAt
                            ? dayjs(action.completedAt).format('YYYY-MM-DD HH:mm')
                            : dayjs(action.createdAt).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Empty description="등록된 조치가 없습니다" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </>
        ) : (
          <Empty description="데이터를 불러올 수 없습니다" />
        )}
      </Modal>
      {/* 처리 계획 생성 모달 */}
      <Modal
        title="처리 계획 생성"
        open={createModalVisible}
        onOk={handleCreateSave}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        okText="생성"
        cancelText="취소"
        confirmLoading={createLoading}
        width={600}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="scenarioId"
            label="위험 시나리오"
            rules={[{ required: true, message: '시나리오를 선택해주세요' }]}
          >
            <Select
              placeholder="시나리오 선택"
              showSearch
              optionFilterProp="children"
              onChange={handleScenarioChange}
            >
              {scenarios.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="assessmentId"
            label="위험 평가 (처리 계획 미등록 건)"
            rules={[{ required: true, message: '위험 평가를 선택해주세요' }]}
          >
            <Select
              placeholder={assessmentsForCreate.length === 0 ? '시나리오를 먼저 선택하세요' : '위험 평가 선택'}
              loading={assessmentsLoading}
              disabled={assessmentsForCreate.length === 0 && !assessmentsLoading}
              showSearch
              optionFilterProp="children"
            >
              {assessmentsForCreate.map((a) => (
                <Option key={a.id} value={a.id}>
                  {a.assetName || '자산 없음'} - {a.threatName || '위협 없음'} / {a.vulnerabilityName || '취약점 없음'} (DoR: {a.riskScore ?? '-'})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="strategy"
            label="처리 전략"
            rules={[{ required: true, message: '처리 전략을 선택해주세요' }]}
          >
            <Select placeholder="전략 선택">
              {TREATMENT_STRATEGIES.map((s) => (
                <Option key={s.value} value={s.value}>
                  <Space>
                    {strategyIcons[s.value as TreatmentStrategy]}
                    <span>{s.label}</span>
                    <span style={{ fontSize: 12, color: '#8c8c8c' }}>- {s.description}</span>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="assigneeId" label="담당자">
            <Select placeholder="담당자 선택" allowClear showSearch optionFilterProp="children">
              {personnelList.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.name}{p.position ? ` (${p.position})` : ''}{p.departmentName ? ` - ${p.departmentName}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} placeholder="처리 계획 설명" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dueDate" label="기한">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="budget" label="예산 (원)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  }
                  parser={(value) => (value?.replace(/,/g, '') || '0') as unknown as 0}
                  placeholder="예산"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default RiskTreatmentPage
