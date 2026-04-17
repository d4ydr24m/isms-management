import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  App,
  Card,
  Button,
  Space,
  Table,
  Select,
  Input,
  Tag,
  Progress,
  Modal,
  Row,
  Col,
  Typography,
  Tooltip,
  Checkbox,
} from 'antd'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  PaperClipOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { auditService } from '@/services/audits'
import { evidenceService } from '@/services/evidences'
import { usePermissions } from '@/hooks'
import type {
  AuditPlan,
  AuditChecklist,
  ChecklistResultType,
  EvidenceListItem,
} from '@/types'

const { TextArea } = Input
const { Option } = Select
const { Title, Text } = Typography

const resultColors: Record<ChecklistResultType, string> = {
  conformity: 'green',
  non_conformity: 'red',
  observation: 'orange',
  not_applicable: 'default',
}

const resultLabels: Record<ChecklistResultType, string> = {
  conformity: '적합',
  non_conformity: '부적합',
  observation: '관찰사항',
  not_applicable: '해당없음',
}

interface ChecklistItemEdit {
  id: number
  result: ChecklistResultType | null
  findings: string | null
  evidenceIds: number[]
  modified: boolean
}

const ChecklistPage = () => {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { auditId } = useParams<{ auditId: string }>()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission('audit:update')
  const canCreate = hasPermission('audit:create')
  const [audit, setAudit] = useState<AuditPlan | null>(null)
  const [checklist, setChecklist] = useState<AuditChecklist[]>([])
  const [editedItems, setEditedItems] = useState<Map<number, ChecklistItemEdit>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [evidences, setEvidences] = useState<EvidenceListItem[]>([])
  const [evidenceModalVisible, setEvidenceModalVisible] = useState(false)
  const [currentItemId, setCurrentItemId] = useState<number | null>(null)
  const [filterUnchecked, setFilterUnchecked] = useState(false)
  const [resultFilter, setResultFilter] = useState<ChecklistResultType | 'all'>('all')

  const fetchData = useCallback(async () => {
    if (!auditId) return

    setLoading(true)
    try {
      const [auditData, checklistData, evidenceData] = await Promise.all([
        auditService.getAudit(Number(auditId)),
        auditService.getChecklist(Number(auditId)),
        evidenceService.getEvidences({ size: 100 }),
      ])
      setAudit(auditData)
      setChecklist(checklistData)
      setEvidences(evidenceData.items || [])

      // Initialize edited items from backend data
      const initialEdits = new Map<number, ChecklistItemEdit>()
      checklistData.forEach((item) => {
        const lr = item.latestResult
        const evidenceIds = lr?.evidenceReference
          ? lr.evidenceReference.split(',').map(Number).filter((n) => !isNaN(n))
          : []
        initialEdits.set(item.id, {
          id: item.id,
          result: (lr?.result as ChecklistResultType) || null,
          findings: lr?.finding || null,
          evidenceIds,
          modified: false,
        })
      })
      setEditedItems(initialEdits)
    } catch {
      message.error('체크리스트를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [auditId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleBack = () => {
    navigate(`/audits/${auditId}`)
  }

  const handleResultChange = (itemId: number, result: ChecklistResultType | null) => {
    setEditedItems((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemId)
      if (existing) {
        newMap.set(itemId, { ...existing, result, modified: true })
      }
      return newMap
    })
  }

  const handleFindingsChange = (itemId: number, findings: string) => {
    setEditedItems((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(itemId)
      if (existing) {
        newMap.set(itemId, { ...existing, findings, modified: true })
      }
      return newMap
    })
  }

  const handleOpenEvidenceModal = (itemId: number) => {
    setCurrentItemId(itemId)
    setEvidenceModalVisible(true)
  }

  const handleEvidenceSelect = (evidenceIds: number[]) => {
    if (currentItemId === null) return

    setEditedItems((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(currentItemId)
      if (existing) {
        newMap.set(currentItemId, { ...existing, evidenceIds, modified: true })
      }
      return newMap
    })
    setEvidenceModalVisible(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const modifiedItems = Array.from(editedItems.values()).filter((item) => item.modified)

      await Promise.all(
        modifiedItems.map((item) =>
          auditService.updateChecklistItem(Number(auditId), item.id, {
            result: item.result!,
            finding: item.findings || undefined,
            evidenceReference: item.evidenceIds.length > 0
              ? item.evidenceIds.join(',')
              : undefined,
          })
        )
      )

      message.success('체크리스트가 저장되었습니다')

      // Reset modified flags
      setEditedItems((prev) => {
        const newMap = new Map(prev)
        newMap.forEach((item, key) => {
          newMap.set(key, { ...item, modified: false })
        })
        return newMap
      })
    } catch {
      message.error('체크리스트 저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = () => {
    const uncheckedCount = Array.from(editedItems.values()).filter(
      (item) => item.result === null
    ).length

    if (uncheckedCount > 0) {
      modal.confirm({
        title: '감사 완료 확인',
        content: `미점검 항목이 ${uncheckedCount}건 있습니다. 감사를 완료하시겠습니까?`,
        okText: '확인',
        cancelText: '취소',
        onOk: async () => {
          try {
            await auditService.updateAudit(Number(auditId), { status: 'completed' })
            message.success('감사가 완료되었습니다')
            navigate(`/audits/${auditId}`)
          } catch {
            message.error('감사 완료에 실패했습니다')
          }
        },
      })
    } else {
      modal.confirm({
        title: '감사 완료 확인',
        content: '이 감사를 완료하시겠습니까?',
        okText: '확인',
        cancelText: '취소',
        onOk: async () => {
          try {
            await auditService.updateAudit(Number(auditId), { status: 'completed' })
            message.success('감사가 완료되었습니다')
            navigate(`/audits/${auditId}`)
          } catch {
            message.error('감사 완료에 실패했습니다')
          }
        },
      })
    }
  }

  const handleRegisterNonConformity = (itemId: number) => {
    const item = checklist.find((c) => c.id === itemId)
    if (item) {
      navigate(`/audits/${auditId}/non-conformities/create?controlItemId=${item.controlItemId}`)
    }
  }

  // Calculate progress
  const progressData = useMemo(() => {
    const checked = Array.from(editedItems.values()).filter((item) => item.result !== null).length
    const total = editedItems.size
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0
    return { checked, total, percent }
  }, [editedItems])

  // Filter checklist
  const filteredChecklist = useMemo(() => {
    let result = checklist

    if (filterUnchecked) {
      result = result.filter((item) => {
        const edited = editedItems.get(item.id)
        return edited?.result === null
      })
    }

    if (resultFilter !== 'all') {
      result = result.filter((item) => {
        const edited = editedItems.get(item.id)
        return edited?.result === resultFilter
      })
    }

    return result
  }, [checklist, editedItems, filterUnchecked, resultFilter])

  const columns: ColumnsType<AuditChecklist> = [
    {
      title: '번호',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 60,
      align: 'center',
    },
    {
      title: '통제항목',
      key: 'controlItem',
      width: 300,
      render: (_, record) => (
        <div>
          <Text strong>{record.controlItemCode || '-'}</Text>
          <br />
          <Text>{record.controlItemTitle || record.question}</Text>
        </div>
      ),
    },
    {
      title: '결과',
      key: 'result',
      width: 180,
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        return (
          <Select
            style={{ width: '100%' }}
            value={edited?.result || undefined}
            onChange={(value) => handleResultChange(record.id, value)}
            placeholder="결과 선택"
            aria-label="result"
          >
            <Option value="conformity">
              <Tag color={resultColors.conformity}>{resultLabels.conformity}</Tag>
            </Option>
            <Option value="non_conformity">
              <Tag color={resultColors.non_conformity}>{resultLabels.non_conformity}</Tag>
            </Option>
            <Option value="observation">
              <Tag color={resultColors.observation}>{resultLabels.observation}</Tag>
            </Option>
            <Option value="not_applicable">
              <Tag color={resultColors.not_applicable}>{resultLabels.not_applicable}</Tag>
            </Option>
          </Select>
        )
      },
    },
    {
      title: '소견/비고',
      key: 'findings',
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        return (
          <TextArea
            rows={2}
            value={edited?.findings || ''}
            onChange={(e) => handleFindingsChange(record.id, e.target.value)}
            placeholder="소견 또는 비고 입력"
          />
        )
      },
    },
    {
      title: '증적',
      key: 'evidence',
      width: 150,
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        const attachedEvidences = evidences.filter((e) =>
          (edited?.evidenceIds || []).includes(e.id)
        )
        return (
          <Space direction="vertical" size="small">
            {attachedEvidences.map((e) => (
              <Tooltip key={e.id} title={e.fileName}>
                <Tag>{e.title}</Tag>
              </Tooltip>
            ))}
            {canUpdate && (
              <Button
                size="small"
                icon={<PaperClipOutlined />}
                onClick={() => handleOpenEvidenceModal(record.id)}
                aria-label="증적 첨부"
              >
                증적 첨부
              </Button>
            )}
          </Space>
        )
      },
    },
    {
      title: '작업',
      key: 'actions',
      width: 150,
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        if (edited?.result === 'non_conformity' && canCreate) {
          return (
            <Button
              type="link"
              icon={<ExclamationCircleOutlined />}
              onClick={() => handleRegisterNonConformity(record.id)}
              aria-label="부적합 등록"
            >
              부적합 등록
            </Button>
          )
        }
        return null
      },
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack} aria-label="뒤로">
                  뒤로
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  {audit?.title || '체크리스트'}
                </Title>
              </Space>
            </Col>
            <Col>
              <Space>
                {canUpdate && (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    aria-label="저장"
                  >
                    저장
                  </Button>
                )}
                {canUpdate && (
                  <Button
                    icon={<CheckCircleOutlined />}
                    onClick={handleComplete}
                    aria-label="감사 완료"
                  >
                    감사 완료
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        <Card>
          <Row gutter={16} align="middle">
            <Col xs={24} md={8}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>진행률</Text>
                <Progress percent={progressData.percent} status="active" />
                <Text type="secondary">
                  {progressData.checked} / {progressData.total} 항목 점검 완료 ({progressData.percent}%)
                </Text>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space>
                <Text>필터:</Text>
                <Checkbox
                  checked={filterUnchecked}
                  onChange={(e) => setFilterUnchecked(e.target.checked)}
                >
                  미점검만 보기
                </Checkbox>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space>
                <Text>결과 필터:</Text>
                <Select
                  style={{ width: 150 }}
                  value={resultFilter ?? undefined}
                  onChange={setResultFilter}
                >
                  <Option value="all">전체</Option>
                  <Option value="conformity">적합</Option>
                  <Option value="non_conformity">부적합</Option>
                  <Option value="observation">관찰사항</Option>
                  <Option value="not_applicable">해당없음</Option>
                </Select>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card>
          <Table
            columns={columns}
            dataSource={filteredChecklist}
            rowKey="id"
            loading={loading}
            pagination={false}
            scroll={{ x: 1200 }}
          />
        </Card>

        <Modal
          title="증적 선택"
          open={evidenceModalVisible}
          onCancel={() => setEvidenceModalVisible(false)}
          footer={null}
          width={600}
        >
          <Table
            dataSource={evidences}
            rowKey="id"
            size="small"
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: currentItemId
                ? editedItems.get(currentItemId)?.evidenceIds || []
                : [],
              onChange: (selectedRowKeys) => {
                handleEvidenceSelect(selectedRowKeys as number[])
              },
            }}
            columns={[
              { title: '제목', dataIndex: 'title', key: 'title' },
              { title: '파일명', dataIndex: 'fileName', key: 'fileName' },
              { title: '버전', dataIndex: 'version', key: 'version', width: 80 },
            ]}
            pagination={{ pageSize: 10 }}
          />
        </Modal>
      </Space>
    </div>
  )
}

export default ChecklistPage
