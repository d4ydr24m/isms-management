import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Progress,
  Popconfirm,
  Radio,
} from 'antd'
import {
  DownloadOutlined,
  SyncOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getSOARecords,
  updateSOARecord,
  generateSOA,
  exportSOA,
} from '@/services/risks'
import type {
  SOARecord,
  SOARecordUpdate,
  SOARecordList,
  SOAExportRequest,
  ImplementationStatus,
} from '@/types/risk'
import {
  IMPLEMENTATION_STATUSES,
  SOA_EXPORT_FORMATS,
  SOA_TEMPLATE_TYPES,
} from '@/types/risk'

const { Title, Text } = Typography
const { TextArea } = Input

const SOAManagement = () => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SOARecordList | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<SOARecord | null>(null)
  const [editForm] = Form.useForm()
  const [exportForm] = Form.useForm()
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)

  // 필터 상태
  const [filterApplicable, setFilterApplicable] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (filterApplicable !== 'all') {
        params.is_applicable = filterApplicable === 'true'
      }
      if (filterStatus !== 'all') {
        params.implementation_status = filterStatus
      }
      const result = await getSOARecords(params)
      setData(result)
    } catch {
      message.error('SOA 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [filterApplicable, filterStatus])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // SOA 자동 생성
  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await generateSOA()
      message.success(`${result.message} (${result.count}건)`)
      fetchData()
    } catch {
      message.error('SOA 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  // SOA 내보내기
  const handleExport = async () => {
    try {
      const values = await exportForm.validateFields()
      setExporting(true)
      const request: SOAExportRequest = {
        format: values.format,
        template_type: values.template_type,
      }
      const result = await exportSOA(request)
      message.success('SOA 내보내기 파일이 생성되었습니다.')
      window.open(result.download_url, '_blank')
      setExportModalOpen(false)
      exportForm.resetFields()
    } catch {
      message.error('SOA 내보내기에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }

  // 편집 모달 열기
  const openEditModal = (record: SOARecord) => {
    setEditingRecord(record)
    editForm.setFieldsValue({
      is_applicable: record.is_applicable,
      exclusion_reason: record.exclusion_reason,
      implementation_status: record.implementation_status,
      implementation_evidence: record.implementation_evidence,
      related_assets: record.related_assets,
      related_risks: record.related_risks,
      remarks: record.remarks,
    })
    setEditModalOpen(true)
  }

  // 편집 저장
  const handleEditSave = async () => {
    if (!editingRecord) return
    try {
      const values = await editForm.validateFields()
      setSaving(true)
      const updateData: SOARecordUpdate = {
        is_applicable: values.is_applicable,
        exclusion_reason: values.is_applicable ? null : values.exclusion_reason,
        implementation_status: values.implementation_status,
        implementation_evidence: values.implementation_evidence,
        related_assets: values.related_assets,
        related_risks: values.related_risks,
        remarks: values.remarks,
      }
      await updateSOARecord(editingRecord.control_item_id, updateData)
      message.success('SOA 레코드가 수정되었습니다.')
      setEditModalOpen(false)
      setEditingRecord(null)
      fetchData()
    } catch {
      message.error('SOA 레코드 수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 구현 상태별 통계 계산
  const getStatusStats = () => {
    if (!data?.items) return {}
    const stats: Record<string, number> = {}
    IMPLEMENTATION_STATUSES.forEach(s => { stats[s.value] = 0 })
    data.items.forEach(item => {
      if (stats[item.implementation_status] !== undefined) {
        stats[item.implementation_status]++
      }
    })
    return stats
  }

  const statusStats = getStatusStats()
  const applicableItems = data?.items.filter(i => i.is_applicable) || []
  const fullyImplementedCount = statusStats['fully_implemented'] || 0
  const implementationRate = applicableItems.length > 0
    ? Math.round((fullyImplementedCount / applicableItems.length) * 100)
    : 0

  // 테이블 컬럼
  const columns: ColumnsType<SOARecord> = [
    {
      title: '통제 코드',
      dataIndex: 'control_code',
      key: 'control_code',
      width: 100,
      fixed: 'left',
      sorter: (a, b) => (a.control_code || '').localeCompare(b.control_code || ''),
    },
    {
      title: '통제 항목',
      dataIndex: 'control_title',
      key: 'control_title',
      width: 250,
      ellipsis: { showTitle: false },
      render: (text: string, record) => (
        <Tooltip title={record.control_description}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '적용 여부',
      dataIndex: 'is_applicable',
      key: 'is_applicable',
      width: 100,
      align: 'center',
      render: (val: boolean) =>
        val ? (
          <Tag icon={<CheckCircleOutlined />} color="success">적용</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">제외</Tag>
        ),
    },
    {
      title: '제외 사유',
      dataIndex: 'exclusion_reason',
      key: 'exclusion_reason',
      width: 180,
      ellipsis: true,
      render: (text: string | null, record) =>
        !record.is_applicable ? (text || '-') : '-',
    },
    {
      title: '구현 상태',
      dataIndex: 'implementation_status',
      key: 'implementation_status',
      width: 120,
      align: 'center',
      render: (status: ImplementationStatus) => {
        const found = IMPLEMENTATION_STATUSES.find(s => s.value === status)
        return found ? (
          <Tag color={found.color}>{found.label}</Tag>
        ) : (
          <Tag>{status}</Tag>
        )
      },
    },
    {
      title: '구현 증적',
      dataIndex: 'implementation_evidence',
      key: 'implementation_evidence',
      width: 200,
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '관련 자산',
      dataIndex: 'related_assets',
      key: 'related_assets',
      width: 150,
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '관련 위험',
      dataIndex: 'related_risks',
      key: 'related_risks',
      width: 150,
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '비고',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '작업',
      key: 'actions',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => openEditModal(record)}
        >
          수정
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ marginRight: 8 }} />
            적용성 보고서 (SOA)
          </Title>
        </Col>
        <Col>
          <Space>
            <Popconfirm
              title="SOA 자동 생성"
              description="모든 통제항목을 기반으로 SOA를 생성합니다. 기존 데이터가 초기화될 수 있습니다."
              onConfirm={handleGenerate}
              okText="생성"
              cancelText="취소"
            >
              <Button
                icon={<SyncOutlined spin={generating} />}
                loading={generating}
              >
                SOA 생성
              </Button>
            </Popconfirm>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                exportForm.setFieldsValue({ format: 'excel', template_type: 'isms_p' })
                setExportModalOpen(true)
              }}
            >
              내보내기
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 통계 카드 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="전체 통제항목"
              value={data?.total || 0}
              suffix="건"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="적용 항목"
              value={data?.applicable_count || 0}
              suffix="건"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="적용 제외"
              value={data?.not_applicable_count || 0}
              suffix="건"
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="완전 구현"
              value={fullyImplementedCount}
              suffix={`/ ${applicableItems.length}`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 14 }}>구현율</Text>
            </div>
            <Progress
              percent={implementationRate}
              strokeColor={{
                '0%': '#ff4d4f',
                '50%': '#faad14',
                '100%': '#52c41a',
              }}
              format={(percent) => <span style={{ fontSize: 20, fontWeight: 600 }}>{percent}%</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* 구현 상태별 분포 바 */}
      {applicableItems.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row align="middle" gutter={8}>
            <Col flex="80px">
              <Text type="secondary" style={{ fontSize: 12 }}>구현 현황</Text>
            </Col>
            <Col flex="auto">
              <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
                {IMPLEMENTATION_STATUSES.filter(s => s.value !== 'not_applicable').map(status => {
                  const count = statusStats[status.value] || 0
                  const pct = applicableItems.length > 0 ? (count / applicableItems.length) * 100 : 0
                  if (pct === 0) return null
                  return (
                    <Tooltip key={status.value} title={`${status.label}: ${count}건 (${pct.toFixed(1)}%)`}>
                      <div
                        style={{
                          width: `${pct}%`,
                          backgroundColor: status.color,
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          minWidth: pct > 5 ? undefined : 0,
                        }}
                      >
                        {pct > 8 ? `${status.label} ${count}` : ''}
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </Col>
            <Col flex="200px">
              <Space size={12}>
                {IMPLEMENTATION_STATUSES.filter(s => s.value !== 'not_applicable').map(status => (
                  <span key={status.value} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: status.color,
                      marginRight: 4,
                    }} />
                    {status.label}
                  </span>
                ))}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 필터 및 테이블 */}
      <Card
        title={
          <Space>
            <FilterOutlined />
            <span>SOA 레코드 목록</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              value={filterApplicable}
              onChange={setFilterApplicable}
              style={{ width: 130 }}
              options={[
                { value: 'all', label: '전체 적용여부' },
                { value: 'true', label: '적용' },
                { value: 'false', label: '적용 제외' },
              ]}
            />
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '전체 구현상태' },
                ...IMPLEMENTATION_STATUSES.map(s => ({
                  value: s.value,
                  label: s.label,
                })),
              ]}
            />
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data?.items || []}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `총 ${total}건`,
            defaultPageSize: 20,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          size="middle"
          rowClassName={(record) => !record.is_applicable ? 'soa-row-excluded' : ''}
        />
      </Card>

      {/* 편집 모달 */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>SOA 레코드 수정</span>
            {editingRecord && (
              <Tag color="blue">{editingRecord.control_code}</Tag>
            )}
          </Space>
        }
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setEditingRecord(null)
        }}
        onOk={handleEditSave}
        confirmLoading={saving}
        okText="저장"
        cancelText="취소"
        width={640}
        destroyOnClose
      >
        {editingRecord && (
          <>
            <Card
              size="small"
              style={{ marginBottom: 16, backgroundColor: '#fafafa' }}
            >
              <Text strong>{editingRecord.control_code}</Text>
              <Text style={{ marginLeft: 8 }}>{editingRecord.control_title}</Text>
              {editingRecord.control_description && (
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {editingRecord.control_description}
                  </Text>
                </div>
              )}
            </Card>
            <Form form={editForm} layout="vertical">
              <Form.Item
                name="is_applicable"
                label="적용 여부"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="적용"
                  unCheckedChildren="제외"
                />
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.is_applicable !== cur.is_applicable}
              >
                {({ getFieldValue }) =>
                  !getFieldValue('is_applicable') && (
                    <Form.Item
                      name="exclusion_reason"
                      label="제외 사유"
                      rules={[{ required: true, message: '제외 사유를 입력해주세요.' }]}
                    >
                      <TextArea rows={2} placeholder="적용 제외 사유를 입력하세요" />
                    </Form.Item>
                  )
                }
              </Form.Item>

              <Form.Item
                name="implementation_status"
                label="구현 상태"
                rules={[{ required: true, message: '구현 상태를 선택해주세요.' }]}
              >
                <Select
                  options={IMPLEMENTATION_STATUSES.map(s => ({
                    value: s.value,
                    label: (
                      <Space>
                        <span style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: s.color,
                        }} />
                        {s.label}
                      </Space>
                    ),
                  }))}
                />
              </Form.Item>

              <Form.Item
                name="implementation_evidence"
                label={
                  <Space>
                    <span>구현 증적</span>
                    <Tooltip title="해당 통제항목의 구현을 증명하는 증적 정보 (문서명, 시스템명 등)">
                      <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <TextArea rows={2} placeholder="구현 증적 정보를 입력하세요" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="related_assets" label="관련 자산">
                    <Input placeholder="관련 자산 정보" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="related_risks" label="관련 위험">
                    <Input placeholder="관련 위험 정보" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="remarks" label="비고">
                <TextArea rows={2} placeholder="비고" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* 내보내기 모달 */}
      <Modal
        title={
          <Space>
            <DownloadOutlined />
            <span>SOA 내보내기</span>
          </Space>
        }
        open={exportModalOpen}
        onCancel={() => {
          setExportModalOpen(false)
          exportForm.resetFields()
        }}
        onOk={handleExport}
        confirmLoading={exporting}
        okText="내보내기"
        cancelText="취소"
        width={480}
        destroyOnClose
      >
        <Form form={exportForm} layout="vertical" initialValues={{ format: 'excel', template_type: 'isms_p' }}>
          <Form.Item
            name="format"
            label="파일 형식"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              {SOA_EXPORT_FORMATS.map(fmt => (
                <Radio.Button key={fmt.value} value={fmt.value}>
                  <Space>
                    {fmt.value === 'excel' ? <FileExcelOutlined /> : <FileWordOutlined />}
                    {fmt.label}
                  </Space>
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="template_type"
            label="템플릿 유형"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              {SOA_TEMPLATE_TYPES.map(tmpl => (
                <Radio.Button key={tmpl.value} value={tmpl.value} style={{ height: 'auto', padding: '8px 16px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{tmpl.label}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{tmpl.description}</div>
                  </div>
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .soa-row-excluded {
          background-color: #fafafa;
          color: #8c8c8c;
        }
      `}</style>
    </div>
  )
}

export default SOAManagement
