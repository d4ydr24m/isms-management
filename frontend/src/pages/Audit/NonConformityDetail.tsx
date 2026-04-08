import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import {
  App,
  Card,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Descriptions,
  Timeline,
  Table,
  Typography,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Divider,
  Upload,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { auditService } from '@/services/audits'
import { userService } from '@/services/users'
import { controlService } from '@/services/controls'
import {
  ncTypeLabels as sharedNcTypeLabels,
  severityColors as sharedSeverityColors,
  ncStatusLabels as sharedNcStatusLabels,
  ncStatusColors as sharedNcStatusColors,
  caStatusLabels as sharedCaStatusLabels,
  caStatusColors as sharedCaStatusColors,
  formatDateTime,
  formatDate,
} from '@/utils/format'
import type {
  NonConformity,
  NonConformityType,
  CorrectiveActionStatus,
  CorrectiveAction,
  UserListItem,
  NonConformityUpdate,
  NonConformityCreate,
  CorrectiveActionCreate,
  ControlItem,
} from '@/types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const ncTypeLabels = sharedNcTypeLabels
const severityColors = sharedSeverityColors
const ncStatusColors = sharedNcStatusColors
const ncStatusLabels = sharedNcStatusLabels
const caStatusColors = sharedCaStatusColors
const caStatusLabels = sharedCaStatusLabels


const NonConformityDetail = () => {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { id, auditId } = useParams<{ id: string; auditId: string }>()
  const isCreateMode = !id
  const referrer = (location.state as any)?.from || '/non-conformities'
  const [nonConformity, setNonConformity] = useState<NonConformity | null>(null)
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(!isCreateMode)
  const [isEditing, setIsEditing] = useState(false)
  const [isAddingAction, setIsAddingAction] = useState(false)
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const [ncData, usersData, caData] = await Promise.all([
        auditService.getNonConformity(Number(id)),
        userService.getUsers({ size: 100 }),
        auditService.getCorrectiveActions(Number(id)),
      ])
      setNonConformity(ncData)
      setUsers(usersData.items || [])
      setCorrectiveActions(caData)
    } catch {
      message.error('부적합 사항을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Load users for create mode
  useEffect(() => {
    if (isCreateMode) {
      userService.getUsers({ size: 100 }).then((data) => {
        setUsers(data.items || [])
      }).catch(() => {})
    }
  }, [isCreateMode])

  const handleBack = () => {
    navigate(referrer)
  }

  const handleAuditClick = () => {
    if (nonConformity) {
      navigate(`/audits/${nonConformity.auditPlanId}`)
    }
  }

  const handleEdit = () => {
    if (nonConformity) {
      setIsEditing(true)
    }
  }

  // Populate form after it mounts
  useEffect(() => {
    if (isEditing && nonConformity) {
      form.setFieldsValue({
        title: nonConformity.title,
        ncType: nonConformity.ncType,
        severity: nonConformity.severity,
        description: nonConformity.description,
        requirement: nonConformity.requirement,
        evidence: nonConformity.evidence,
        responsiblePersonId: nonConformity.responsiblePersonId,
        dueDate: nonConformity.dueDate ? dayjs(nonConformity.dueDate) : null,
      })
    }
  }, [isEditing, nonConformity, form])

  const handleCancelEdit = () => {
    setIsEditing(false)
    form.resetFields()
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const updateData: NonConformityUpdate = {
        title: values.title,
        ncType: values.ncType,
        severity: values.severity,
        description: values.description,
        requirement: values.requirement,
        evidence: values.evidence,
        responsiblePersonId: values.responsiblePersonId,
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
      }

      await auditService.updateNonConformity(Number(id), updateData)
      message.success('부적합 사항이 수정되었습니다')
      setIsEditing(false)
      fetchData()
    } catch {
      message.error('부적합 사항 수정에 실패했습니다')
    }
  }

  const handleStatusChange = () => {
    setStatusModalVisible(true)
  }

  const handleStatusConfirm = async (newStatus: CorrectiveActionStatus) => {
    try {
      await auditService.updateNonConformity(Number(id), { status: newStatus })
      message.success('상태가 수정되었습니다')
      setStatusModalVisible(false)
      fetchData()
    } catch {
      message.error('상태 수정에 실패했습니다')
    }
  }

  const handleAddCorrectiveAction = () => {
    setIsAddingAction(true)
    actionForm.resetFields()
  }

  const handleSaveCorrectiveAction = async () => {
    try {
      const values = await actionForm.validateFields()
      const actionData: CorrectiveActionCreate = {
        actionPlan: values.actionPlan,
        rootCause: values.rootCause || undefined,
        preventiveMeasures: values.preventiveMeasures || undefined,
        responsiblePersonId: values.responsiblePersonId,
        plannedCompletionDate: values.plannedCompletionDate.format('YYYY-MM-DD'),
      }

      await auditService.createCorrectiveAction(Number(id), actionData)
      message.success('시정조치가 등록되었습니다')
      setIsAddingAction(false)
      fetchData()
    } catch {
      message.error('시정조치 등록에 실패했습니다')
    }
  }

  const handleCAStatusChange = async (caId: number, newStatus: string) => {
    try {
      await auditService.updateCorrectiveAction(Number(id), caId, { status: newStatus as any })
      message.success('상태가 변경되었습니다')
      fetchData()
    } catch {
      message.error('상태 변경에 실패했습니다')
    }
  }

  const handleCAVerify = async (caId: number, approved: boolean) => {
    try {
      await auditService.verifyCorrectiveAction(Number(id), caId, {
        verificationResult: approved ? 'approved' : 'rejected',
        verificationComment: approved ? '검증 승인' : '검증 반려',
      })
      message.success(approved ? '검증 승인되었습니다' : '검증 반려되었습니다')
      fetchData()
    } catch {
      message.error('검증에 실패했습니다')
    }
  }

  const handleCADelete = (caId: number) => {
    modal.confirm({
      title: '시정조치 삭제',
      content: '이 시정조치를 삭제하시겠습니까?',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await auditService.deleteCorrectiveAction(Number(id), caId)
          message.success('시정조치가 삭제되었습니다')
          fetchData()
        } catch {
          message.error('시정조치 삭제에 실패했습니다')
        }
      },
    })
  }

  const correctiveActionColumns: ColumnsType<CorrectiveAction> = [
    {
      title: '조치',
      dataIndex: 'actionPlan',
      key: 'actionPlan',
    },
    {
      title: '담당자',
      dataIndex: 'responsiblePersonName',
      key: 'responsiblePersonName',
      width: 100,
      render: (name: string | null) => name || '-',
    },
    {
      title: '기한',
      dataIndex: 'plannedCompletionDate',
      key: 'plannedCompletionDate',
      width: 110,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: CorrectiveActionStatus) => (
        <Tag color={caStatusColors[status]}>{caStatusLabels[status] || status}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        return (
          <Space size="small" wrap>
            {record.verifiedAt ? (
              <Text type="success">
                <CheckCircleOutlined /> 검증 완료
              </Text>
            ) : (
              <>
                {record.status === 'planned' && (
                  <Button size="small" onClick={() => handleCAStatusChange(record.id, 'in_progress')}>
                    착수
                  </Button>
                )}
                {record.status === 'in_progress' && (
                  <Button size="small" type="primary" onClick={() => handleCAStatusChange(record.id, 'completed')}>
                    완료
                  </Button>
                )}
                {record.status === 'completed' && (
                  <>
                    <Button size="small" type="primary" onClick={() => handleCAVerify(record.id, true)}>
                      승인
                    </Button>
                    <Button size="small" danger onClick={() => handleCAVerify(record.id, false)}>
                      반려
                    </Button>
                  </>
                )}
              </>
            )}
            <Button size="small" danger type="text" onClick={() => handleCADelete(record.id)}>
              삭제
            </Button>
          </Space>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (isCreateMode) {
    return <NonConformityCreateForm auditId={auditId} users={users} navigate={navigate} />
  }

  if (!nonConformity) {
    return (
      <Card>
        <Text>부적합 사항을 찾을 수 없습니다</Text>
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
                {nonConformity.title}
              </Title>
            </Col>
            <Col>
              <Space>
                {isEditing ? (
                  <>
                    <Button onClick={handleCancelEdit}>취소</Button>
                    <Button type="primary" onClick={handleSave} aria-label="저장">
                      저장
                    </Button>
                  </>
                ) : (
                  <>
                    <Button icon={<EditOutlined />} onClick={handleEdit} aria-label="수정">
                      수정
                    </Button>
                    <Button onClick={handleStatusChange} aria-label="상태 변경">
                      상태 변경
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
                  <Form.Item name="title" label="제목" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="responsiblePersonId" label="담당자">
                    <Select placeholder="담당자 선택" allowClear>
                      {users.map((user) => (
                        <Option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item name="ncType" label="유형">
                    <Select>
                      <Option value="major">중결함</Option>
                      <Option value="minor">경결함</Option>
                      <Option value="observation">관찰사항</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="severity" label="심각도">
                    <Select>
                      <Option value="critical">치명적</Option>
                      <Option value="high">높음</Option>
                      <Option value="medium">중간</Option>
                      <Option value="low">낮음</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="dueDate" label="기한">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="설명" rules={[{ required: true }]}>
                <TextArea rows={3} />
              </Form.Item>
              <Form.Item name="requirement" label="요구사항">
                <TextArea rows={2} />
              </Form.Item>
              <Form.Item name="evidence" label="증적">
                <TextArea rows={2} />
              </Form.Item>
            </Form>
          ) : (
            <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="통제항목">
                {nonConformity.controlItemCode || '-'} - {nonConformity.controlItemTitle || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="유형 / 심각도">
                <Tag>{ncTypeLabels[nonConformity.ncType] || nonConformity.ncType}</Tag>
                {' '}
                <Tag color={severityColors[nonConformity.severity]}>{(nonConformity.severity || '').toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="상태">
                <Tag color={ncStatusColors[nonConformity.status]}>{ncStatusLabels[nonConformity.status] || nonConformity.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="기한">{nonConformity.dueDate || '-'}</Descriptions.Item>
              <Descriptions.Item label="담당자">{nonConformity.responsiblePersonName || '-'}</Descriptions.Item>
              <Descriptions.Item label="감사">
                <a onClick={handleAuditClick} style={{ cursor: 'pointer' }}>
                  {nonConformity.auditPlanTitle || '-'}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="설명" span={3}>
                <Paragraph>{nonConformity.description}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="증적" span={3}>
                <Paragraph>{nonConformity.evidence || '-'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="요구사항" span={3}>
                <Paragraph>{nonConformity.requirement || '-'}</Paragraph>
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Card
          title="시정조치"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddCorrectiveAction}
              aria-label="시정조치 추가"
            >
              시정조치 추가
            </Button>
          }
        >
          <Table
            columns={correctiveActionColumns}
            dataSource={correctiveActions}
            rowKey="id"
            pagination={false}
          />
        </Card>

        <Card title="첨부파일">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Upload
              listType="text"
              beforeUpload={() => false}
            >
              <Button icon={<UploadOutlined />} aria-label="증적 업로드">
                증적 업로드
              </Button>
            </Upload>
          </Space>
        </Card>

        <Card title="상태 이력">
          <Timeline
            items={[
              {
                color: 'red',
                children: (
                  <div>
                    <Text strong>부적합 등록</Text>
                    <br />
                    <Text type="secondary">
                      적발일: {formatDate(nonConformity.detectedAt)} / 등록일: {formatDateTime(nonConformity.createdAt)}
                    </Text>
                  </div>
                ),
              },
              ...correctiveActions.map((ca) => ({
                color: ca.status === 'verified' ? 'green' : ca.status === 'completed' ? 'blue' : 'gray',
                children: (
                  <div>
                    <Text strong>시정조치: {ca.actionPlan}</Text>
                    <br />
                    <Text type="secondary">
                      담당: {ca.responsiblePersonName || '-'} / 상태: {caStatusLabels[ca.status] || ca.status}
                      {ca.verifiedAt && ` / 검증: ${ca.verifierName} (${formatDateTime(ca.verifiedAt)})`}
                    </Text>
                  </div>
                ),
              })),
              ...(nonConformity.closedAt ? [{
                color: 'green' as const,
                children: (
                  <div>
                    <Text strong>부적합 종료</Text>
                    <br />
                    <Text type="secondary">{formatDate(nonConformity.closedAt)}</Text>
                  </div>
                ),
              }] : []),
            ]}
          />
        </Card>

        {/* Status Change Modal */}
        <Modal
          title="상태 변경"
          open={statusModalVisible}
          onCancel={() => setStatusModalVisible(false)}
          footer={null}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>새 상태를 선택하세요:</Text>
            <Button block onClick={() => handleStatusConfirm('in_progress' as any)}>
              진행 중
            </Button>
            <Button block onClick={() => handleStatusConfirm('resolved' as any)}>
              해결됨
            </Button>
            <Button block onClick={() => handleStatusConfirm('closed' as any)}>
              종결
            </Button>
          </Space>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Text type="secondary">선택을 확인하세요</Text>
          </div>
        </Modal>

        {/* Add Corrective Action Modal */}
        <Modal
          title="시정조치 추가"
          open={isAddingAction}
          onCancel={() => setIsAddingAction(false)}
          onOk={handleSaveCorrectiveAction}
          okText="추가"
        >
          <Form form={actionForm} layout="vertical">
            <Form.Item
              name="actionPlan"
              label="시정조치 계획"
              rules={[{ required: true, message: '시정조치 계획을 입력해주세요' }]}
            >
              <TextArea rows={3} placeholder="시정조치 계획 입력" />
            </Form.Item>
            <Form.Item
              name="rootCause"
              label="근본 원인"
            >
              <TextArea rows={2} placeholder="근본 원인 분석" />
            </Form.Item>
            <Form.Item
              name="preventiveMeasures"
              label="재발 방지 대책"
            >
              <TextArea rows={2} placeholder="재발 방지 대책" />
            </Form.Item>
            <Form.Item
              name="responsiblePersonId"
              label="담당자"
              rules={[{ required: true, message: '담당자를 선택해주세요' }]}
            >
              <Select placeholder="담당자 선택">
                {users.map((user) => (
                  <Option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="plannedCompletionDate"
              label="완료 예정일"
              rules={[{ required: true, message: '기한을 선택해주세요' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </div>
  )
}

// Create form sub-component
const NonConformityCreateForm = ({
  auditId,
  users,
  navigate,
}: {
  auditId?: string
  users: UserListItem[]
  navigate: ReturnType<typeof useNavigate>
}) => {
  const { message } = App.useApp()
  const [searchParams] = useSearchParams()
  const controlItemIdParam = searchParams.get('controlItemId')
  const [createForm] = Form.useForm()
  const [controls, setControls] = useState<ControlItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    controlService.getControls({ pageSize: 200 }).then((data) => {
      setControls(data.items || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (controlItemIdParam) {
      createForm.setFieldsValue({ controlItemId: Number(controlItemIdParam) })
    }
    if (auditId) {
      createForm.setFieldsValue({ auditId: Number(auditId) })
    }
  }, [controlItemIdParam, auditId, createForm])

  const handleSubmit = async (values: any) => {
    setSubmitting(true)
    try {
      const data: NonConformityCreate = {
        auditPlanId: Number(auditId) || values.auditPlanId,
        controlItemId: values.controlItemId,
        ncType: values.ncType,
        severity: values.severity,
        title: values.title,
        description: values.description,
        requirement: values.requirement || values.description,
        evidence: values.evidence || undefined,
        responsiblePersonId: values.responsiblePersonId,
        dueDate: values.dueDate.format('YYYY-MM-DD'),
      }
      await auditService.createNonConformity(data)
      message.success('부적합 사항이 등록되었습니다')
      if (auditId) {
        navigate(`/audits/${auditId}`)
      } else {
        navigate('/non-conformities')
      }
    } catch {
      message.error('부적합 사항 등록에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (auditId) {
      navigate(`/audits/${auditId}`)
    } else {
      navigate('/non-conformities')
    }
  }

  return (
    <Card title="부적합 사항 등록">
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          뒤로
        </Button>
      </Space>
      <Form form={createForm} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="title"
              label="제목"
              rules={[{ required: true, message: '제목을 입력해주세요' }]}
            >
              <Input placeholder="부적합 제목 입력" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="controlItemId"
              label="통제항목"
              rules={[{ required: true, message: '통제항목을 선택해주세요' }]}
            >
              <Select placeholder="통제항목 선택" showSearch optionFilterProp="children">
                {controls.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.code} - {c.title}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="ncType"
              label="부적합 유형"
              rules={[{ required: true, message: '유형을 선택해주세요' }]}
            >
              <Select placeholder="유형 선택">
                <Option value="major">중결함 (Major)</Option>
                <Option value="minor">경결함 (Minor)</Option>
                <Option value="observation">관찰사항 (Observation)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="severity"
              label="심각도"
              rules={[{ required: true, message: '심각도를 선택해주세요' }]}
            >
              <Select placeholder="심각도 선택">
                <Option value="critical">치명적 (Critical)</Option>
                <Option value="high">높음 (High)</Option>
                <Option value="medium">중간 (Medium)</Option>
                <Option value="low">낮음 (Low)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="responsiblePersonId"
              label="조치 담당자"
              rules={[{ required: true, message: '담당자를 선택해주세요' }]}
            >
              <Select placeholder="담당자 선택">
                {users.map((user) => (
                  <Option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="dueDate"
              label="시정 기한"
              rules={[{ required: true, message: '기한을 선택해주세요' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="부적합 내용"
          rules={[{ required: true, message: '내용을 입력해주세요' }]}
        >
          <TextArea rows={4} placeholder="부적합 상세 내용 기술" />
        </Form.Item>

        <Form.Item
          name="requirement"
          label="요구사항"
          rules={[{ required: true, message: '요구사항을 입력해주세요' }]}
        >
          <TextArea rows={3} placeholder="위반된 요구사항 기술" />
        </Form.Item>

        <Form.Item name="evidence" label="증적/근거">
          <TextArea rows={3} placeholder="근거 자료 설명" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              등록
            </Button>
            <Button onClick={handleBack}>취소</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default NonConformityDetail
