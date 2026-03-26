/**
 * 위협 DB 관리 페이지
 * FR-701: 위협 DB 관리
 *
 * 기능:
 * - 위협 목록 조회, 검색, 레벨/커스텀 필터
 * - 위협 CRUD (추가/수정/삭제)
 * - 위협 통계 (레벨별 분포, 전체/커스텀 건수)
 * - 위협 상세 정보 Drawer
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Button,
  Space,
  Table,
  Input,
  Select,
  Checkbox,
  message,
  Modal,
  Form,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic,
  Drawer,
  Descriptions,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { TableProps } from 'antd'
import { getThreats, createThreat, updateThreat, deleteThreat } from '@/services/risks'
import type { Threat, ThreatCreate, ThreatUpdate } from '@/types'
import { THREAT_LEVELS as THREAT_LEVEL_OPTIONS } from '@/types'
import dayjs from 'dayjs'

const { Search } = Input
const { Text } = Typography

interface ThreatFilterParams {
  search?: string
  threatLevel?: 1 | 2 | 3 | 4 | 5
  isCustom?: boolean
}

const ThreatDBPage = () => {
  const [threats, setThreats] = useState<Threat[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [filters, setFilters] = useState<ThreatFilterParams>({
    search: '',
    threatLevel: undefined,
    isCustom: undefined,
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingThreat, setEditingThreat] = useState<Threat | null>(null)
  const [form] = Form.useForm()
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null)

  // 위협 목록 조회
  const fetchThreats = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getThreats({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        threatLevel: filters.threatLevel,
        isCustom: filters.isCustom,
      })
      setThreats(response.items)
      setPagination((prev) => ({
        ...prev,
        total: response.total,
      }))
    } catch {
      message.error('위협 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [pagination.current, pagination.pageSize, filters])

  useEffect(() => {
    fetchThreats()
  }, [fetchThreats])

  // 통계 계산
  const stats = {
    total: pagination.total,
    custom: threats.filter(t => t.isCustom).length,
    byLevel: THREAT_LEVEL_OPTIONS.map(level => ({
      ...level,
      count: threats.filter(t => t.threatLevel === level.value).length,
    })),
  }

  // 테이블 변경 핸들러
  const handleTableChange: TableProps<Threat>['onChange'] = (paginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 10,
    }))
  }

  // 검색 핸들러
  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 위협 레벨 필터 핸들러
  const handleLevelChange = (value?: 1 | 2 | 3) => {
    setFilters((prev) => ({ ...prev, threatLevel: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 커스텀 필터 핸들러
  const handleCustomFilterChange = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, isCustom: checked ? true : undefined }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 위협 추가 버튼 핸들러
  const handleAddClick = () => {
    setModalMode('create')
    setEditingThreat(null)
    form.resetFields()
    setModalVisible(true)
  }

  // 위협 수정 버튼 핸들러
  const handleEditClick = (threat: Threat) => {
    setModalMode('edit')
    setEditingThreat(threat)
    form.setFieldsValue({
      code: threat.code,
      name: threat.name,
      description: threat.description,
      threatLevel: threat.threatLevel,
    })
    setModalVisible(true)
  }

  // 위협 삭제 핸들러
  const handleDeleteClick = (threat: Threat) => {
    Modal.confirm({
      title: '위협 삭제',
      icon: <ExclamationCircleOutlined />,
      content: '이 위협을 삭제하시겠습니까? 삭제된 위협은 복구할 수 없습니다.',
      okText: '확인',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await deleteThreat(threat.id)
          message.success('위협이 삭제되었습니다')
          fetchThreats()
        } catch {
          message.error('위협 삭제에 실패했습니다')
        }
      },
    })
  }

  // 상세 보기
  const handleDetailClick = (threat: Threat) => {
    setSelectedThreat(threat)
    setDetailDrawerOpen(true)
  }

  // 모달 제출 핸들러
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      if (modalMode === 'create') {
        const data: ThreatCreate = {
          code: values.code,
          name: values.name,
          description: values.description || '',
          threatLevel: values.threatLevel,
        }
        await createThreat(data)
        message.success('위협이 추가되었습니다')
      } else if (editingThreat) {
        const data: ThreatUpdate = {
          name: values.name,
          description: values.description || '',
          threatLevel: values.threatLevel,
        }
        await updateThreat(editingThreat.id, data)
        message.success('위협이 수정되었습니다')
      }

      setModalVisible(false)
      form.resetFields()
      fetchThreats()
    } catch {
      // 폼 검증 에러는 자동으로 표시됨
    }
  }

  // 모달 취소 핸들러
  const handleModalCancel = () => {
    setModalVisible(false)
    form.resetFields()
    setEditingThreat(null)
  }

  // 위협 레벨 표시 함수
  const getThreatLevelTag = (level: number) => {
    const config = THREAT_LEVEL_OPTIONS.find((l) => l.value === level)
    if (!config) return null

    return (
      <Tag color={config.color} style={{ margin: 0 }}>
        {config.label}
      </Tag>
    )
  }

  // 테이블 컬럼 정의
  const columns: TableProps<Threat>['columns'] = [
    {
      title: '코드',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      sorter: (a, b) => a.code.localeCompare(b.code),
    },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Threat) => (
        <Space>
          <a onClick={() => handleDetailClick(record)}>{name}</a>
          {record.isCustom && (
            <Tag color="blue" style={{ margin: 0 }}>
              커스텀
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 300,
    },
    {
      title: '카테고리',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 130,
      render: (name: string | null) => name || <Text type="secondary">-</Text>,
    },
    {
      title: '위협 레벨',
      dataIndex: 'threatLevel',
      key: 'threatLevel',
      width: 100,
      align: 'center',
      filters: THREAT_LEVEL_OPTIONS.map(l => ({ text: l.label, value: l.value })),
      onFilter: (value, record) => record.threatLevel === value,
      render: (level: 1 | 2 | 3) => getThreatLevelTag(level),
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      align: 'center',
      render: (active: boolean) =>
        active ? <Tag color="success">활성</Tag> : <Tag color="default">비활성</Tag>,
    },
    {
      title: '작업',
      key: 'actions',
      width: 200,
      align: 'center',
      render: (_: unknown, record: Threat) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetailClick(record)}
          >
            상세
          </Button>
          <Tooltip title={!record.isCustom ? '기본 위협은 수정할 수 없습니다' : ''}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              disabled={!record.isCustom}
            >
              수정
            </Button>
          </Tooltip>
          <Tooltip title={!record.isCustom ? '기본 위협은 삭제할 수 없습니다' : ''}>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteClick(record)}
              disabled={!record.isCustom}
            >
              삭제
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            위협 DB 관리
          </Typography.Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
            위협 추가
          </Button>
        </Col>
      </Row>

      {/* 통계 카드 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="전체 위협"
              value={stats.total}
              suffix="건"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="커스텀 위협"
              value={stats.custom}
              suffix="건"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 14 }}>레벨별 분포</Text>
            </div>
            <Space size={24}>
              {stats.byLevel.map(level => (
                <span key={level.value}>
                  <Tag color={level.color} style={{ marginRight: 4 }}>{level.label}</Tag>
                  <Text strong>{level.count}</Text>건
                </span>
              ))}
            </Space>
            {threats.length > 0 && (
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
                {stats.byLevel.map(level => {
                  const pct = threats.length > 0 ? (level.count / threats.length) * 100 : 0
                  if (pct === 0) return null
                  return (
                    <Tooltip key={level.value} title={`${level.label}: ${level.count}건 (${pct.toFixed(1)}%)`}>
                      <div style={{ width: `${pct}%`, backgroundColor: level.color, height: '100%' }} />
                    </Tooltip>
                  )
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 필터 및 테이블 */}
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Search
              placeholder="위협 검색 (코드, 이름, 설명)"
              allowClear
              style={{ width: 300 }}
              onSearch={handleSearch}
              onChange={(e) => !e.target.value && handleSearch('')}
            />
            <Select
              placeholder="위협 레벨"
              style={{ width: 150 }}
              allowClear
              onChange={handleLevelChange}
              aria-label="위협 레벨"
            >
              {THREAT_LEVEL_OPTIONS.map((level) => (
                <Select.Option key={level.value} value={level.value}>
                  <Space>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: level.color,
                    }} />
                    {level.label}
                  </Space>
                </Select.Option>
              ))}
            </Select>
            <Checkbox onChange={(e) => handleCustomFilterChange(e.target.checked)}>커스텀만 보기</Checkbox>
          </Space>

          <Table
            columns={columns}
            dataSource={threats}
            loading={loading}
            rowKey="id"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개`,
            }}
            onChange={handleTableChange}
            size="middle"
          />
        </Space>
      </Card>

      {/* 추가/수정 모달 */}
      <Modal
        title={modalMode === 'create' ? '위협 추가' : '위협 수정'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="확인"
        cancelText="취소"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="코드"
            rules={[{ required: true, message: '코드를 입력해주세요' }]}
          >
            <Input placeholder="예: T001" disabled={modalMode === 'edit'} />
          </Form.Item>

          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input placeholder="위협 이름" />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <Input.TextArea rows={4} placeholder="위협 설명" />
          </Form.Item>

          <Form.Item
            name="threatLevel"
            label={
              <Space>
                <span>위협 레벨</span>
                <Tooltip title="1: 매우 낮음, 2: 낮음, 3: 보통, 4: 높음, 5: 매우 높음">
                  <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '위협 레벨을 선택해주세요' }]}
          >
            <Select placeholder="위협 레벨 선택">
              {THREAT_LEVEL_OPTIONS.map((level) => (
                <Select.Option key={level.value} value={level.value}>
                  <Space>
                    <Tag color={level.color} style={{ margin: 0 }}>{level.label}</Tag>
                    <span>({level.value})</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 상세 Drawer */}
      <Drawer
        title={
          <Space>
            <ThunderboltOutlined />
            <span>위협 상세 정보</span>
            {selectedThreat?.isCustom && <Tag color="blue">커스텀</Tag>}
          </Space>
        }
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false)
          setSelectedThreat(null)
        }}
        width={500}
        extra={
          selectedThreat?.isCustom && (
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setDetailDrawerOpen(false)
                handleEditClick(selectedThreat)
              }}
            >
              수정
            </Button>
          )
        }
      >
        {selectedThreat && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="코드">{selectedThreat.code}</Descriptions.Item>
            <Descriptions.Item label="이름">{selectedThreat.name}</Descriptions.Item>
            <Descriptions.Item label="설명">
              {selectedThreat.description || <Text type="secondary">-</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="카테고리">
              {selectedThreat.categoryName || <Text type="secondary">미분류</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="위협 레벨">
              {getThreatLevelTag(selectedThreat.threatLevel)}
            </Descriptions.Item>
            <Descriptions.Item label="유형">
              {selectedThreat.isCustom ? (
                <Tag color="blue">커스텀</Tag>
              ) : (
                <Tag color="default">기본 제공</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="상태">
              {selectedThreat.isActive ? (
                <Tag color="success">활성</Tag>
              ) : (
                <Tag color="default">비활성</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="등록일">
              {dayjs(selectedThreat.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="수정일">
              {selectedThreat.updatedAt
                ? dayjs(selectedThreat.updatedAt).format('YYYY-MM-DD HH:mm')
                : <Text type="secondary">-</Text>}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}

export default ThreatDBPage
