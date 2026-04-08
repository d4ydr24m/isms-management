/**
 * 자산 상세 페이지
 * FR-502, FR-503, FR-504, FR-505
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Row,
  Col,
  message,
  Modal,
  Breadcrumb,
  Tabs,
  List,
  Avatar,
  Spin,
  Form,
  Select,
  Input,
} from 'antd'
import {
  HomeOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { apiClient } from '@/services/api'
import CIAEvaluation from './components/CIAEvaluation'
import AssetHistory from './components/AssetHistory'
import { assetService } from '@/services/assets'
import type {
  Asset,
  AssetValuation,
  AssetHistory as AssetHistoryType,
  AssetAssignment,
  AssetValuationCreate,
  AssetStatus,
} from '@/types'

/** 상태 태그 색상 */
const statusColorMap: Record<AssetStatus, string> = {
  introduced: 'blue',
  operating: 'green',
  changed: 'orange',
  disposed: 'default',
}

const statusLabelMap: Record<AssetStatus, string> = {
  introduced: '도입',
  operating: '운영',
  changed: '변경',
  disposed: '폐기',
}

const AssetDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const assetId = Number(id)

  const [asset, setAsset] = useState<Asset | null>(null)
  const [valuation, setValuation] = useState<AssetValuation | null>(null)
  const [history, setHistory] = useState<AssetHistoryType[]>([])
  const [assignments, setAssignments] = useState<AssetAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: number; name: string; email: string }>>([])
  const [assignForm] = Form.useForm()

  // 자산 상세 정보 로드
  const fetchAsset = useCallback(async () => {
    if (!assetId) return
    setLoading(true)
    try {
      const data = await assetService.getAsset(assetId)
      setAsset(data)
    } catch {
      message.error('자산 정보를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [assetId])

  // CIA 평가 로드
  const fetchValuation = useCallback(async () => {
    if (!assetId) return
    try {
      const data = await assetService.getAssetValuation(assetId)
      setValuation(data)
    } catch {
      // 평가가 없는 경우 무시
      setValuation(null)
    }
  }, [assetId])

  // 변경 이력 로드
  const fetchHistory = useCallback(async () => {
    if (!assetId) return
    setHistoryLoading(true)
    try {
      const data = await assetService.getAssetHistory(assetId)
      setHistory(data)
    } catch {
      message.error('변경 이력을 불러오는데 실패했습니다')
    } finally {
      setHistoryLoading(false)
    }
  }, [assetId])

  // 담당자 로드
  const fetchAssignments = useCallback(async () => {
    if (!assetId) return
    try {
      const data = await assetService.getAssetAssignments(assetId)
      setAssignments(data)
    } catch {
      // 담당자가 없는 경우 무시
    }
  }, [assetId])

  useEffect(() => {
    fetchAsset()
    fetchValuation()
    fetchHistory()
    fetchAssignments()
  }, [fetchAsset, fetchValuation, fetchHistory, fetchAssignments])

  // CIA 평가 업데이트 핸들러
  const handleValuationUpdate = async (data: AssetValuationCreate) => {
    await assetService.createAssetValuation(assetId, data)
    await fetchValuation()
    await fetchHistory()
  }

  // 담당자 목록 로드 (담당자 관리에서)
  const loadUsers = useCallback(async () => {
    try {
      const res = await apiClient.get('/personnel/search', { params: { q: '' } })
      const items = Array.isArray(res.data) ? res.data : (res.data as any)?.items || []
      setAvailableUsers(items)
    } catch (err) {
      console.error('담당자 목록 로드 실패:', err)
    }
  }, [])

  // 담당자 추가 핸들러
  const handleAddAssignment = async (values: { userId: number; role: string; remarks?: string }) => {
    try {
      await assetService.createAssetAssignment(assetId, values)
      message.success('담당자가 추가되었습니다')
      assignForm.resetFields()
      setAssignModalVisible(false)
      await fetchAssignments()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '담당자 추가에 실패했습니다')
    }
  }

  // 담당자 삭제 핸들러
  const handleRemoveAssignment = async (assignmentId: number) => {
    try {
      await assetService.updateAssetAssignment(assetId, assignmentId, { isActive: false })
      message.success('담당자가 제거되었습니다')
      await fetchAssignments()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '담당자 제거에 실패했습니다')
    }
  }

  // 삭제 핸들러
  const handleDelete = () => {
    Modal.confirm({
      title: '자산 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 자산을 삭제하시겠습니까? 삭제된 자산은 복구할 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await assetService.deleteAsset(assetId)
          message.success('자산이 삭제되었습니다')
          navigate('/assets')
        } catch (err: any) {
          const detail = err?.response?.data?.detail || err?.message
          message.error(detail || '자산 삭제에 실패했습니다')
        }
      },
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <p>자산을 찾을 수 없습니다.</p>
        <Button onClick={() => navigate('/assets')}>목록으로</Button>
      </div>
    )
  }

  const tabItems = [
    {
      key: 'info',
      label: '기본 정보',
      children: (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}>
            <Card title="상세 정보">
              <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                <Descriptions.Item label="자산코드">
                  <code>{asset.assetCode}</code>
                </Descriptions.Item>
                <Descriptions.Item label="자산명">
                  {asset.name}
                </Descriptions.Item>
                <Descriptions.Item label="자산 유형">
                  {asset.assetTypeName}
                </Descriptions.Item>
                <Descriptions.Item label="분류">
                  {asset.categoryNames?.length ? asset.categoryNames.join(', ') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="상태">
                  <Tag color={statusColorMap[asset.status]}>
                    {statusLabelMap[asset.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="위치">
                  {asset.location || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="담당 부서">
                  {asset.departmentName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="소유자">
                  {asset.personnelOwnerName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="담당자">
                  {asset.assigneeNames && asset.assigneeNames.length > 0 ? asset.assigneeNames.join(', ') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="IP 주소">
                  {asset.ipAddress ? <code>{asset.ipAddress}</code> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="호스트명">
                  {asset.hostname || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="MAC 주소">
                  {asset.macAddress ? <code>{asset.macAddress}</code> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="OS 버전">
                  {asset.osVersion || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="URL">
                  {asset.url ? <a href={asset.url} target="_blank" rel="noopener noreferrer">{asset.url}</a> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="버전">
                  {asset.serviceVersion || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="제조사">
                  {asset.manufacturer || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="모델명">
                  {asset.model || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="시리얼 번호">
                  {asset.serialNumber ? <code>{asset.serialNumber}</code> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="취득일">
                  {asset.acquisitionDate || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="취득 비용">
                  {asset.acquisitionCost ? `${asset.acquisitionCost.toLocaleString()}원` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="보증 만료일">
                  {asset.warrantyEndDate || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="등록일">
                  {asset.createdAt?.substring(0, 10) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="수정일">
                  {asset.updatedAt?.substring(0, 10) || '-'}
                </Descriptions.Item>
              </Descriptions>

              {asset.description && (
                <div style={{ marginTop: 16 }}>
                  <strong>설명</strong>
                  <p style={{ marginTop: 8, color: '#666' }}>{asset.description}</p>
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <CIAEvaluation
              valuation={valuation || undefined}
              assetId={assetId}
              onUpdate={handleValuationUpdate}
            />
          </Col>
        </Row>
      ),
    },
    {
      key: 'assignments',
      label: '담당자',
      children: (
        <>
          <Card
            title="담당자 목록"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  loadUsers()
                  setAssignModalVisible(true)
                }}
              >
                담당자 추가
              </Button>
            }
          >
            {assignments.filter(a => a.isActive).length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={assignments.filter(a => a.isActive)}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="link"
                        danger
                        size="small"
                        onClick={() => handleRemoveAssignment(item.id)}
                      >
                        제거
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={
                        <Space>
                          {item.userName}
                          <Tag color={item.role === 'owner' ? 'gold' : item.role === 'manager' ? 'blue' : 'default'}>
                            {item.role === 'owner' ? '소유자' : item.role === 'manager' ? '관리자' : '사용자'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <>
                          <div>{item.userEmail}</div>
                          <div>
                            <small>할당일: {item.assignedAt?.substring(0, 10)}</small>
                            {item.remarks && <small> | {item.remarks}</small>}
                          </div>
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                등록된 담당자가 없습니다.
              </div>
            )}
          </Card>

          <Modal
            title="담당자 추가"
            open={assignModalVisible}
            onCancel={() => {
              assignForm.resetFields()
              setAssignModalVisible(false)
            }}
            footer={null}
            forceRender
          >
            <Form form={assignForm} layout="vertical" onFinish={handleAddAssignment}>
              <Form.Item
                name="userId"
                label="담당자"
                rules={[{ required: true, message: '담당자를 선택해주세요' }]}
              >
                <Select
                  placeholder="담당자 선택"
                  showSearch
                  optionFilterProp="label"
                  options={availableUsers.map((u) => ({
                    value: u.id,
                    label: `${u.name}${u.email ? ` (${u.email})` : ''}`,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="role"
                label="역할"
                rules={[{ required: true, message: '역할을 선택해주세요' }]}
                initialValue="user"
              >
                <Select>
                  <Select.Option value="owner">소유자</Select.Option>
                  <Select.Option value="manager">관리자</Select.Option>
                  <Select.Option value="user">사용자</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="remarks" label="비고">
                <Input placeholder="비고 사항 입력" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">추가</Button>
                  <Button onClick={() => {
                    setAssignModalVisible(false)
                    assignForm.resetFields()
                  }}>취소</Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>
        </>
      ),
    },
    {
      key: 'history',
      label: '변경 이력',
      children: <AssetHistory history={history} loading={historyLoading} />,
    },
    {
      key: 'risks',
      label: '관련 위험',
      children: (
        <Card title="관련 위험 평가">
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <WarningOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <p>관련 위험 평가 정보는 Phase 2 위험 관리 모듈에서 확인할 수 있습니다.</p>
            <Button type="primary" disabled>
              위험 평가 보기
            </Button>
          </div>
        </Card>
      ),
    },
  ]

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/assets">정보자산 관리</Link> },
          { title: asset.name },
        ]}
      />

      <Card
        title={
          <Space>
            <span>{asset.name}</span>
            <Tag color={statusColorMap[asset.status]}>{statusLabelMap[asset.status]}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<CopyOutlined />}
              onClick={() => navigate('/assets/create', { state: { copyFrom: asset } })}
            >
              복제
            </Button>
            <Link to={`/assets/${assetId}/edit`}>
              <Button icon={<EditOutlined />}>수정</Button>
            </Link>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              삭제
            </Button>
          </Space>
        }
      >
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}

export default AssetDetailPage
