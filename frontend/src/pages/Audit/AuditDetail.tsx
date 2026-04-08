import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  App,
  Card,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Descriptions,
  Progress,
  Table,
  Typography,
  Spin,
  Statistic,
  Form,
  Input,
  Select,
  DatePicker,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { auditService } from '@/services/audits'
import { ncTypeLabels, ncTypeColors, ncStatusLabels, ncStatusColors, formatDateTime } from '@/utils/format'
import type { AuditPlan, AuditChecklist, NonConformity, AuditStatus } from '@/types'

const { Title, Text } = Typography

const statusColors: Record<AuditStatus, string> = {
  planning: 'blue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
}

const statusLabels: Record<AuditStatus, string> = {
  planning: '계획 중',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소',
}

const auditTypeLabels: Record<string, string> = {
  internal: '내부 감사',
  external: '외부 감사',
  certification: '인증 심사',
  surveillance: '사후 심사',
}


const { TextArea } = Input
const { Option } = Select
const { RangePicker } = DatePicker

const AuditDetail = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const [audit, setAudit] = useState<AuditPlan | null>(null)
  const [checklist, setChecklist] = useState<AuditChecklist[]>([])
  const [nonConformities, setNonConformities] = useState<NonConformity[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const [auditData, checklistData, ncData] = await Promise.all([
        auditService.getAudit(Number(id)),
        auditService.getChecklist(Number(id)),
        auditService.getNonConformities({ auditPlanId: Number(id), size: 100 }),
      ])
      setAudit(auditData)
      setChecklist(checklistData)
      setNonConformities(ncData.items || [])
    } catch {
      // Error handling
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Enter edit mode when URL ends with /edit
  useEffect(() => {
    if (location.pathname.endsWith('/edit') && audit) {
      setIsEditing(true)
    }
  }, [location.pathname, audit])

  // Populate form after it mounts (isEditing becomes true)
  useEffect(() => {
    if (isEditing && audit) {
      form.setFieldsValue({
        title: audit.title,
        description: audit.description,
        auditType: audit.auditType,
        period: [dayjs(audit.startDate), dayjs(audit.endDate)],
        scope: audit.scope,
        status: audit.status,
      })
    }
  }, [isEditing, audit, form])

  const handleBack = () => {
    navigate('/audits')
  }

  const handleEdit = () => {
    if (audit) {
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    form.resetFields()
    if (location.pathname.endsWith('/edit')) {
      navigate(`/audits/${id}`)
    }
  }

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await auditService.updateAudit(Number(id), {
        title: values.title,
        description: values.description,
        auditType: values.auditType,
        startDate: values.period[0].format('YYYY-MM-DD'),
        endDate: values.period[1].format('YYYY-MM-DD'),
        scope: values.scope,
        status: values.status,
      })
      message.success('감사 계획이 수정되었습니다')
      setIsEditing(false)
      if (location.pathname.endsWith('/edit')) {
        navigate(`/audits/${id}`)
      }
      fetchData()
    } catch {
      message.error('감사 계획 수정에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleViewChecklist = () => {
    navigate(`/audits/${id}/checklist`)
  }

  const handleRegisterNonConformity = () => {
    navigate(`/audits/${id}/non-conformities/create`)
  }

  const handleNonConformityClick = (record: NonConformity) => {
    navigate(`/non-conformities/${record.id}`, { state: { from: `/audits/${id}` } })
  }

  // Calculate checklist progress
  const checkedItems = checklist.filter((item) => item.latestResult !== null).length
  const totalItems = checklist.length
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

  // Calculate severity statistics
  const severityStats = {
    critical: nonConformities.filter((nc) => nc.severity === 'critical').length,
    major: nonConformities.filter((nc) => nc.ncType === 'major').length,
    minor: nonConformities.filter((nc) => nc.ncType === 'minor').length,
    observation: nonConformities.filter((nc) => nc.ncType === 'observation').length,
  }

  const nonConformityColumns: ColumnsType<NonConformity> = [
    {
      title: '통제항목',
      key: 'control',
      width: 100,
      render: (_, record) => record.controlItemCode || '-',
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => handleNonConformityClick(record)}
        >
          {text}
        </span>
      ),
    },
    {
      title: '유형',
      dataIndex: 'ncType',
      key: 'ncType',
      width: 100,
      render: (ncType: string) => (
        <Tag color={ncTypeColors[ncType] || 'default'}>{ncTypeLabels[ncType] || ncType}</Tag>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={ncStatusColors[status] || 'default'}>{ncStatusLabels[status] || status}</Tag>
      ),
    },
    {
      title: '기한',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!audit) {
    return (
      <Card>
        <Text>감사를 찾을 수 없습니다</Text>
      </Card>
    )
  }

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack} aria-label="뒤로">
              뒤로
            </Button>
          </Space>

          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Title level={3} style={{ margin: 0 }}>
                {audit.title}
              </Title>
            </Col>
            <Col>
              <Space>
                {isEditing ? (
                  <>
                    <Button icon={<SaveOutlined />} type="primary" onClick={handleSaveEdit} loading={saving}>
                      저장
                    </Button>
                    <Button icon={<CloseOutlined />} onClick={handleCancelEdit}>
                      취소
                    </Button>
                  </>
                ) : (
                  <>
                    <Button icon={<EditOutlined />} onClick={handleEdit} aria-label="수정">
                      수정
                    </Button>
                    <Button
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={handleViewChecklist}
                      aria-label="체크리스트 보기"
                    >
                      체크리스트 보기
                    </Button>
                    <Button
                      icon={<ExclamationCircleOutlined />}
                      onClick={handleRegisterNonConformity}
                      aria-label="부적합 등록"
                    >
                      부적합 등록
                    </Button>
                  </>
                )}
              </Space>
            </Col>
          </Row>

          {isEditing ? (
            <Form form={form} layout="vertical">
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="title" label="감사 제목" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="auditType" label="감사 유형" rules={[{ required: true }]}>
                    <Select>
                      <Option value="internal">내부 감사</Option>
                      <Option value="external">외부 감사</Option>
                      <Option value="certification">인증 심사</Option>
                      <Option value="surveillance">사후 심사</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="period" label="감사 기간" rules={[{ required: true }]}>
                    <RangePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="status" label="상태">
                    <Select>
                      <Option value="planning">계획 중</Option>
                      <Option value="in_progress">진행 중</Option>
                      <Option value="completed">완료</Option>
                      <Option value="cancelled">취소</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="scope" label="감사 범위" rules={[{ required: true }]}>
                <TextArea rows={3} />
              </Form.Item>
              <Form.Item name="description" label="설명">
                <TextArea rows={3} />
              </Form.Item>
            </Form>
          ) : (
            <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="유형">
                <Tag>{auditTypeLabels[audit.auditType] || audit.auditType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="상태">
                <Tag color={statusColors[audit.status]}>{statusLabels[audit.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="기간">
                {audit.startDate} ~ {audit.endDate}
              </Descriptions.Item>
              <Descriptions.Item label="범위" span={3}>
                {audit.scope}
              </Descriptions.Item>
              <Descriptions.Item label="수석감사원" span={2}>
                {audit.leadAuditorName ? (
                  <Tag>{audit.leadAuditorName}</Tag>
                ) : (
                  <Text type="secondary">미지정</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="작성일">{formatDateTime(audit.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="수정일">{formatDateTime(audit.updatedAt)}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card title="체크리스트 진행률" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Progress percent={progressPercent} status="active" />
                <Text type="secondary">
                  {checkedItems} / {totalItems} 항목 점검 완료
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="부적합 사항" size="small">
              <Row gutter={8}>
                <Col span={6}>
                  <Statistic
                    title="치명적"
                    value={severityStats.critical}
                    valueStyle={{ color: '#f5222d', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="중대"
                    value={severityStats.major}
                    valueStyle={{ color: '#fa8c16', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="경미"
                    value={severityStats.minor}
                    valueStyle={{ color: '#faad14', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="합계"
                    value={audit.nonConformityCount}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Card title="부적합 목록">
          <Table
            columns={nonConformityColumns}
            dataSource={nonConformities}
            rowKey="id"
            pagination={false}
            size="small"
            onRow={(record) => ({
              onClick: () => handleNonConformityClick(record),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
      </Space>
    </div>
  )
}

export default AuditDetail
