import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Space,
  Tag,
  Descriptions,
  List,
  Empty,
  Spin,
  Result,
  Badge,
  Divider,
} from 'antd'
import {
  ArrowLeftOutlined,
  LinkOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { controlService } from '@/services/controls'
import type { ControlItemDetail, EvidenceSummary, ControlItem } from '@/types'

const { Title, Text, Paragraph } = Typography

const statusColors: Record<string, string> = {
  active: 'green',
  draft: 'orange',
  expired: 'red',
  archived: 'default',
}

const ControlDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [control, setControl] = useState<ControlItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchControl = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setError(null)
    try {
      const data = await controlService.getControl(parseInt(id, 10))
      if (!data) {
        setError('통제항목을 찾을 수 없습니다')
      } else {
        setControl(data)
      }
    } catch {
      setError('통제항목을 불러오는 데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchControl()
  }, [fetchControl])

  const handleBack = () => {
    navigate(-1)
  }

  const handleEvidenceClick = (evidenceId: number) => {
    navigate(`/evidence/${evidenceId}`)
  }

  const handleRelatedControlClick = (controlId: number) => {
    navigate(`/controls/${controlId}`)
  }

  const handleLinkEvidence = () => {
    navigate(`/evidence/create?controlId=${id}`)
  }

  if (loading) {
    return (
      <div
        data-testid="loading-spinner"
        style={{ textAlign: 'center', padding: 100 }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (error || !control) {
    return (
      <Result
        status="error"
        title={error === '통제항목을 찾을 수 없습니다' ? '찾을 수 없음' : '불러오기 실패'}
        subTitle={error || '통제항목을 찾을 수 없습니다'}
        extra={
          <Button type="primary" onClick={handleBack}>
            뒤로 가기
          </Button>
        }
      />
    )
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              aria-label="뒤로"
            >
              뒤로
            </Button>

            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Title level={3} style={{ margin: 0 }}>
                    {control.number}
                  </Title>
                  <Title level={3} style={{ margin: 0 }}>
                    {control.title}
                  </Title>
                  {control.isRequired && <Tag color="red">필수</Tag>}
                </Space>
              </Col>
            </Row>

            {control.category && (
              <Text type="secondary">
                <FileTextOutlined /> {control.category.name}
              </Text>
            )}

            <Divider />

            <Descriptions column={1}>
              <Descriptions.Item label="설명">
                <Paragraph>{control.description}</Paragraph>
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Card>

        <Row gutter={16}>
          <Col xs={24} md={16}>
            <Card
              title={
                <Space>
                  <span>연결된 증적</span>
                  <Badge
                    count={control.evidenceCount}
                    style={{ backgroundColor: '#52c41a' }}
                  />
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={handleLinkEvidence}
                  aria-label="증적 연결"
                >
                  증적 연결
                </Button>
              }
            >
              {control.evidences && control.evidences.length > 0 ? (
                <List
                  dataSource={control.evidences}
                  renderItem={(evidence: EvidenceSummary) => (
                    <List.Item
                      key={evidence.id}
                      actions={[
                        <Tag color={statusColors[evidence.status]}>
                          {evidence.status}
                        </Tag>,
                        <Text type="secondary">v{evidence.version}</Text>,
                      ]}
                      onClick={() => handleEvidenceClick(evidence.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <List.Item.Meta
                        title={
                          <span
                            style={{ color: '#1890ff', cursor: 'pointer' }}
                          >
                            {evidence.title}
                          </span>
                        }
                        description={
                          <Space>
                            <Text type="secondary">
                              업로더: {evidence.uploaderName}
                            </Text>
                            {evidence.validUntil && (
                              <Text type="secondary">
                                유효기간: {evidence.validUntil}
                              </Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  description="연결된 증적이 없습니다"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card title="관련 통제항목">
              {control.relatedItems && control.relatedItems.length > 0 ? (
                <List
                  size="small"
                  dataSource={control.relatedItems}
                  renderItem={(item: ControlItem) => (
                    <List.Item
                      key={item.id}
                      onClick={() => handleRelatedControlClick(item.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Space style={{ width: '100%' }} direction="vertical">
                        <Space>
                          <Text strong>{item.number}</Text>
                          {item.hasEvidence ? (
                            <CheckCircleOutlined
                              style={{ color: '#52c41a' }}
                            />
                          ) : (
                            <CloseCircleOutlined
                              style={{ color: '#ff4d4f' }}
                            />
                          )}
                        </Space>
                        <Text
                          style={{ color: '#1890ff', cursor: 'pointer' }}
                        >
                          {item.title}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  description="관련 통제항목이 없습니다"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  )
}

export default ControlDetailPage
