import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Card,
  Button,
  Space,
  Table,
  Select,
  Input,
  Tag,
  Progress,
  Modal,
  message,
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
  conforming: 'green',
  non_conforming: 'red',
  observation: 'orange',
  not_applicable: 'default',
}

const resultLabels: Record<ChecklistResultType, string> = {
  conforming: 'Conforming',
  non_conforming: 'Non-conforming',
  observation: 'Observation',
  not_applicable: 'Not Applicable',
}

interface ChecklistItemEdit {
  id: number
  result: ChecklistResultType | null
  findings: string | null
  evidenceIds: number[]
  modified: boolean
}

const ChecklistPage = () => {
  const navigate = useNavigate()
  const { auditId } = useParams<{ auditId: string }>()
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
        evidenceService.getEvidences({ limit: 100 }),
      ])
      setAudit(auditData)
      setChecklist(checklistData)
      setEvidences(evidenceData.data || [])

      // Initialize edited items
      const initialEdits = new Map<number, ChecklistItemEdit>()
      checklistData.forEach((item) => {
        initialEdits.set(item.id, {
          id: item.id,
          result: item.result,
          findings: item.findings,
          evidenceIds: item.evidenceIds,
          modified: false,
        })
      })
      setEditedItems(initialEdits)
    } catch {
      message.error('Failed to load checklist')
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
            findings: item.findings || undefined,
            evidenceIds: item.evidenceIds,
          })
        )
      )

      message.success('Checklist saved successfully')

      // Reset modified flags
      setEditedItems((prev) => {
        const newMap = new Map(prev)
        newMap.forEach((item, key) => {
          newMap.set(key, { ...item, modified: false })
        })
        return newMap
      })
    } catch {
      message.error('Failed to save checklist')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = () => {
    const uncheckedCount = Array.from(editedItems.values()).filter(
      (item) => item.result === null
    ).length

    if (uncheckedCount > 0) {
      Modal.confirm({
        title: 'Confirm Complete Audit',
        content: `There are ${uncheckedCount} unchecked items. Are you sure you want to complete the audit?`,
        okText: 'Confirm',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            await auditService.updateAudit(Number(auditId), { status: 'completed' })
            message.success('Audit completed successfully')
            navigate(`/audits/${auditId}`)
          } catch {
            message.error('Failed to complete audit')
          }
        },
      })
    } else {
      Modal.confirm({
        title: 'Confirm Complete Audit',
        content: 'Are you sure you want to complete this audit?',
        okText: 'Confirm',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            await auditService.updateAudit(Number(auditId), { status: 'completed' })
            message.success('Audit completed successfully')
            navigate(`/audits/${auditId}`)
          } catch {
            message.error('Failed to complete audit')
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
      title: 'No.',
      dataIndex: 'order',
      key: 'order',
      width: 60,
      align: 'center',
    },
    {
      title: 'Control Item',
      key: 'controlItem',
      width: 300,
      render: (_, record) => (
        <div>
          <Text strong>{record.controlItem.number}</Text>
          <br />
          <Text>{record.controlItem.title}</Text>
        </div>
      ),
    },
    {
      title: 'Result',
      key: 'result',
      width: 180,
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        return (
          <Select
            style={{ width: '100%' }}
            value={edited?.result || undefined}
            onChange={(value) => handleResultChange(record.id, value)}
            placeholder="Select result"
            aria-label="result"
          >
            <Option value="conforming">
              <Tag color={resultColors.conforming}>{resultLabels.conforming}</Tag>
            </Option>
            <Option value="non_conforming">
              <Tag color={resultColors.non_conforming}>{resultLabels.non_conforming}</Tag>
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
      title: 'Findings/Notes',
      key: 'findings',
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        return (
          <TextArea
            rows={2}
            value={edited?.findings || ''}
            onChange={(e) => handleFindingsChange(record.id, e.target.value)}
            placeholder="Enter findings or notes"
          />
        )
      },
    },
    {
      title: 'Evidence',
      key: 'evidence',
      width: 150,
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        const attachedEvidences = evidences.filter((e) =>
          edited?.evidenceIds.includes(e.id)
        )
        return (
          <Space direction="vertical" size="small">
            {attachedEvidences.map((e) => (
              <Tooltip key={e.id} title={e.fileName}>
                <Tag>{e.title}</Tag>
              </Tooltip>
            ))}
            <Button
              size="small"
              icon={<PaperClipOutlined />}
              onClick={() => handleOpenEvidenceModal(record.id)}
              aria-label="Attach Evidence"
            >
              Attach Evidence
            </Button>
          </Space>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => {
        const edited = editedItems.get(record.id)
        if (edited?.result === 'non_conforming') {
          return (
            <Button
              type="link"
              icon={<ExclamationCircleOutlined />}
              onClick={() => handleRegisterNonConformity(record.id)}
              aria-label="Register Non-conformity"
            >
              Register Non-conformity
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
                <Button icon={<ArrowLeftOutlined />} onClick={handleBack} aria-label="Back">
                  Back
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  {audit?.title || 'Checklist'}
                </Title>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  aria-label="Save"
                >
                  Save
                </Button>
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={handleComplete}
                  aria-label="Complete Audit"
                >
                  Complete Audit
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card>
          <Row gutter={16} align="middle">
            <Col xs={24} md={8}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Progress</Text>
                <Progress percent={progressData.percent} status="active" />
                <Text type="secondary">
                  {progressData.checked} / {progressData.total} items checked ({progressData.percent}%)
                </Text>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space>
                <Text>Filter:</Text>
                <Checkbox
                  checked={filterUnchecked}
                  onChange={(e) => setFilterUnchecked(e.target.checked)}
                >
                  Show unchecked only
                </Checkbox>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space>
                <Text>Result Filter:</Text>
                <Select
                  style={{ width: 150 }}
                  value={resultFilter}
                  onChange={setResultFilter}
                >
                  <Option value="all">All</Option>
                  <Option value="conforming">Conforming</Option>
                  <Option value="non_conforming">Non-conforming</Option>
                  <Option value="observation">Observation</Option>
                  <Option value="not_applicable">Not Applicable</Option>
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
          title="Select Evidence"
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
              { title: 'Title', dataIndex: 'title', key: 'title' },
              { title: 'File Name', dataIndex: 'fileName', key: 'fileName' },
              { title: 'Version', dataIndex: 'version', key: 'version', width: 80 },
            ]}
            pagination={{ pageSize: 10 }}
          />
        </Modal>
      </Space>
    </div>
  )
}

export default ChecklistPage
