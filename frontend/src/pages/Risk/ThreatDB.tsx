/**
 * 위협 DB 관리 페이지
 * FR-701: 위협 DB 관리
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
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { TableProps, FormInstance } from 'antd'
import { getThreats, createThreat, updateThreat, deleteThreat } from '@/services/risks'
import type { Threat, ThreatCreate, ThreatUpdate, THREAT_LEVELS } from '@/types'
import { THREAT_LEVELS as THREAT_LEVEL_OPTIONS } from '@/types'

const { Search } = Input

interface ThreatFilterParams {
  search?: string
  threat_level?: 1 | 2 | 3
  is_custom?: boolean
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
    threat_level: undefined,
    is_custom: undefined,
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingThreat, setEditingThreat] = useState<Threat | null>(null)
  const [form] = Form.useForm()

  // 위협 목록 조회
  const fetchThreats = useCallback(async () => {
    setLoading(true)
    try {
      const response = await getThreats({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        threat_level: filters.threat_level,
        is_custom: filters.is_custom,
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
    setFilters((prev) => ({ ...prev, threat_level: value }))
    setPagination((prev) => ({ ...prev, current: 1 }))
  }

  // 커스텀 필터 핸들러
  const handleCustomFilterChange = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, is_custom: checked ? true : undefined }))
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
      threat_level: threat.threat_level,
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

  // 모달 제출 핸들러
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      if (modalMode === 'create') {
        const data: ThreatCreate = {
          code: values.code,
          name: values.name,
          description: values.description || '',
          threat_level: values.threat_level,
        }
        await createThreat(data)
        message.success('위협이 추가되었습니다')
      } else if (editingThreat) {
        const data: ThreatUpdate = {
          code: values.code,
          name: values.name,
          description: values.description || '',
          threat_level: values.threat_level,
        }
        await updateThreat(editingThreat.id, data)
        message.success('위협이 수정되었습니다')
      }

      setModalVisible(false)
      form.resetFields()
      fetchThreats()
    } catch (error) {
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
  const getThreatLevelTag = (level: 1 | 2 | 3) => {
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
    },
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Threat) => (
        <Space>
          {name}
          {record.is_custom && (
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
    },
    {
      title: '위협 레벨',
      dataIndex: 'threat_level',
      key: 'threat_level',
      width: 100,
      align: 'center',
      render: (level: 1 | 2 | 3) => getThreatLevelTag(level),
    },
    {
      title: '작업',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_: unknown, record: Threat) => (
        <Space>
          <Tooltip title={!record.is_custom ? '기본 위협은 수정할 수 없습니다' : ''}>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              disabled={!record.is_custom}
            >
              수정
            </Button>
          </Tooltip>
          <Tooltip title={!record.is_custom ? '기본 위협은 삭제할 수 없습니다' : ''}>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteClick(record)}
              disabled={!record.is_custom}
            >
              삭제
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="위협 DB 관리"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClick}>
            위협 추가
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 필터 영역 */}
          <Space wrap>
            <Search
              placeholder="위협 검색"
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
                  {level.label}
                </Select.Option>
              ))}
            </Select>
            <Checkbox onChange={(e) => handleCustomFilterChange(e.target.checked)}>커스텀만 보기</Checkbox>
          </Space>

          {/* 테이블 */}
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
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="코드"
            rules={[{ required: true, message: '코드를 입력해주세요' }]}
          >
            <Input placeholder="예: T001" />
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
            name="threat_level"
            label="위협 레벨"
            rules={[{ required: true, message: '위협 레벨을 선택해주세요' }]}
          >
            <Select placeholder="위협 레벨 선택">
              {THREAT_LEVEL_OPTIONS.map((level) => (
                <Select.Option key={level.value} value={level.value}>
                  {level.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ThreatDBPage
