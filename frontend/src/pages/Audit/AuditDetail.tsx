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
  planned: '예정',
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
      title: '통제항목',
      key: 'control',
      width: 100,
      render: (_, record) => record.controlItem.number,
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
      title: '심각도',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: NonConformityType) => (
        <Tag color={severityColors[type]}>{type.toUpperCase()}</Tag>
      ),
    },
    {
      title: '상태',
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
              </Space>
            </Col>
          </Row>

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
            <Descriptions.Item label="감사원" span={2}>
              <Space>
                {audit.auditors.map((auditor) => (
                  <Tag key={auditor.id}>{auditor.name}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="작성자">{audit.createdByName}</Descriptions.Item>
            <Descriptions.Item label="작성일">{audit.createdAt}</Descriptions.Item>
            <Descriptions.Item label="수정일">{audit.updatedAt}</Descriptions.Item>
          </Descriptions>
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
