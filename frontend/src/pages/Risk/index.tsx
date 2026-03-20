/**
 * 위험 시나리오 목록 페이지
 * FR-703: 위험 시나리오 관리
 *
 * 기능:
 * - 시나리오 목록 조회, 검색, 상태 필터
 * - 시나리오 CRUD (추가/수정/삭제)
 * - 시나리오 비교 (2개 선택)
 * - 평가 현황 요약 (총 건수, 고위험, DoA 초과)
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
  DatePicker,
  Badge,
  Descriptions,
  Statistic,
  Row,
  Col,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import {
  getRiskScenarios,
  createRiskScenario,
  updateRiskScenario,
  deleteRiskScenario,
  compareRiskScenarios,
} from '@/services/risks'
import type {
  RiskScenario,
  RiskScenarioCreate,
  RiskScenarioUpdate,
  RiskScenarioStatus,
  ScenarioComparison,
} from '@/types'

const { Search } = Input

interface RiskScenarioFilterParams {
  search?: string
  status?: RiskScenarioStatus
}

// 상태 옵션
const STATUS_OPTIONS: Array<{ value: RiskScenarioStatus; label: string; color: string }> = [
  { value: 'draft', label: '초안', color: 'default' },
  { value: 'in_progress', label: '진행중', color: 'processing' },
  { value: 'completed', label: '완료', color: 'success' },
  { value: 'cancelled', label: '취소', color: 'error' },
]

const RiskIndexPage = () => {
  const navigate = useNavigate()
  const [scenarios, setScenarios] = useState<RiskScenario[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [filters, setFilters] = useState<RiskScenarioFilterParams>({
    search: '',
    status: undefined,
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingScenario, setEditingScenario] = useState<RiskScenario | null>(null)
  const [form] = Form.useForm()

  // 비교 관련 상태
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [compareModalVisible, setCompareModalVisible] = useState(false)
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  // 시나리오 목록 조회
  const fetchScenarios = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getRiskScenarios({
        page: pagination.current,
        size: pagination.pageSize,
        search: filters.search || undefined,
        status: filters.status,
      })
      setScenarios(response.items)
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }))
    } catch {
      message.error('시나리오 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters])

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  // 테이블 변경 핸들러
  const handleTableChange: TableProps<RiskScenario>['onChange'] = (paginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 10,
    }))
  }

  // 검색 핸들러
  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 상태 필터 핸들러
  const handleStatusChange = (value?: RiskScenarioStatus) => {
    setFilters((prev) => ({ ...prev, status: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 시나리오 추가 버튼 핸들러
  const handleAddClick = () => {
    setModalMode('create')
    setEditingScenario(null)
    form.resetFields()
    setModalVisible(true)
  }

  // 시나리오 수정 버튼 핸들러
  const handleEditClick = (scenario: RiskScenario) => {
    setModalMode('edit')
    setEditingScenario(scenario)
    form.setFieldsValue({
      name: scenario.name,
      description: scenario.description,
      start_date: scenario.start_date ? dayjs(scenario.start_date) : undefined,
      end_date: scenario.end_date ? dayjs(scenario.end_date) : undefined,
      status: scenario.status,
    })
    setModalVisible(true)
  }

  // 시나리오 삭제 핸들러
  const handleDeleteClick = (scenario: RiskScenario) => {
    Modal.confirm({
      title: '시나리오 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 시나리오를 삭제하시겠습니까? 삭제된 시나리오는 복구할 수 없습니다.',
      okText: '확인',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await deleteRiskScenario(scenario.id)
          message.success('시나리오가 삭제되었습니다')
          fetchScenarios()
        } catch {
          message.error('시나리오 삭제에 실패했습니다')
        }
      },
    })
  }

  // 모달 제출 핸들러
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      if (modalMode === 'create') {
        const data: RiskScenarioCreate = {
          name: values.name,
          description: values.description || null,
          start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : '',
          end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
        }
        await createRiskScenario(data)
        message.success('시나리오가 추가되었습니다')
      } else if (editingScenario) {
        const data: RiskScenarioUpdate = {
          name: values.name,
          description: values.description || null,
          start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
          end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
          status: values.status,
        }
        await updateRiskScenario(editingScenario.id, data)
        message.success('시나리오가 수정되었습니다')
      }

      setModalVisible(false)
      form.resetFields()
      fetchScenarios()
    } catch {
      // 폼 검증 에러는 자동으로 표시됨
    }
  }

  // 모달 취소 핸들러
  const handleModalCancel = () => {
    setModalVisible(false)
    form.resetFields()
    setEditingScenario(null)
  }

  // 시나리오 비교 핸들러
  const handleCompare = async () => {
    if (selectedRowKeys.length !== 2) {
      message.warning('비교할 시나리오 2개를 선택해주세요')
      return
    }
    setCompareLoading(true)
    setCompareModalVisible(true)
    try {
      const result = await compareRiskScenarios(
        selectedRowKeys[0] as number,
        selectedRowKeys[1] as number
      )
      setComparison(result)
    } catch {
      message.error('시나리오 비교에 실패했습니다')
    } finally {
      setCompareLoading(false)
    }
  }

  // 비교 차이 표시 헬퍼
  const renderDiff = (value: number, label: string) => {
    if (value > 0) {
      return (
        <Statistic
          title={label}
          value={value}
          prefix={<ArrowUpOutlined />}
          valueStyle={{ color: '#cf1322' }}
          suffix="증가"
        />
      )
    }
    if (value < 0) {
      return (
        <Statistic
          title={label}
          value={Math.abs(value)}
          prefix={<ArrowDownOutlined />}
          valueStyle={{ color: '#3f8600' }}
          suffix="감소"
        />
      )
    }
    return (
      <Statistic
        title={label}
        value={0}
        prefix={<MinusOutlined />}
        suffix="변화 없음"
      />
    )
  }

  // 평가 수행 버튼 핸들러
  const handleAssessClick = (scenario: RiskScenario) => {
    navigate(`/risk/scenarios/${scenario.id}/assessment`)
  }

  // 상태 태그 표시 함수
  const getStatusTag = (status: RiskScenarioStatus) => {
    const config = STATUS_OPTIONS.find((s) => s.value === status)
    if (!config) return null

    return (
      <Tag color={config.color} style={{ margin: 0 }}>
        {config.label}
      </Tag>
    )
  }

  // 평가 현황 표시 함수
  const renderAssessmentStatus = (scenario: RiskScenario) => {
    const { assessment_count, high_risk_count, exceeding_doa_count } = scenario

    return (
      <Space direction="vertical" size={0}>
        <span>총 {assessment_count}건</span>
        {high_risk_count > 0 && (
          <Badge status="error" text={`고위험 ${high_risk_count}건`} />
        )}
        {exceeding_doa_count > 0 && (
          <Badge status="warning" text={`DoA초과 ${exceeding_doa_count}건`} />
        )}
      </Space>
    )
  }

  // 테이블 행 선택 설정
  const rowSelection: TableProps<RiskScenario>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({
      disabled: record.assessment_count === 0,
    }),
  }

  // 테이블 컬럼 정의
  const columns: TableProps<RiskScenario>['columns'] = [
    {
      title: '시나리오명',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: RiskScenario) => (
        <Link to={`/risk/scenarios/${record.id}`}>{name}</Link>
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 250,
      render: (_: unknown, record: RiskScenario) => {
        const startDate = dayjs(record.start_date).format('YYYY-MM-DD')
        const endDate = record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '진행중'
        return `${startDate} ~ ${endDate}`
      },
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: RiskScenarioStatus) => getStatusTag(status),
    },
    {
      title: '평가 현황',
      key: 'assessment_status',
      width: 200,
      render: (_: unknown, record: RiskScenario) => renderAssessmentStatus(record),
    },
    {
      title: '작업',
      key: 'actions',
      width: 280,
      align: 'center',
      render: (_: unknown, record: RiskScenario) => (
        <Space>
          <Tooltip title="상세 보기">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/risk/scenarios/${record.id}`)}
            >
              상세
            </Button>
          </Tooltip>
          <Tooltip
            title={
              record.status === 'completed'
                ? '완료된 시나리오는 수정할 수 없습니다'
                : record.status === 'cancelled'
                  ? '취소된 시나리오는 수정할 수 없습니다'
                  : ''
            }
          >
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              disabled={record.status === 'completed' || record.status === 'cancelled'}
            >
              수정
            </Button>
          </Tooltip>
          <Tooltip title={record.status !== 'draft' ? '초안 상태만 삭제할 수 있습니다' : ''}>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteClick(record)}
              disabled={record.status !== 'draft'}
            >
              삭제
            </Button>
          </Tooltip>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleAssessClick(record)}
            disabled={record.status === 'completed' || record.status === 'cancelled'}
          >
            평가
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="위험 시나리오 관리"
        extra={
          <Space>
            <Tooltip title={selectedRowKeys.length !== 2 ? '비교할 시나리오 2개를 선택해주세요' : ''}>
              <Button
                icon={<SwapOutlined />}
                onClick={handleCompare}
                disabled={selectedRowKeys.length !== 2}
              >
                시나리오 비교
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
              시나리오 추가
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 필터 영역 */}
          <Space wrap>
            <Search
              placeholder="시나리오 검색"
              allowClear
              style={{ width: 300 }}
              onSearch={handleSearch}
              onChange={(e) => !e.target.value && handleSearch('')}
            />
            <Select
              placeholder="상태"
              style={{ width: 150 }}
              allowClear
              onChange={handleStatusChange}
              aria-label="상태"
            >
              {STATUS_OPTIONS.map((status) => (
                <Select.Option key={status.value} value={status.value}>
                  {status.label}
                </Select.Option>
              ))}
            </Select>
          </Space>

          {/* 테이블 */}
          <Table
            columns={columns}
            dataSource={scenarios}
            loading={loading}
            rowKey="id"
            rowSelection={rowSelection}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`,
            }}
            onChange={handleTableChange}
          />
        </Space>
      </Card>

      {/* 추가/수정 모달 */}
      <Modal
        title={modalMode === 'create' ? '시나리오 추가' : '시나리오 수정'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="확인"
        cancelText="취소"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="시나리오명"
            rules={[{ required: true, message: '시나리오명을 입력해주세요' }]}
          >
            <Input placeholder="예: 2025년 1분기 위험 평가" />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <Input.TextArea rows={4} placeholder="시나리오 설명" />
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

          {modalMode === 'edit' && (
            <Form.Item name="status" label="상태">
              <Select placeholder="상태 선택">
                {STATUS_OPTIONS.map((status) => (
                  <Select.Option key={status.value} value={status.value}>
                    {status.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 비교 모달 */}
      <Modal
        title="시나리오 비교"
        open={compareModalVisible}
        onCancel={() => {
          setCompareModalVisible(false)
          setComparison(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setCompareModalVisible(false)
            setComparison(null)
          }}>
            닫기
          </Button>,
        ]}
        width={700}
        loading={compareLoading}
      >
        {comparison && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="시나리오 A" span={1}>
                <strong>{comparison.scenario1_name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="시나리오 B" span={1}>
                <strong>{comparison.scenario2_name}</strong>
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16}>
              <Col span={8}>
                {renderDiff(comparison.risk_count_diff, '총 위험 건수 변화')}
              </Col>
              <Col span={8}>
                {renderDiff(comparison.high_risk_diff, '고위험 건수 변화')}
              </Col>
              <Col span={8}>
                <Statistic
                  title="평균 위험점수 변화"
                  value={Math.abs(comparison.avg_risk_score_diff)}
                  precision={1}
                  prefix={
                    comparison.avg_risk_score_diff > 0 ? (
                      <ArrowUpOutlined />
                    ) : comparison.avg_risk_score_diff < 0 ? (
                      <ArrowDownOutlined />
                    ) : (
                      <MinusOutlined />
                    )
                  }
                  valueStyle={{
                    color:
                      comparison.avg_risk_score_diff > 0
                        ? '#cf1322'
                        : comparison.avg_risk_score_diff < 0
                          ? '#3f8600'
                          : undefined,
                  }}
                  suffix={
                    comparison.avg_risk_score_diff > 0
                      ? '증가'
                      : comparison.avg_risk_score_diff < 0
                        ? '감소'
                        : '동일'
                  }
                />
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default RiskIndexPage
