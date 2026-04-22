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
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { auditService } from '@/services/audits'
import { controlService } from '@/services/controls'
import { apiClient } from '@/services/api'
import { usePermissions } from '@/hooks'
import CorrectiveActionAssistant from '@/components/llm/CorrectiveActionAssistant'
import NcEvidenceAttachments from '@/components/audit/NcEvidenceAttachments'
import type { NcEvidenceItem } from '@/types'
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
  NonConformityUpdate,
  NonConformityCreate,
  CorrectiveActionCreate,
  ControlItem,
  AuditPlan,
} from '@/types'

interface PersonnelItem {
  id: number
  name: string
  email: string | null
  position: string | null
  departmentName: string | null
}

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const ncTypeLabels = sharedNcTypeLabels
const severityColors = sharedSeverityColors
const ncStatusColors = sharedNcStatusColors
const ncStatusLabels = sharedNcStatusLabels
const caStatusColors = sharedCaStatusColors
const caStatusLabels = sharedCaStatusLabels

/**
 * LLM 초안을 섹션별로 분리.
 * 모델이 '# 2.' 또는 '2.' 두 스타일 중 하나로 번호를 매기므로 둘 다 허용한다.
 * 섹션 번호가 없거나 매칭되지 않으면 해당 필드는 undefined.
 */
function parseDraftSections(text: string): {
  phenomenon?: string
  rootCause?: string
  actionPlan?: string
  preventive?: string
} {
  const picked = (n: number): string | undefined => {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*#?\\s*${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*#?\\s*\\d\\.|$)`,
    )
    const match = text.match(pattern)
    return match?.[1]?.trim() || undefined
  }
  return {
    phenomenon: picked(1),
    rootCause: picked(2),
    actionPlan: picked(3),
    preventive: picked(4),
  }
}


const NonConformityDetail = () => {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const { id, auditId } = useParams<{ id: string; auditId: string }>()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission('audit:create')
  const canUpdate = hasPermission('audit:update')
  const canDelete = hasPermission('audit:delete')
  const isCreateMode = !id
  const referrer = (location.state as any)?.from || '/non-conformities'
  const [nonConformity, setNonConformity] = useState<NonConformity | null>(null)
  const [attachedEvidences, setAttachedEvidences] = useState<NcEvidenceItem[]>([])
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([])
  const [users, setUsers] = useState<PersonnelItem[]>([])
  const [controls, setControls] = useState<ControlItem[]>([])
  const [loading, setLoading] = useState(!isCreateMode)
  const [isEditing, setIsEditing] = useState(false)
  const [isAddingAction, setIsAddingAction] = useState(false)
  const [editingCA, setEditingCA] = useState<CorrectiveAction | null>(null)
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const [ncData, personnelRes, caData, controlsData] = await Promise.all([
        auditService.getNonConformity(Number(id)),
        apiClient.get<PersonnelItem[]>('/personnel/search', { params: { limit: 500 } }),
        auditService.getCorrectiveActions(Number(id)),
        controlService.getControls({ pageSize: 200 }),
      ])
      setNonConformity(ncData)
      setUsers(personnelRes.data || [])
      setControls(controlsData.items || [])
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

  // Load personnel for create mode
  useEffect(() => {
    if (isCreateMode) {
      apiClient.get<PersonnelItem[]>('/personnel/search', { params: { limit: 500 } }).then((res) => {
        setUsers(res.data || [])
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
        controlItemId: nonConformity.controlItemId,
        ncType: nonConformity.ncType,
        severity: nonConformity.severity,
        description: nonConformity.description,
        requirement: nonConformity.requirement,
        responsiblePersonIds: nonConformity.responsiblePersonIds,
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
        controlItemId: values.controlItemId,
        ncType: values.ncType,
        severity: values.severity,
        description: values.description,
        requirement: values.requirement,
        responsiblePersonIds: values.responsiblePersonIds,
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

  /**
   * AI 초안 본문을 '# 2. 결함 원인', '# 3. 개선 조치 내역', '# 4. 재발 방지 대책'
   * 단위로 나눠 시정조치 추가 모달의 각 필드(근본 원인 / 조치 계획 / 재발 방지 대책)에
   * 미리 채워 넣는다. 모델이 간혹 '1.' 스타일을 쓰므로 두 패턴을 모두 허용한다.
   */
  const handleApplyDraftToCorrectiveAction = (draftText: string) => {
    const sections = parseDraftSections(draftText)
    setIsAddingAction(true)
    // resetFields 이후 set 해야 기존 값이 남지 않는다.
    actionForm.resetFields()
    actionForm.setFieldsValue({
      actionPlan: sections.actionPlan || draftText,
      rootCause: sections.rootCause,
      preventiveMeasures: sections.preventive,
    })
  }

  const handleSaveCorrectiveAction = async () => {
    try {
      const values = await actionForm.validateFields()
      const actionData: CorrectiveActionCreate = {
        actionPlan: values.actionPlan,
        rootCause: values.rootCause || undefined,
        preventiveMeasures: values.preventiveMeasures || undefined,
        responsiblePersonIds: values.responsiblePersonIds,
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

  const handleEditCA = (record: CorrectiveAction) => {
    setEditingCA(record)
    actionForm.setFieldsValue({
      actionPlan: record.actionPlan,
      rootCause: record.rootCause,
      preventiveMeasures: record.preventiveMeasures,
      responsiblePersonIds: record.responsiblePersonIds,
      plannedCompletionDate: record.plannedCompletionDate ? dayjs(record.plannedCompletionDate) : null,
    })
  }

  const handleUpdateCorrectiveAction = async () => {
    if (!editingCA) return
    try {
      const values = await actionForm.validateFields()
      await auditService.updateCorrectiveAction(Number(id), editingCA.id, {
        actionPlan: values.actionPlan,
        rootCause: values.rootCause || undefined,
        preventiveMeasures: values.preventiveMeasures || undefined,
        responsiblePersonIds: values.responsiblePersonIds,
        plannedCompletionDate: values.plannedCompletionDate?.format('YYYY-MM-DD'),
      })
      message.success('시정조치가 수정되었습니다')
      setEditingCA(null)
      actionForm.resetFields()
      fetchData()
    } catch {
      message.error('시정조치 수정에 실패했습니다')
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
      ellipsis: true,
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
      width: 140,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.verifiedAt ? (
            <Text type="success">
              <CheckCircleOutlined /> 검증 완료
            </Text>
          ) : (
            canUpdate && <>
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
        </Space>
      ),
    },
    {
      title: '관리',
      key: 'manage',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          {canUpdate && !record.verifiedAt && (
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEditCA(record)}>
              수정
            </Button>
          )}
          {canDelete && (
            <Button size="small" danger type="text" onClick={() => handleCADelete(record.id)}>
              삭제
            </Button>
          )}
        </Space>
      ),
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
                  canUpdate && <>
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
                  <Form.Item name="controlItemId" label="통제항목">
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
                  <Form.Item name="responsiblePersonIds" label="담당자">
                    <Select placeholder="담당자 선택" mode="multiple" allowClear showSearch optionFilterProp="children" maxTagCount="responsive">
                      {users.map((user) => (
                        <Option key={user.id} value={user.id}>
                          {user.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="dueDate" label="기한">
                    <DatePicker style={{ width: '100%' }} />
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
              </Row>
              <Form.Item name="description" label="결함 내용" rules={[{ required: true }]}>
                <TextArea rows={3} />
              </Form.Item>
              <Form.Item name="requirement" label="요구사항">
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
              <Descriptions.Item label="결함 내용" span={3}>
                <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{nonConformity.description}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="요구사항" span={3}>
                <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{nonConformity.requirement || '-'}</Paragraph>
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        <Card
          title="시정조치"
          extra={
            canCreate ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddCorrectiveAction}
                aria-label="시정조치 추가"
              >
                시정조치 추가
              </Button>
            ) : null
          }
        >
          <Table
            columns={correctiveActionColumns}
            dataSource={correctiveActions}
            rowKey="id"
            pagination={false}
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="근본 원인">
                    {record.rootCause || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="재발 방지 대책">
                    {record.preventiveMeasures || '-'}
                  </Descriptions.Item>
                  {record.resultDescription && (
                    <Descriptions.Item label="수행 결과">
                      {record.resultDescription}
                    </Descriptions.Item>
                  )}
                  {record.verificationComment && (
                    <Descriptions.Item label="검증 의견">
                      {record.verificationComment}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              ),
              rowExpandable: (record) =>
                !!(record.rootCause || record.preventiveMeasures || record.resultDescription || record.verificationComment),
            }}
          />
        </Card>

        {nonConformity && (
          <NcEvidenceAttachments
            nonConformityId={nonConformity.id}
            canEdit={canCreate}
            onChange={setAttachedEvidences}
          />
        )}

        {canCreate && nonConformity && (
          <CorrectiveActionAssistant
            nonConformityId={nonConformity.id}
            aiHint={nonConformity.aiHint ?? null}
            onAiHintSaved={(hint) => {
              // 힌트 저장 성공 → 상위 상태도 즉시 갱신하여, 취소·재저장 시
              // 또 다른 fetch 없이 모달에 바로 반영되게 한다.
              setNonConformity((prev) => (prev ? { ...prev, aiHint: hint } : prev))
            }}
            availableEvidences={attachedEvidences.map((a) => ({
              id: a.evidenceId,
              title: a.title,
              mimeType: a.mimeType,
              fileName: a.fileName,
            }))}
            onApplyToCorrectiveAction={handleApplyDraftToCorrectiveAction}
          />
        )}

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

        {/* Add/Edit Corrective Action Modal */}
        <Modal
          title={editingCA ? '시정조치 수정' : '시정조치 추가'}
          open={isAddingAction || !!editingCA}
          onCancel={() => {
            setIsAddingAction(false)
            setEditingCA(null)
            actionForm.resetFields()
          }}
          onOk={editingCA ? handleUpdateCorrectiveAction : handleSaveCorrectiveAction}
          okText={editingCA ? '저장' : '추가'}
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
              name="responsiblePersonIds"
              label="담당자"
              rules={[{ required: true, message: '담당자를 선택해주세요' }]}
            >
              <Select placeholder="담당자 선택" mode="multiple" showSearch optionFilterProp="children" maxTagCount="responsive">
                {users.map((user) => (
                  <Option key={user.id} value={user.id}>
                    {user.name}
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
  users: PersonnelItem[]
  navigate: ReturnType<typeof useNavigate>
}) => {
  const { message } = App.useApp()
  const [searchParams] = useSearchParams()
  const controlItemIdParam = searchParams.get('controlItemId')
  const [createForm] = Form.useForm()
  const [controls, setControls] = useState<ControlItem[]>([])
  const [audits, setAudits] = useState<AuditPlan[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    controlService.getControls({ pageSize: 200 }).then((data) => {
      setControls(data.items || [])
    }).catch(() => {})
    if (!auditId) {
      auditService.getAudits({ pageSize: 200 }).then((data) => {
        setAudits(data.items || [])
      }).catch(() => {})
    }
  }, [auditId])

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
        responsiblePersonIds: values.responsiblePersonIds,
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
        {!auditId && (
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="auditPlanId"
                label="감사"
                rules={[{ required: true, message: '감사를 선택해주세요' }]}
              >
                <Select placeholder="감사 선택" showSearch optionFilterProp="children">
                  {audits.map((audit) => (
                    <Option key={audit.id} value={audit.id}>
                      {audit.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        )}
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
              name="responsiblePersonIds"
              label="담당자"
              rules={[{ required: true, message: '담당자를 선택해주세요' }]}
            >
              <Select placeholder="담당자 선택" mode="multiple" showSearch optionFilterProp="children" maxTagCount="responsive">
                {users.map((user) => (
                  <Option key={user.id} value={user.id}>
                    {user.name}
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
