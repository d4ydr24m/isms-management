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
  Progress,
  Table,
  Typography,
  Spin,
  Statistic,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { auditService } from '@/services/audits'
import type { AuditPlan, AuditChecklist, NonConformity, AuditStatus, NonConformityType } from '@/types'

const { Title, Text } = Typography

const statusColors: Record<AuditStatus, string> = {
  planned: 'blue',
  in_progress: 'orange',
  completed: 'green',
  cancelled: 'default',
}

const statusLabels: Record<AuditStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const auditTypeLabels: Record<string, string> = {
  internal: 'Internal',
  external: 'External',
  certification: 'Certification',
  surveillance: 'Surveillance',
}

const severityColors: Record<NonConformityType, string> = {
  critical: 'red',
  major: 'orange',
  minor: 'gold',
  observation: 'blue',
}

const AuditDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [audit, setAudit] = useState<AuditPlan | null>(null)
  const [checklist, setChecklist] = useState<AuditChecklist[]>([])
  const [nonConformities, setNonConformities] = useState<NonConformity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const [auditData, checklistData, ncData] = await Promise.all([
        auditService.getAudit(Number(id)),
        auditService.getChecklist(Number(id)),
        auditService.getNonConformities({ auditId: Number(id), limit: 100 }),
      ])
      setAudit(auditData)
      setChecklist(checklistData)
      setNonConformities(ncData.data || [])
    } catch {
      // Error handling
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleBack = () => {
    navigate('/audits')
  }

  const handleEdit = () => {
    navigate(`/audits/${id}/edit`)
  }

  const handleViewChecklist = () => {
    navigate(`/audits/${id}/checklist`)
  }

  const handleRegisterNonConformity = () => {
    navigate(`/audits/${id}/non-conformities/create`)
  }

  const handleNonConformityClick = (record: NonConformity) => {
    navigate(`/non-conformities/${record.id}`)
  }

  // Calculate checklist progress
  const checkedItems = checklist.filter((item) => item.result !== null).length
  const totalItems = checklist.length
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

  // Calculate severity statistics
  const severityStats = {
    critical: nonConformities.filter((nc) => nc.type === 'critical').length,
    major: nonConformities.filter((nc) => nc.type === 'major').length,
    minor: nonConformities.filter((nc) => nc.type === 'minor').length,
    observation: nonConformities.filter((nc) => nc.type === 'observation').length,
  }

  const nonConformityColumns: ColumnsType<NonConformity> = [
    {
      title: 'Control',
      key: 'control',
      width: 100,
      render: (_, record) => record.controlItem.number,
    },
    {
      title: 'Title',
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
      title: 'Severity',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: NonConformityType) => (
        <Tag color={severityColors[type]}>{type.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const colors: Record<string, string> = {
          pending: 'default',
          in_progress: 'processing',
          completed: 'success',
          verified: 'cyan',
          rejected: 'error',
        }
        return <Tag color={colors[status] || 'default'}>{status.replace('_', ' ').toUpperCase()}</Tag>
      },
    },
    {
      title: 'Due Date',
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
        <Text>Audit not found</Text>
      </Card>
    )
  }

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack} aria-label="Back">
              Back
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
                <Button icon={<EditOutlined />} onClick={handleEdit} aria-label="Edit">
                  Edit
                </Button>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={handleViewChecklist}
                  aria-label="View Checklist"
                >
                  View Checklist
                </Button>
                <Button
                  icon={<ExclamationCircleOutlined />}
                  onClick={handleRegisterNonConformity}
                  aria-label="Register Non-conformity"
                >
                  Register Non-conformity
                </Button>
              </Space>
            </Col>
          </Row>

          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Type">
              <Tag>{auditTypeLabels[audit.auditType] || audit.auditType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColors[audit.status]}>{statusLabels[audit.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Period">
              {audit.startDate} ~ {audit.endDate}
            </Descriptions.Item>
            <Descriptions.Item label="Scope" span={3}>
              {audit.scope}
            </Descriptions.Item>
            <Descriptions.Item label="Auditors" span={2}>
              <Space>
                {audit.auditors.map((auditor) => (
                  <Tag key={auditor.id}>{auditor.name}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Created By">{audit.createdByName}</Descriptions.Item>
            <Descriptions.Item label="Created At">{audit.createdAt}</Descriptions.Item>
            <Descriptions.Item label="Updated At">{audit.updatedAt}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card title="Checklist Progress" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Progress percent={progressPercent} status="active" />
                <Text type="secondary">
                  {checkedItems} / {totalItems} items checked
                </Text>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Non-conformities" size="small">
              <Row gutter={8}>
                <Col span={6}>
                  <Statistic
                    title="Critical"
                    value={severityStats.critical}
                    valueStyle={{ color: '#f5222d', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Major"
                    value={severityStats.major}
                    valueStyle={{ color: '#fa8c16', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Minor"
                    value={severityStats.minor}
                    valueStyle={{ color: '#faad14', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Total"
                    value={audit.nonConformityCount}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Card title="Non-conformity List">
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
