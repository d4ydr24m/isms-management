/**
 * DoA(Degree of Acceptance) 설정 페이지
 * FR-604: 허용 가능 위험 수준 설정 및 이력 관리
 *
 * 기능:
 * - 현재 DoA 임계값 조회 및 변경
 * - DoA 변경 이력 타임라인
 * - DoA 초과 위험 목록
 * - 위험 점수 범위 시각 가이드 (1~27)
 */
import { useState, useEffect, useCallback } from 'react'
import {
  App,
  Card,
  Button,
  Space,
  Table,
  Modal,
  Form,
  Tag,
  Tooltip,
  Input,
  Statistic,
  Row,
  Col,
  Alert,
  Slider,
  DatePicker,
  Timeline,
  Descriptions,
  Badge,
  Empty,
} from 'antd'
import {
  SettingOutlined,
  HistoryOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import type { TableProps } from 'antd'
import dayjs from 'dayjs'
import {
  getCurrentDoA,
  createDoAConfig,
  getDoAHistory,
  getRisksExceedingDoA,
} from '@/services/risks'
import type {
  DoAConfig,
  DoAConfigCreate,
  DoAHistory,
  RiskAssessment,
} from '@/types'
import { RISK_LEVELS } from '@/types/risk'

// 위험 점수별 색상
const getScoreColor = (score: number): string => {
  if (score <= 8) return '#52c41a'
  if (score <= 17) return '#faad14'
  return '#ff4d4f'
}

const getScoreLabel = (score: number): string => {
  if (score <= 8) return '저위험'
  if (score <= 17) return '중위험'
  return '고위험'
}

// 슬라이더 마크
const sliderMarks: Record<number, { style: React.CSSProperties; label: string }> = {
  1: { style: { color: '#52c41a' }, label: '1' },
  8: { style: { color: '#52c41a' }, label: '8' },
  9: { style: { color: '#faad14' }, label: '9' },
  17: { style: { color: '#faad14' }, label: '17' },
  18: { style: { color: '#ff4d4f' }, label: '18' },
  27: { style: { color: '#ff4d4f' }, label: '27' },
}

const DoASettingsPage = () => {
  const { message } = App.useApp()
  // 상태 관리
  const [currentDoA, setCurrentDoA] = useState<DoAConfig | null>(null)
  const [history, setHistory] = useState<DoAHistory[]>([])
  const [exceedingRisks, setExceedingRisks] = useState<RiskAssessment[]>([])
  const [exceedingTotal, setExceedingTotal] = useState(0)
  const [exceedingPage, setExceedingPage] = useState(1)
  const [exceedingPageSize, setExceedingPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [exceedingLoading, setExceedingLoading] = useState(false)

  // 모달 상태
  const [modalVisible, setModalVisible] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [form] = Form.useForm()
  const [previewThreshold, setPreviewThreshold] = useState<number>(9)

  // 현재 DoA 조회
  const fetchCurrentDoA = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCurrentDoA()
      setCurrentDoA(data)
    } catch {
      // DoA 설정이 아직 없을 수 있음
      setCurrentDoA(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // 변경 이력 조회
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await getDoAHistory()
      setHistory(data)
    } catch {
      console.warn('DoA 이력을 불러올 수 없습니다')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // DoA 초과 위험 조회
  const fetchExceedingRisks = useCallback(async (page: number, size: number) => {
    setExceedingLoading(true)
    try {
      const data = await getRisksExceedingDoA({ page, size })
      setExceedingRisks(data.items)
      setExceedingTotal(data.total)
    } catch {
      console.warn('DoA 초과 위험 목록을 불러올 수 없습니다')
    } finally {
      setExceedingLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCurrentDoA()
    fetchHistory()
  }, [fetchCurrentDoA, fetchHistory])

  useEffect(() => {
    fetchExceedingRisks(exceedingPage, exceedingPageSize)
  }, [fetchExceedingRisks, exceedingPage, exceedingPageSize])

  // DoA 설정 변경 모달 열기
  const handleOpenModal = () => {
    const initialValue = currentDoA?.thresholdValue ?? 9
    form.setFieldsValue({
      thresholdValue: initialValue,
      effectiveDate: dayjs(),
      remarks: '',
    })
    setPreviewThreshold(initialValue)
    setModalVisible(true)
  }

  // DoA 설정 저장
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setModalLoading(true)

      const data: DoAConfigCreate = {
        thresholdValue: values.thresholdValue,
        effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : null,
        remarks: values.remarks || null,
      }

      await createDoAConfig(data)
      message.success('DoA 설정이 변경되었습니다')
      setModalVisible(false)
      form.resetFields()

      // 데이터 갱신
      fetchCurrentDoA()
      fetchHistory()
      setExceedingPage(1)
      fetchExceedingRisks(1, exceedingPageSize)
    } catch {
      // 폼 검증 에러는 자동 표시
    } finally {
      setModalLoading(false)
    }
  }

  // DoA 초과 위험 테이블 컬럼
  const exceedingColumns: TableProps<RiskAssessment>['columns'] = [
    {
      title: '자산',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 180,
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
      title: '위험 점수',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.riskScore ?? 0) - (b.riskScore ?? 0),
      render: (score: number | null) => {
        if (score === null) return '-'
        return (
          <Tag color={getScoreColor(score)} style={{ fontWeight: 'bold' }}>
            {score}
          </Tag>
        )
      },
    },
    {
      title: '위험 등급',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      align: 'center',
      render: (level: string | null) => {
        if (!level) return '-'
        const config = RISK_LEVELS.find((l) => l.value === level)
        return config ? <Tag color={config.color}>{config.label}</Tag> : level
      },
    },
    {
      title: '처리 계획',
      dataIndex: 'hasTreatmentPlan',
      key: 'hasTreatmentPlan',
      width: 100,
      align: 'center',
      render: (hasPlan: boolean) =>
        hasPlan ? (
          <Badge status="success" text="있음" />
        ) : (
          <Badge status="error" text="없음" />
        ),
    },
  ]

  return (
    <div>
      {/* 현재 DoA 설정 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>DoA (허용 가능 위험 수준) 설정</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<SettingOutlined />} onClick={handleOpenModal}>
            DoA 변경
          </Button>
        }
        loading={loading}
        style={{ marginBottom: 16 }}
      >
        {currentDoA ? (
          <>
            <Row gutter={24}>
              <Col span={6}>
                <Statistic
                  title="현재 임계값"
                  value={currentDoA.thresholdValue}
                  suffix="/ 27"
                  valueStyle={{
                    color: getScoreColor(currentDoA.thresholdValue),
                    fontSize: 36,
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="위험 등급 기준"
                  value={getScoreLabel(currentDoA.thresholdValue)}
                  valueStyle={{
                    color: getScoreColor(currentDoA.thresholdValue),
                    fontSize: 20,
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="DoA 초과 위험"
                  value={exceedingTotal}
                  suffix="건"
                  valueStyle={{
                    color: exceedingTotal > 0 ? '#ff4d4f' : '#52c41a',
                    fontSize: 20,
                  }}
                  prefix={exceedingTotal > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="적용 상태"
                  value={currentDoA.isActive ? '활성' : '비활성'}
                  valueStyle={{
                    color: currentDoA.isActive ? '#52c41a' : '#8c8c8c',
                    fontSize: 20,
                  }}
                />
              </Col>
            </Row>

            <Descriptions
              bordered
              size="small"
              column={2}
              style={{ marginTop: 24 }}
            >
              <Descriptions.Item label="시행일">
                {currentDoA.effectiveDate}
              </Descriptions.Item>
              <Descriptions.Item label="만료일">
                {currentDoA.expiryDate || '없음 (무기한)'}
              </Descriptions.Item>
              <Descriptions.Item label="승인자">
                {currentDoA.approverName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="승인일">
                {currentDoA.approvalDate || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="비고" span={2}>
                {currentDoA.remarks || '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 위험 점수 범위 가이드 */}
            <div style={{ marginTop: 24 }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 13 }}>
                위험 점수 범위 (DoR = 자산가치 × 위협등급 × 취약점등급)
              </div>
              <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
                {/* 저위험 구간 */}
                <Tooltip title="저위험: 1~8">
                  <div
                    style={{
                      width: `${(8 / 27) * 100}%`,
                      backgroundColor: '#52c41a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  >
                    저위험 (1~8)
                  </div>
                </Tooltip>
                {/* 중위험 구간 */}
                <Tooltip title="중위험: 9~17">
                  <div
                    style={{
                      width: `${(9 / 27) * 100}%`,
                      backgroundColor: '#faad14',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  >
                    중위험 (9~17)
                  </div>
                </Tooltip>
                {/* 고위험 구간 */}
                <Tooltip title="고위험: 18~27">
                  <div
                    style={{
                      width: `${(10 / 27) * 100}%`,
                      backgroundColor: '#ff4d4f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  >
                    고위험 (18~27)
                  </div>
                </Tooltip>
              </div>
              {/* DoA 임계값 마커 */}
              <div style={{ position: 'relative', height: 20, marginTop: 4 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${((currentDoA.thresholdValue - 0.5) / 27) * 100}%`,
                    transform: 'translateX(-50%)',
                    fontSize: 11,
                    color: '#ff4d4f',
                    fontWeight: 'bold',
                  }}
                >
                  ▲ DoA={currentDoA.thresholdValue}
                </div>
              </div>
            </div>
          </>
        ) : (
          <Empty description="DoA 설정이 없습니다. 새로운 DoA를 설정해주세요." />
        )}
      </Card>

      <Row gutter={16}>
        {/* DoA 초과 위험 목록 */}
        <Col span={14}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                <span>DoA 초과 위험 목록</span>
                {exceedingTotal > 0 && (
                  <Tag color="error">{exceedingTotal}건</Tag>
                )}
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {exceedingTotal > 0 && (
              <Alert
                message={`${exceedingTotal}건의 위험이 DoA 임계값(${currentDoA?.thresholdValue ?? '-'})을 초과하고 있습니다.`}
                description="즉시 위험 처리 계획을 수립하여 잔여 위험을 허용 수준 이하로 낮춰야 합니다."
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Table
              columns={exceedingColumns}
              dataSource={exceedingRisks}
              loading={exceedingLoading}
              rowKey="id"
              size="small"
              pagination={{
                current: exceedingPage,
                total: exceedingTotal,
                pageSize: exceedingPageSize,
                showTotal: (total) => `총 ${total}건`,
                onChange: (page, pageSize) => {
                  setExceedingPage(page)
                  setExceedingPageSize(pageSize)
                },
              }}
            />
          </Card>
        </Col>

        {/* DoA 변경 이력 */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>DoA 변경 이력</span>
              </Space>
            }
            loading={historyLoading}
            style={{ marginBottom: 16 }}
          >
            {history.length > 0 ? (
              <Timeline
                items={history.map((item) => ({
                  color: item.newThreshold > (item.oldThreshold ?? 0) ? 'green' : 'red',
                  children: (
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        {item.oldThreshold !== null ? (
                          <Space>
                            <span>{item.oldThreshold}</span>
                            <span>→</span>
                            <span style={{ color: getScoreColor(item.newThreshold) }}>
                              {item.newThreshold}
                            </span>
                            {item.newThreshold > item.oldThreshold ? (
                              <ArrowUpOutlined style={{ color: '#52c41a' }} />
                            ) : (
                              <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                            )}
                          </Space>
                        ) : (
                          <span>
                            초기 설정:{' '}
                            <span style={{ color: getScoreColor(item.newThreshold) }}>
                              {item.newThreshold}
                            </span>
                          </span>
                        )}
                      </div>
                      {item.changeReason && (
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>
                          사유: {item.changeReason}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {item.changerName && `${item.changerName} · `}
                        {dayjs(item.changedAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty description="변경 이력이 없습니다" />
            )}
          </Card>
        </Col>
      </Row>

      {/* DoA 설정 변경 모달 */}
      <Modal
        title="DoA 임계값 변경"
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        okText="저장"
        cancelText="취소"
        confirmLoading={modalLoading}
        width={600}
      >
        <Alert
          message="DoA(Degree of Acceptance)란?"
          description="조직이 허용할 수 있는 위험 수준의 임계값입니다. 이 값을 초과하는 위험은 반드시 처리 계획을 수립해야 합니다."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical">
          <Form.Item
            name="thresholdValue"
            label="DoA 임계값"
            rules={[{ required: true, message: '임계값을 설정해주세요' }]}
          >
            <Slider
              min={1}
              max={27}
              marks={sliderMarks}
              tooltip={{
                formatter: (value) =>
                  value ? `${value} (${getScoreLabel(value)})` : '',
              }}
              onChange={(value) => setPreviewThreshold(value)}
              styles={{
                track: { background: getScoreColor(previewThreshold) },
              }}
            />
          </Form.Item>

          {/* 미리보기 */}
          <div
            style={{
              textAlign: 'center',
              padding: '12px 0',
              marginBottom: 16,
              borderRadius: 8,
              backgroundColor: '#fafafa',
            }}
          >
            <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>
              설정 임계값
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 'bold',
                color: getScoreColor(previewThreshold),
              }}
            >
              {previewThreshold}
            </div>
            <div style={{ fontSize: 13, color: getScoreColor(previewThreshold) }}>
              {getScoreLabel(previewThreshold)} 이하 허용
            </div>
            {currentDoA && previewThreshold !== currentDoA.thresholdValue && (
              <div style={{ fontSize: 12, marginTop: 8 }}>
                <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 4 }} />
                현재 {currentDoA.thresholdValue}에서{' '}
                {previewThreshold > currentDoA.thresholdValue ? (
                  <span style={{ color: '#52c41a' }}>상향 (+{previewThreshold - currentDoA.thresholdValue})</span>
                ) : (
                  <span style={{ color: '#ff4d4f' }}>하향 ({previewThreshold - currentDoA.thresholdValue})</span>
                )}
              </div>
            )}
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="effectiveDate"
                label="시행일"
                rules={[{ required: true, message: '시행일을 선택해주세요' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiryDate" label="만료일">
                <DatePicker style={{ width: '100%' }} placeholder="없음 (무기한)" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="변경 사유">
            <Input.TextArea rows={3} placeholder="DoA 변경 사유를 입력해주세요" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DoASettingsPage
