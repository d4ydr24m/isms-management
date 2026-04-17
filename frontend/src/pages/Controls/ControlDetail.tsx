import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
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
import { EvidenceLinks } from './components'
import { usePermissions } from '@/hooks'
import type { ControlItemDetail, EvidenceSummary } from '@/types'

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
  const location = useLocation()
  const { hasPermission } = usePermissions()
  const canCreateEvidence = hasPermission('evidence:create')
  const fromState = location.state as { page?: number; pageSize?: number } | null
  const [control, setControl] = useState<ControlItemDetail | null>(null)
  const [evidences, setEvidences] = useState<any[]>([])
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

  const fetchEvidences = useCallback(async () => {
    if (!id) return
    try {
      const data = await controlService.getControlEvidences(parseInt(id, 10))
      setEvidences(data || [])
    } catch {
      // ignore
    }
  }, [id])

  useEffect(() => {
    fetchControl()
    fetchEvidences()
  }, [fetchControl, fetchEvidences])

  const handleBack = () => {
    const params = new URLSearchParams()
    if (fromState?.page) params.set('page', String(fromState.page))
    if (fromState?.pageSize) params.set('pageSize', String(fromState.pageSize))
    const query = params.toString()
    navigate(`/controls${query ? `?${query}` : ''}`)
  }

  const handleEvidenceClick = (evidenceId: number) => {
    navigate(`/evidence/${evidenceId}`)
  }

  const handleRelatedControlClick = (controlId: number) => {
    navigate(`/controls/${controlId}`)
  }

  const handleLinkEvidence = () => {
    const returnPath = encodeURIComponent(`/controls/${id}`)
    navigate(`/evidence/create?controlId=${id}&returnTo=${returnPath}`)
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
                    {control.code}
                  </Title>
                  <Title level={3} style={{ margin: 0 }}>
                    {control.title}
                  </Title>
                  {control.isRequired && <Tag color="red">필수</Tag>}
                </Space>
              </Col>
            </Row>

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
                canCreateEvidence ? (
                  <Button
                    type="primary"
                    icon={<LinkOutlined />}
                    onClick={handleLinkEvidence}
                    aria-label="증적 연결"
                  >
                    증적 연결
                  </Button>
                ) : null
              }
            >
              {evidences.length > 0 ? (
                <List
                  dataSource={evidences}
                  renderItem={(evidence: any) => (
                    <List.Item
                      key={evidence.id}
                      actions={[
                        <Tag color={statusColors[evidence.status] || 'default'}>
                          {{ active: '유효', draft: '초안', expired: '만료', archived: '보관' }[evidence.status as string] || evidence.status}
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
            <Card title="상세 정보">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="필수 여부">
                  {control.isRequired ? <Tag color="red">필수</Tag> : <Tag>선택</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="개인정보 관련">
                  {control.isPersonalInfo ? <Tag color="blue">해당</Tag> : <Tag>비해당</Tag>}
                </Descriptions.Item>
                {control.objective && (
                  <Descriptions.Item label="통제 목적">
                    {control.objective}
                  </Descriptions.Item>
                )}
                {control.requirements && (
                  <Descriptions.Item label="요구사항">
                    {control.requirements}
                  </Descriptions.Item>
                )}
                {control.tags && (
                  <Descriptions.Item label="태그">
                    <Space wrap>
                      {control.tags.split(',').map((tag) => (
                        <Tag key={tag.trim()}>{tag.trim()}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <div style={{ marginTop: 16 }}>
              <EvidenceLinks controlId={control.id} />
            </div>
          </Col>
        </Row>

        {/* 주요 확인사항 */}
        {control.keyChecks && typeof control.keyChecks === 'string' && (
          <Card title="주요 확인사항" style={{ marginTop: 16 }}>
            <div>
              {String(control.keyChecks).split('\n').filter((l) => l.trim().length > 1).map((line, i) => {
                const cleaned = line.trim().replace(/^[□■●○▶◆\s]+/, '')
                if (!cleaned) return null
                return (
                  <Paragraph key={i} style={{ marginBottom: 8 }}>
                    <CheckCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                    {cleaned}
                  </Paragraph>
                )
              })}
            </div>
          </Card>
        )}

        {/* 관련 법규 */}
        {control.relatedLaws && typeof control.relatedLaws === 'string' && String(control.relatedLaws).trim() && (
          <Card title="관련 법규" style={{ marginTop: 16 }}>
            <div>
              {String(control.relatedLaws).split('\n').filter((l) => l.trim().length > 1).map((law, i) => {
                const cleaned = law.trim().replace(/^[□■●○▶◆\s]+/, '')
                if (!cleaned) return null
                return <Tag key={i} color="blue" style={{ marginBottom: 8, whiteSpace: 'normal' }}>{cleaned}</Tag>
              })}
            </div>
          </Card>
        )}

        {/* 증거자료 예시 */}
        {control.evidenceExamples && typeof control.evidenceExamples === 'string' && (
          <Card title="증거자료 예시" style={{ marginTop: 16 }}>
            <div>
              {String(control.evidenceExamples).split('\n').filter((l) => l.trim().length > 1 && !l.trim().startsWith('사례')).map((example, i) => (
                <Paragraph key={i} style={{ marginBottom: 4 }}>
                  <FileTextOutlined style={{ color: '#52c41a', marginRight: 8 }} />{example.trim()}
                </Paragraph>
              ))}
            </div>
          </Card>
        )}
      </Space>
    </div>
  )
}

export default ControlDetailPage
