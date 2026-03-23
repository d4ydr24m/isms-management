import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
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
  message,
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
import type {
  NonConformity,
  NonConformityType,
  CorrectiveActionStatus,
  CorrectiveAction,
  UserListItem,
  NonConformityUpdate,
  CorrectiveActionCreate,
} from '@/types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const severityColors: Record<NonConformityType, string> = {
  critical: 'red',
  major: 'orange',
  minor: 'gold',
  observation: 'blue',
}

const statusColors: Record<CorrectiveActionStatus, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  verified: 'cyan',
  rejected: 'error',
}

const statusLabels: Record<CorrectiveActionStatus, string> = {
  pending: '대기',
  in_progress: '진행 중',
  completed: '완료',
  verified: '검증됨',
  rejected: '반려',
}

interface StatusHistoryItem {
  id: number
  status: string
  changedBy: string
  changedAt: string
  notes: string
}

const NonConformityDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [nonConformity, setNonConformity] = useState<NonConformity | null>(null)
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([])
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isAddingAction, setIsAddingAction] = useState(false)
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const [ncData, usersData] = await Promise.all([
        auditService.getNonConformity(Number(id)),
        userService.getUsers({ limit: 100 }),
      ])
      setNonConformity(ncData)
      setUsers(usersData.data || [])

      // Fetch corrective actions (mocked for now)
      // In real implementation, this would be a separate API call
      setCorrectiveActions([
        {
          id: 1,
          nonConformityId: Number(id),
          action: '승인 프로세스 수립',
          implementationPlan: '정보보호 정책 승인 프로세스를 수립하고 문서화한다',
          responsibleId: 1,
          responsibleName: '박담당',
          dueDate: '2024-04-01',
          status: 'completed',
          completedAt: '2024-03-25',
          result: '정보보호 정책 승인 프로세스 수립 완료',
          verifiedBy: 2,
          verifiedByName: '김심사',
          verifiedAt: '2024-03-28',
          verificationNotes: '프로세스 문서 및 템플릿 확인 완료',
          createdAt: '2024-03-10',
          updatedAt: '2024-03-28',
        },
        {
          id: 2,
          nonConformityId: Number(id),
          action: 'CEO 승인 획득',
          implementationPlan: '현행 정보보호 정책서에 대한 CEO 승인을 획득한다',
          responsibleId: 1,
          responsibleName: '박담당',
          dueDate: '2024-04-15',
          status: 'in_progress',
          completedAt: null,
          result: null,
          verifiedBy: null,
          verifiedByName: null,
          verifiedAt: null,
          verificationNotes: null,
          createdAt: '2024-03-10',
          updatedAt: '2024-03-10',
        },
      ])

      // Mock status history
      setStatusHistory([
        {
          id: 1,
          status: 'pending',
          changedBy: '김심사',
          changedAt: '2024-03-05',
          notes: '부적합 사항 등록',
        },
        {
          id: 2,
          status: 'in_progress',
          changedBy: '박담당',
          changedAt: '2024-03-10',
          notes: '시정조치 착수',
        },
      ])
    } catch {
      message.error('부적합 사항을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleBack = () => {
    navigate('/non-conformities')
  }

  const handleAuditClick = () => {
    if (nonConformity) {
      navigate(`/audits/${nonConformity.auditId}`)
    }
  }

  const handleEdit = () => {
    if (nonConformity) {
      form.setFieldsValue({
        rootCause: nonConformity.rootCause,
        assigneeId: nonConformity.assigneeId,
        dueDate: nonConformity.dueDate ? dayjs(nonConformity.dueDate) : null,
      })
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    form.resetFields()
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const updateData: NonConformityUpdate = {
        rootCause: values.rootCause,
        assigneeId: values.assigneeId,
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
        action: values.action,
        implementationPlan: values.implementationPlan,
        responsibleId: values.responsibleId,
        dueDate: values.dueDate.format('YYYY-MM-DD'),
      }

      await auditService.createCorrectiveAction(Number(id), actionData)
      message.success('시정조치가 등록되었습니다')
      setIsAddingAction(false)
      fetchData()
    } catch {
      message.error('시정조치 등록에 실패했습니다')
    }
  }

  const correctiveActionColumns: ColumnsType<CorrectiveAction> = [
    {
      title: '조치',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: '담당자',
      dataIndex: 'responsibleName',
      key: 'responsibleName',
      width: 120,
    },
    {
      title: '기한',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: CorrectiveActionStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '검증',
      key: 'verification',
      width: 200,
      render: (_, record) => {
        if (record.verifiedAt) {
          return (
            <Space direction="vertical" size="small">
              <Text type="success">
                <CheckCircleOutlined /> {record.verifiedByName} 검증 완료
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.verificationNotes}
              </Text>
            </Space>
          )
        }
        return '-'
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

          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="통제항목">
              {nonConformity.controlItem.number} - {nonConformity.controlItem.title}
            </Descriptions.Item>
            <Descriptions.Item label="심각도">
              <Tag color={severityColors[nonConformity.type]}>{nonConformity.type.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="상태">
              <Tag color={statusColors[nonConformity.status]}>{statusLabels[nonConformity.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="기한">{nonConformity.dueDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="담당자">{nonConformity.assigneeName || '-'}</Descriptions.Item>
            <Descriptions.Item label="감사">
              <a onClick={handleAuditClick} style={{ cursor: 'pointer' }}>
                {nonConformity.auditTitle}
              </a>
            </Descriptions.Item>
            <Descriptions.Item label="설명" span={3}>
              <Paragraph>{nonConformity.description}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="증적" span={3}>
              <Paragraph>{nonConformity.evidence}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="근본 원인" span={3}>
              {isEditing ? (
                <Form form={form}>
                  <Form.Item name="rootCause" noStyle>
                    <TextArea rows={4} placeholder="근본 원인 분석 입력" />
                  </Form.Item>
                </Form>
              ) : (
                <Paragraph>{nonConformity.rootCause || '분석 전'}</Paragraph>
              )}
            </Descriptions.Item>
          </Descriptions>
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
            items={statusHistory.map((item) => ({
              color: item.status === 'pending' ? 'gray' : item.status === 'in_progress' ? 'blue' : 'green',
              children: (
                <div>
                  <Text strong>{item.status.replace('_', ' ').toUpperCase()}</Text>
                  <br />
                  <Text type="secondary">{item.notes}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.changedBy} - {item.changedAt}
                  </Text>
                </div>
              ),
            }))}
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
            <Button block onClick={() => handleStatusConfirm('in_progress')}>
              진행 중
            </Button>
            <Button block onClick={() => handleStatusConfirm('completed')}>
              완료
            </Button>
            <Button block onClick={() => handleStatusConfirm('verified')}>
              검증됨
            </Button>
            <Button block onClick={() => handleStatusConfirm('rejected')}>
              반려
            </Button>
            <Divider />
            <Button block type="primary" onClick={() => handleStatusConfirm('completed')}>
              해결됨
            </Button>
            <Button block onClick={() => handleStatusConfirm('verified')}>
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
              name="action"
              label="조치"
              rules={[{ required: true, message: '조치 내용을 입력해주세요' }]}
            >
              <Input placeholder="시정조치 내용 입력" />
            </Form.Item>
            <Form.Item
              name="implementationPlan"
              label="이행 계획"
              rules={[{ required: true, message: '이행 계획을 입력해주세요' }]}
            >
              <TextArea rows={4} placeholder="이행 계획 기술" />
            </Form.Item>
            <Form.Item
              name="responsibleId"
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
              name="dueDate"
              label="기한"
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

export default NonConformityDetail
