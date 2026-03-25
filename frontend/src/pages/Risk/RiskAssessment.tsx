/**
 * 위험 평가 수행 페이지
 * FR-703: 위험 평가 수행
 *
 * 기능:
 * - 자산-위협-취약점 3-way 매핑
 * - 위험도(DoR) 자동 계산 및 표시
 * - DoA 초과 위험 하이라이트
 * - 대량 평가 생성
 * - 평가 수정/삭제
 * - 위험 매트릭스 히트맵 시각화
 * - 위험 분포 차트
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Select,
  Checkbox,
  message,
  Modal,
  Form,
  Tag,
  Badge,
  Tooltip,
  Input,
  Statistic,
  Row,
  Col,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import type { TableProps } from 'antd'
import {
  getRiskScenario,
  getRiskAssessments,
  createRiskAssessment,
  bulkCreateRiskAssessments,
  updateRiskAssessment,
  deleteRiskAssessment,
  getCurrentDoA,
  getRiskMatrixData,
  getRiskDistribution,
} from '@/services/risks'
import { assetService } from '@/services/assets'
import { getThreats, getVulnerabilities } from '@/services/risks'
import RiskMatrix from './components/RiskMatrix'
import RiskDistributionChart from './components/RiskDistributionChart'
import type {
  RiskScenario,
  RiskAssessment,
  RiskAssessmentCreate,
  RiskAssessmentUpdate,
  RiskAssessmentBulkCreate,
  RiskLevel,
  DoAConfig,
  RiskMatrixData,
  RiskDistribution,
  Asset,
  Threat,
  Vulnerability,
} from '@/types'
import { RISK_LEVELS } from '@/types/risk'

const { Option } = Select

interface RiskAssessmentFilterParams {
  assetId?: number
  riskLevel?: RiskLevel
  exceedsDoa?: boolean
}

const RiskAssessmentPage = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  // 상태 관리
  const [scenario, setScenario] = useState<RiskScenario | null>(null)
  const [assessments, setAssessments] = useState<RiskAssessment[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [filters, setFilters] = useState<RiskAssessmentFilterParams>({})
  const [doaConfig, setDoaConfig] = useState<DoAConfig | null>(null)

  // 시각화 데이터
  const [matrixData, setMatrixData] = useState<RiskMatrixData | null>(null)
  const [distributionData, setDistributionData] = useState<RiskDistribution | null>(null)
  const [matrixLoading, setMatrixLoading] = useState(false)

  // 선택 데이터
  const [assets, setAssets] = useState<Asset[]>([])
  const [threats, setThreats] = useState<Threat[]>([])
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([])

  // 모달 상태
  const [modalVisible, setModalVisible] = useState(false)
  const [bulkModalVisible, setBulkModalVisible] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingAssessment, setEditingAssessment] = useState<RiskAssessment | null>(null)
  const [form] = Form.useForm()
  const [bulkForm] = Form.useForm()

  // 시나리오 정보 조회
  const fetchScenario = useCallback(async () => {
    if (!scenarioId) return

    try {
      const data = await getRiskScenario(parseInt(scenarioId))
      setScenario(data)
    } catch {
      message.error('시나리오를 찾을 수 없습니다')
    }
  }, [scenarioId])

  // 평가 목록 조회
  const fetchAssessments = useCallback(async () => {
    if (!scenarioId) return

    setLoading(true)
    try {
      const response = await getRiskAssessments(parseInt(scenarioId), {
        page: pagination.current,
        size: pagination.pageSize,
        ...filters,
      })
      setAssessments(response.items)
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }))
    } catch {
      message.error('평가 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [scenarioId, pagination.current, pagination.pageSize, filters])

  // DoA 설정 조회
  const fetchDoA = useCallback(async () => {
    try {
      const data = await getCurrentDoA()
      setDoaConfig(data)
    } catch {
      // DoA 설정이 없을 수도 있음
      console.warn('DoA 설정을 불러올 수 없습니다')
    }
  }, [])

  // 자산, 위협, 취약점 목록 조회
  const fetchSelectOptions = useCallback(async () => {
    try {
      const [assetsData, threatsData, vulnerabilitiesData] = await Promise.all([
        assetService.getAssets({ pageSize: 500 }),
        getThreats(),
        getVulnerabilities(),
      ])
      setAssets((assetsData.items || []).filter((a: any) => a.status !== '폐기'))
      setThreats(threatsData.items || [])
      setVulnerabilities(vulnerabilitiesData.items || [])
    } catch {
      message.error('선택 옵션을 불러오는데 실패했습니다')
    }
  }, [])

  // 매트릭스 및 분포 데이터 조회
  const fetchVisualizationData = useCallback(async () => {
    if (!scenarioId) return

    setMatrixLoading(true)
    try {
      const [matrix, distribution] = await Promise.all([
        getRiskMatrixData(parseInt(scenarioId)),
        getRiskDistribution(parseInt(scenarioId)),
      ])
      setMatrixData(matrix)
      setDistributionData(distribution)
    } catch {
      // 시각화 데이터 실패 시 테이블은 유지
      console.warn('시각화 데이터를 불러올 수 없습니다')
    } finally {
      setMatrixLoading(false)
    }
  }, [scenarioId])

  useEffect(() => {
    fetchScenario()
    fetchDoA()
    fetchSelectOptions()
    fetchVisualizationData()
  }, [fetchScenario, fetchDoA, fetchSelectOptions, fetchVisualizationData])

  useEffect(() => {
    fetchAssessments()
  }, [fetchAssessments])

  // 테이블 변경 핸들러
  const handleTableChange: TableProps<RiskAssessment>['onChange'] = (paginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 10,
    }))
  }

  // 필터 핸들러
  const handleAssetFilterChange = (value?: number) => {
    setFilters((prev) => ({ ...prev, assetId: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleRiskLevelFilterChange = (value?: RiskLevel) => {
    setFilters((prev) => ({ ...prev, riskLevel: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  const handleDoAFilterChange = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, exceedsDoa: checked ? true : undefined }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 평가 추가 버튼 핸들러
  const handleAddClick = () => {
    setModalMode('create')
    setEditingAssessment(null)
    form.resetFields()
    setModalVisible(true)
  }

  // 평가 수정 버튼 핸들러
  const handleEditClick = (assessment: RiskAssessment) => {
    setModalMode('edit')
    setEditingAssessment(assessment)
    form.setFieldsValue({
      assetId: assessment.assetId,
      threatId: assessment.threatId,
      vulnerabilityId: assessment.vulnerabilityId,
      assetValue: assessment.assetValue,
      threatLevel: assessment.threatLevel,
      vulnerabilityLevel: assessment.vulnerabilityLevel,
      remarks: assessment.remarks,
    })
    setModalVisible(true)
  }

  // 평가 삭제 핸들러
  const handleDeleteClick = (assessment: RiskAssessment) => {
    Modal.confirm({
      title: '평가 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 평가를 삭제하시겠습니까? 삭제된 평가는 복구할 수 없습니다.',
      okText: '확인',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await deleteRiskAssessment(assessment.id)
          message.success('평가가 삭제되었습니다')
          fetchAssessments()
          fetchVisualizationData()
        } catch {
          message.error('평가 삭제에 실패했습니다')
        }
      },
    })
  }

  // 모달 제출 핸들러
  const handleModalOk = async () => {
    if (!scenarioId) return

    try {
      const values = await form.validateFields()

      if (modalMode === 'create') {
        const data: RiskAssessmentCreate = {
          assetId: values.assetId,
          threatId: values.threatId,
          vulnerabilityId: values.vulnerabilityId,
          assetValue: values.assetValue,
          threatLevel: values.threatLevel,
          vulnerabilityLevel: values.vulnerabilityLevel,
          remarks: values.remarks || null,
        }
        await createRiskAssessment(parseInt(scenarioId), data)
        message.success('평가가 추가되었습니다')
      } else if (editingAssessment) {
        const data: RiskAssessmentUpdate = {
          assetValue: values.assetValue,
          threatLevel: values.threatLevel,
          vulnerabilityLevel: values.vulnerabilityLevel,
          remarks: values.remarks || null,
        }
        await updateRiskAssessment(editingAssessment.id, data)
        message.success('평가가 수정되었습니다')
      }

      setModalVisible(false)
      form.resetFields()
      fetchAssessments()
      fetchVisualizationData()
    } catch (error) {
      // 폼 검증 에러는 자동으로 표시됨
    }
  }

  // 모달 취소 핸들러
  const handleModalCancel = () => {
    setModalVisible(false)
    form.resetFields()
    setEditingAssessment(null)
  }

  // 대량 평가 버튼 핸들러
  const handleBulkClick = () => {
    bulkForm.resetFields()
    setBulkModalVisible(true)
  }

  // 대량 평가 제출 핸들러
  const handleBulkModalOk = async () => {
    if (!scenarioId) return

    try {
      const values = await bulkForm.validateFields()

      const assessments: RiskAssessmentCreate[] = []

      // 선택된 자산, 위협, 취약점 조합으로 평가 생성
      for (const assetId of values.assetIds) {
        for (const threatId of values.threatIds) {
          for (const vulnerabilityId of values.vulnerabilityIds) {
            assessments.push({
              assetId: assetId,
              threatId: threatId,
              vulnerabilityId: vulnerabilityId,
              assetValue: values.assetValue,
              threatLevel: values.threatLevel,
              vulnerabilityLevel: values.vulnerabilityLevel,
              remarks: values.remarks || null,
            })
          }
        }
      }

      const bulkData: RiskAssessmentBulkCreate = { assessments }
      const result = await bulkCreateRiskAssessments(parseInt(scenarioId), bulkData)

      message.success(`${result.count}건의 평가가 생성되었습니다`)
      setBulkModalVisible(false)
      bulkForm.resetFields()
      fetchAssessments()
      fetchVisualizationData()
    } catch (error) {
      // 폼 검증 에러는 자동으로 표시됨
    }
  }

  // 대량 평가 취소 핸들러
  const handleBulkModalCancel = () => {
    setBulkModalVisible(false)
    bulkForm.resetFields()
  }

  // 위험 등급 태그 표시 함수
  const getRiskLevelTag = (level: RiskLevel | null, score: number | null) => {
    if (!level || score === null) return null

    const config = RISK_LEVELS.find((l) => l.value === level)
    if (!config) return null

    return (
      <Tag color={config.color} style={{ margin: 0 }}>
        {score} - {config.label}
      </Tag>
    )
  }

  // DoA 초과 배지 표시 함수
  const renderDoABadge = (exceedsDoA: boolean) => {
    if (!exceedsDoA) return null

    return (
      <Badge
        status="error"
        text="DoA 초과"
        style={{ color: '#ff4d4f', fontWeight: 'bold' }}
      />
    )
  }

  // 테이블 컬럼 정의
  const columns: TableProps<RiskAssessment>['columns'] = [
    {
      title: '자산',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 200,
      render: (name: string, record: RiskAssessment) => (
        <Space direction="vertical" size={0}>
          <span>{name}</span>
          <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.assetCode}</span>
        </Space>
      ),
    },
    {
      title: '위협',
      dataIndex: 'threatName',
      key: 'threatName',
      width: 150,
    },
    {
      title: '취약점',
      dataIndex: 'vulnerabilityName',
      key: 'vulnerabilityName',
      width: 150,
    },
    {
      title: '자산가치',
      dataIndex: 'assetValue',
      key: 'assetValue',
      width: 80,
      align: 'center',
      render: (value: 1 | 2 | 3) => <Tag>{value}</Tag>,
    },
    {
      title: '위협등급',
      dataIndex: 'threatLevel',
      key: 'threatLevel',
      width: 80,
      align: 'center',
      render: (value: 1 | 2 | 3) => <Tag>{value}</Tag>,
    },
    {
      title: '취약점등급',
      dataIndex: 'vulnerabilityLevel',
      key: 'vulnerabilityLevel',
      width: 100,
      align: 'center',
      render: (value: 1 | 2 | 3) => <Tag>{value}</Tag>,
    },
    {
      title: '위험도',
      key: 'riskScore',
      width: 120,
      align: 'center',
      render: (_: unknown, record: RiskAssessment) =>
        getRiskLevelTag(record.riskLevel, record.riskScore),
    },
    {
      title: '상태',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_: unknown, record: RiskAssessment) => renderDoABadge(record.exceedsDoa),
    },
    {
      title: '작업',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_: unknown, record: RiskAssessment) => (
        <Space>
          <Tooltip title="수정">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
            >
              수정
            </Button>
          </Tooltip>
          <Tooltip title="삭제">
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteClick(record)}
            >
              삭제
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  // 통계 계산
  const highRiskCount = assessments.filter((a) => a.riskLevel === 'high').length
  const mediumRiskCount = assessments.filter((a) => a.riskLevel === 'medium').length
  const doaExceedingCount = assessments.filter((a) => a.exceedsDoa).length

  return (
    <div>
      {/* 시나리오 정보 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <h2>{scenario?.name || '위험 평가 수행'}</h2>
            <p style={{ color: '#8c8c8c' }}>{scenario?.description}</p>
          </Col>
          <Col span={12}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="총 평가" value={pagination.total} />
              </Col>
              <Col span={6}>
                <Statistic title="고위험" value={highRiskCount} valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col span={6}>
                <Statistic title="중위험" value={mediumRiskCount} valueStyle={{ color: '#faad14' }} />
              </Col>
              <Col span={6}>
                <Statistic title="DoA 초과" value={doaExceedingCount} valueStyle={{ color: '#ff4d4f' }} />
              </Col>
            </Row>
          </Col>
        </Row>
        {doaConfig && (
          <Alert
            message={`현재 DoA(허용 가능 위험 수준): ${doaConfig.thresholdValue}`}
            description={`${doaConfig.thresholdValue}를 초과하는 위험은 즉시 조치가 필요합니다.`}
            type="info"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 위험 매트릭스 + 분포 차트 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <RiskMatrix
            data={matrixData}
            loading={matrixLoading}
            doaThreshold={doaConfig?.thresholdValue}
            onCellClick={(threatLevel, vulnLevel) => {
              setFilters({
                ...filters,
              })
              message.info(`위협등급 ${threatLevel}, 취약점등급 ${vulnLevel} 필터 적용`)
            }}
          />
        </Col>
        <Col span={12}>
          <RiskDistributionChart
            data={distributionData}
            loading={matrixLoading}
            doaExceedingCount={doaExceedingCount}
          />
        </Col>
      </Row>

      {/* 평가 목록 */}
      <Card
        title="위험 평가 목록"
        extra={
          <Space>
            <Button icon={<ThunderboltOutlined />} onClick={handleBulkClick}>
              대량 평가
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
              평가 추가
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 필터 영역 */}
          <Space wrap>
            <Select
              placeholder="자산"
              style={{ width: 200 }}
              allowClear
              onChange={handleAssetFilterChange}
              aria-label="자산"
            >
              {assets.map((asset) => (
                <Option key={asset.id} value={asset.id}>
                  {asset.name}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="위험 등급"
              style={{ width: 150 }}
              allowClear
              onChange={handleRiskLevelFilterChange}
              aria-label="위험 등급"
            >
              {RISK_LEVELS.map((level) => (
                <Option key={level.value} value={level.value}>
                  {level.label}
                </Option>
              ))}
            </Select>
            <Checkbox onChange={(e) => handleDoAFilterChange(e.target.checked)}>
              DoA 초과만 보기
            </Checkbox>
          </Space>

          {/* 테이블 */}
          <Table
            columns={columns}
            dataSource={assessments}
            loading={loading}
            rowKey="id"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`,
            }}
            onChange={handleTableChange}
            rowClassName={(record) => (record.exceedsDoa ? 'doa-exceeding-row' : '')}
          />
        </Space>
      </Card>

      {/* 평가 추가/수정 모달 */}
      <Modal
        title={modalMode === 'create' ? '위험 평가 추가' : '위험 평가 수정'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="확인"
        cancelText="취소"
        width={600}
      >
        <Form form={form} layout="vertical">
          {modalMode === 'create' && (
            <>
              <Form.Item
                name="assetId"
                label="자산"
                rules={[{ required: true, message: '자산을 선택해주세요' }]}
              >
                <Select placeholder="자산 선택" showSearch optionFilterProp="children">
                  {assets.map((asset) => (
                    <Option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.assetCode})
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="threatId"
                label="위협"
                rules={[{ required: true, message: '위협을 선택해주세요' }]}
              >
                <Select placeholder="위협 선택" showSearch optionFilterProp="children">
                  {threats.map((threat) => (
                    <Option key={threat.id} value={threat.id}>
                      {threat.name} ({threat.code})
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="vulnerabilityId"
                label="취약점"
                rules={[{ required: true, message: '취약점을 선택해주세요' }]}
              >
                <Select placeholder="취약점 선택" showSearch optionFilterProp="children">
                  {vulnerabilities.map((vuln) => (
                    <Option key={vuln.id} value={vuln.id}>
                      {vuln.name} ({vuln.code})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="assetValue"
                label="자산가치"
                rules={[{ required: true, message: '자산가치를 선택해주세요' }]}
              >
                <Select placeholder="선택">
                  <Option value={1}>1 - 하</Option>
                  <Option value={2}>2 - 중</Option>
                  <Option value={3}>3 - 상</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="threatLevel"
                label="위협등급"
                rules={[{ required: true, message: '위협등급을 선택해주세요' }]}
              >
                <Select placeholder="선택">
                  <Option value={1}>1 - 하</Option>
                  <Option value={2}>2 - 중</Option>
                  <Option value={3}>3 - 상</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="vulnerabilityLevel"
                label="취약점등급"
                rules={[{ required: true, message: '취약점등급을 선택해주세요' }]}
              >
                <Select placeholder="선택">
                  <Option value={1}>1 - 하</Option>
                  <Option value={2}>2 - 중</Option>
                  <Option value={3}>3 - 상</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="비고">
            <Input.TextArea rows={4} placeholder="평가 비고" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 대량 평가 생성 모달 */}
      <Modal
        title="대량 위험 평가 생성"
        open={bulkModalVisible}
        onOk={handleBulkModalOk}
        onCancel={handleBulkModalCancel}
        okText="확인"
        cancelText="취소"
        width={700}
      >
        <Alert
          message="선택한 자산, 위협, 취약점의 모든 조합으로 평가를 생성합니다."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={bulkForm} layout="vertical">
          <Form.Item
            name="assetIds"
            label="자산 (복수 선택)"
            rules={[{ required: true, message: '최소 1개 이상의 자산을 선택해주세요' }]}
          >
            <Select mode="multiple" placeholder="자산 선택" showSearch optionFilterProp="children">
              {assets.map((asset) => (
                <Option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.assetCode})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="threatIds"
            label="위협 (복수 선택)"
            rules={[{ required: true, message: '최소 1개 이상의 위협을 선택해주세요' }]}
          >
            <Select mode="multiple" placeholder="위협 선택" showSearch optionFilterProp="children">
              {threats.map((threat) => (
                <Option key={threat.id} value={threat.id}>
                  {threat.name} ({threat.code})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="vulnerabilityIds"
            label="취약점 (복수 선택)"
            rules={[{ required: true, message: '최소 1개 이상의 취약점을 선택해주세요' }]}
          >
            <Select mode="multiple" placeholder="취약점 선택" showSearch optionFilterProp="children">
              {vulnerabilities.map((vuln) => (
                <Option key={vuln.id} value={vuln.id}>
                  {vuln.name} ({vuln.code})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="assetValue"
                label="자산가치"
                rules={[{ required: true, message: '자산가치를 선택해주세요' }]}
              >
                <Select placeholder="선택">
                  <Option value={1}>1 - 하</Option>
                  <Option value={2}>2 - 중</Option>
                  <Option value={3}>3 - 상</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="threatLevel"
                label="위협등급"
                rules={[{ required: true, message: '위협등급을 선택해주세요' }]}
              >
                <Select placeholder="선택">
                  <Option value={1}>1 - 하</Option>
                  <Option value={2}>2 - 중</Option>
                  <Option value={3}>3 - 상</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="vulnerabilityLevel"
                label="취약점등급"
                rules={[{ required: true, message: '취약점등급을 선택해주세요' }]}
              >
                <Select placeholder="선택">
                  <Option value={1}>1 - 하</Option>
                  <Option value={2}>2 - 중</Option>
                  <Option value={3}>3 - 상</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="비고">
            <Input.TextArea rows={4} placeholder="평가 비고 (선택사항)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RiskAssessmentPage
