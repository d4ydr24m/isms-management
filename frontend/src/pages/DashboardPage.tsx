import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Table,
  Tag,
  Typography,
  Spin,
  Alert,
  Badge,
  Space,
  Tooltip,
} from 'antd'
import {
  SafetyCertificateOutlined,
  FileTextOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  BugOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  dashboardService,
  type DashboardSummaryData,
  type ExpiringEvidenceItem,
  type ActivityItem,
  type DomainProgress,
} from '@/services/dashboard'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const DashboardPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardSummaryData | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const summary = await dashboardService.getSummary()
      setData(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : '대시보드를 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Alert
        type="error"
        message="대시보드 로드 실패"
        description={error}
        showIcon
        style={{ margin: 24 }}
      />
    )
  }

  const { progress, activities, expiringEvidences, pendingTasks, nonConformities } = data

  // Summary stat cards
  const statCards = [
    {
      title: '인증 준비 진척률',
      value: progress.totalProgress,
      suffix: '%',
      icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      color: '#1890ff',
    },
    {
      title: '증적 확보',
      value: progress.controlsWithEvidence,
      suffix: `/ ${progress.totalControls}`,
      icon: <FileTextOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      color: '#52c41a',
    },
    {
      title: '미완료 업무',
      value: pendingTasks.overdueTasks + pendingTasks.upcomingDeadlines,
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      color: '#faad14',
    },
    {
      title: '부적합 사항',
      value: nonConformities.total,
      icon: <BugOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
      color: '#ff4d4f',
    },
  ]

  // Expiring evidence table columns
  const evidenceColumns: ColumnsType<ExpiringEvidenceItem> = [
    {
      title: '증적',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record) => (
        <a onClick={() => navigate(`/evidence/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '통제항목',
      dataIndex: 'controlItemCodes',
      key: 'controls',
      width: 150,
      render: (codes: string[]) =>
        codes.length > 0 ? codes.map((c) => <Tag key={c}>{c}</Tag>) : '-',
    },
    {
      title: '만료일',
      dataIndex: 'validUntil',
      key: 'validUntil',
      width: 110,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD'),
    },
    {
      title: '남은 일수',
      dataIndex: 'daysRemaining',
      key: 'daysRemaining',
      width: 100,
      align: 'center',
      render: (days: number) => {
        const color = days <= 7 ? 'red' : days <= 14 ? 'orange' : 'green'
        return <Tag color={color}>{days}일</Tag>
      },
    },
  ]

  // Activity table columns
  const allActivities = [...activities.today, ...activities.thisWeek]
  const activityColumns: ColumnsType<ActivityItem> = [
    {
      title: '활동',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '유형',
      dataIndex: 'taskType',
      key: 'taskType',
      width: 100,
      render: (type: string) => {
        const labels: Record<string, string> = {
          scheduled_task: '정기 활동',
          audit: '감사',
          corrective_action: '시정조치',
        }
        return labels[type] || type
      },
    },
    {
      title: '예정일',
      dataIndex: 'nextExecutionAt',
      key: 'date',
      width: 110,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD'),
    },
    {
      title: '담당자',
      dataIndex: 'assigneeName',
      key: 'assignee',
      width: 100,
      render: (name: string | null) => name || '-',
    },
  ]

  // Domain progress columns
  const domainColumns: ColumnsType<DomainProgress> = [
    {
      title: '영역',
      dataIndex: 'domainName',
      key: 'domainName',
      ellipsis: true,
      render: (name: string, record) => (
        <Tooltip title={record.domainCode}>
          <Text>{name}</Text>
        </Tooltip>
      ),
    },
    {
      title: '진척률',
      dataIndex: 'progressRate',
      key: 'progressRate',
      width: 200,
      render: (rate: number) => (
        <Progress
          percent={Math.round(rate)}
          size="small"
          status={rate >= 100 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '확보',
      key: 'count',
      width: 80,
      align: 'center',
      render: (_: unknown, record) =>
        `${record.controlsWithEvidence}/${record.totalControls}`,
    },
  ]

  const severityLabels: Record<string, string> = {
    critical: '중대',
    major: '주요',
    minor: '경미',
    observation: '관찰',
  }

  const statusLabels: Record<string, string> = {
    pending: '대기',
    in_progress: '진행 중',
    completed: '완료',
    verified: '검증 완료',
  }

  const statusColors: Record<string, string> = {
    pending: 'default',
    in_progress: 'processing',
    completed: 'success',
    verified: 'cyan',
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>ISMS-P 인증 대시보드</Title>

      {/* Row 1: Summary Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card, idx) => (
          <Col xs={24} sm={12} lg={6} key={idx}>
            <Card hoverable>
              <Space align="start" size="large">
                {card.icon}
                <Statistic
                  title={card.title}
                  value={card.value}
                  suffix={card.suffix}
                  valueStyle={{ color: card.color }}
                />
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Row 2: Progress + Pending Tasks */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Overall Progress */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                <span>인증 준비 현황</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Progress
                type="dashboard"
                percent={Math.round(progress.totalProgress)}
                format={(percent) => `${percent}%`}
                size={160}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  {progress.controlsWithEvidence} / {progress.totalControls} 통제항목 증적 확보
                </Text>
              </div>
            </div>
          </Card>
        </Col>

        {/* Pending Tasks */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>미완료 업무</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  <Text>기한 초과 업무</Text>
                </Space>
                <Badge count={pendingTasks.overdueTasks} showZero overflowCount={99}
                  style={{ backgroundColor: pendingTasks.overdueTasks > 0 ? '#ff4d4f' : '#d9d9d9' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <CalendarOutlined style={{ color: '#faad14' }} />
                  <Text>7일 내 마감 예정</Text>
                </Space>
                <Badge count={pendingTasks.upcomingDeadlines} showZero overflowCount={99}
                  style={{ backgroundColor: pendingTasks.upcomingDeadlines > 0 ? '#faad14' : '#d9d9d9' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <WarningOutlined style={{ color: '#fa8c16' }} />
                  <Text>미완료 시정조치</Text>
                </Space>
                <Badge count={pendingTasks.uncompletedCorrectiveActions} showZero overflowCount={99}
                  style={{ backgroundColor: pendingTasks.uncompletedCorrectiveActions > 0 ? '#fa8c16' : '#d9d9d9' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  <Text>미확보 증적 통제항목</Text>
                </Space>
                <Badge count={pendingTasks.controlsWithoutEvidence} showZero overflowCount={99}
                  style={{ backgroundColor: pendingTasks.controlsWithoutEvidence > 0 ? '#1890ff' : '#d9d9d9' }} />
              </div>
            </Space>
          </Card>
        </Col>

        {/* Non-Conformity Summary */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <BugOutlined />
                <span>부적합 현황</span>
                {nonConformities.total > 0 && (
                  <Tag color="red">{nonConformities.total}건</Tag>
                )}
              </Space>
            }
            style={{ height: '100%' }}
          >
            {nonConformities.total === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">등록된 부적합 사항이 없습니다</Text>
                </div>
              </div>
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>심각도별</Text>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {Object.entries(nonConformities.bySeverity).map(([key, val]) => (
                      <Tag key={key} color={key === 'critical' ? 'red' : key === 'major' ? 'orange' : 'blue'}>
                        {severityLabels[key] || key}: {val}
                      </Tag>
                    ))}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>상태별</Text>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {Object.entries(nonConformities.byStatus).map(([key, val]) => (
                      <Tag key={key} color={statusColors[key] || 'default'}>
                        {statusLabels[key] || key}: {val}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* Row 3: Domain Progress + Expiring Evidence */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                <span>영역별 증적 확보 현황</span>
              </Space>
            }
          >
            <Table
              columns={domainColumns}
              dataSource={progress.domainProgress}
              rowKey="domainId"
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                <span>만료 예정 증적</span>
                {expiringEvidences.count > 0 && (
                  <Tag color="warning">{expiringEvidences.count}건</Tag>
                )}
              </Space>
            }
          >
            {expiringEvidences.evidences.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">30일 내 만료 예정 증적이 없습니다</Text>
                </div>
              </div>
            ) : (
              <Table
                columns={evidenceColumns}
                dataSource={expiringEvidences.evidences}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Row 4: Upcoming Activities */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>예정 보안 활동</span>
                {allActivities.length > 0 && (
                  <Tag color="blue">{allActivities.length}건</Tag>
                )}
              </Space>
            }
          >
            {allActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">금주 예정된 보안 활동이 없습니다</Text>
                </div>
              </div>
            ) : (
              <Table
                columns={activityColumns}
                dataSource={allActivities}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
