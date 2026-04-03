import { useState, useEffect, useCallback } from 'react'
import {
  Button,
  Checkbox,
  Space,
  Tag,
  message,
  Modal,
  Select,
  Form,
  Input,
  Upload,
  Table,
  Typography,
  Alert,
  Pagination,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import DataTable from '@/components/common/DataTable'
import SearchInput from '@/components/common/SearchInput'
import { apiClient } from '@/services/api'

const { confirm } = Modal
const { Dragger } = Upload
const { Text } = Typography

interface Personnel {
  id: number
  name: string
  email: string | null
  phone: string | null
  position: string | null
  departmentId: number | null
  departmentName: string | null
  userId: number | null
  userName: string | null
  note: string | null
  isActive: boolean
  createdAt: string
}

interface Department {
  id: number
  name: string
}

interface UserOption {
  id: number
  name: string
  email: string
}

interface PersonnelFormValues {
  name: string
  email?: string
  phone?: string
  position?: string
  departmentId?: number | null
  userId?: number | null
  note?: string
}

interface BulkUploadResult {
  successCount: number
  createdCount: number
  updatedCount: number
  failureCount: number
  errors: Array<{ row: number; field: string; message: string }>
}

function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [form] = Form.useForm<PersonnelFormValues>()

  // Bulk upload state
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFileList, setBulkFileList] = useState<UploadFile[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const [updateExisting, setUpdateExisting] = useState(false)

  const fetchPersonnel = async (p: number, ps: number, s: string, df?: number, sf?: boolean) => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page: p, page_size: ps }
      if (s) params.name = s
      if (df !== undefined) params.department_id = df
      if (sf !== undefined) params.is_active = sf

      const response = await apiClient.get<{ items: any[]; total: number }>('/personnel', { params })
      setPersonnel(response.data.items || [])
      setTotal(response.data.total || 0)
    } catch {
      message.error('담당자 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await apiClient.get<{ items: Department[] }>('/departments')
        setDepartments(res.data.items || [])
      } catch {
        // ignore
      }
    }
    const loadUsers = async () => {
      try {
        const res = await apiClient.get<{ items: UserOption[] }>('/users', { params: { pageSize: 1000 } })
        setUsers(res.data.items || [])
      } catch {
        // ignore
      }
    }
    loadDepartments()
    loadUsers()
  }, [])

  // Initial load only
  useEffect(() => {
    fetchPersonnel(1, 10, '', undefined, undefined)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    fetchPersonnel(1, pageSize, value, departmentFilter, statusFilter)
  }

  const handleAdd = () => {
    setEditingPersonnel(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: Personnel) => {
    setEditingPersonnel(record)
    form.setFieldsValue({
      name: record.name,
      email: record.email || undefined,
      phone: record.phone || undefined,
      position: record.position || undefined,
      departmentId: record.departmentId || undefined,
      userId: record.userId || undefined,
      note: record.note || undefined,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: number) => {
    confirm({
      title: '담당자를 삭제하시겠습니까?',
      icon: <ExclamationCircleOutlined />,
      content: '삭제된 담당자는 복구할 수 없습니다.',
      okText: '삭제',
      cancelText: '취소',
      onOk: async () => {
        try {
          await apiClient.delete(`/personnel/${id}`)
          message.success('담당자가 삭제되었습니다')
          fetchPersonnel(page, pageSize, search, departmentFilter, statusFilter)
        } catch (err: any) {
          const detail = err?.response?.data?.detail || err?.message
          message.error(detail || '담당자 삭제에 실패했습니다')
        }
      },
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (editingPersonnel) {
        await apiClient.put(`/personnel/${editingPersonnel.id}`, values)
        message.success('담당자 정보가 수정되었습니다')
      } else {
        await apiClient.post('/personnel', values)
        message.success('담당자가 추가되었습니다')
      }

      setModalOpen(false)
      form.resetFields()
      setEditingPersonnel(null)
      fetchPersonnel(page, pageSize, search, departmentFilter, statusFilter)
    } catch (err: any) {
      if (err?.errorFields) return
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || (editingPersonnel ? '담당자 수정에 실패했습니다' : '담당자 추가에 실패했습니다'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setModalOpen(false)
    form.resetFields()
    setEditingPersonnel(null)
  }

  // Bulk upload handlers
  const handleTemplateDownload = async (includeData = false) => {
    setTemplateDownloading(true)
    try {
      const response = await apiClient.get(`/bulk/personnel/template?include_data=${includeData}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const filename = includeData ? '담당자_목록.xlsx' : '담당자_일괄등록_템플릿.xlsx'
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('다운로드가 완료되었습니다')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '다운로드에 실패했습니다')
    } finally {
      setTemplateDownloading(false)
    }
  }

  const handleBulkUpload = async () => {
    if (bulkFileList.length === 0) {
      message.warning('업로드할 파일을 선택해주세요')
      return
    }

    const file = bulkFileList[0] as any
    const formData = new FormData()
    formData.append('file', file.originFileObj || file)

    setBulkUploading(true)
    setBulkResult(null)
    try {
      const response = await apiClient.post(`/bulk/personnel/upload?update_existing=${updateExisting}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = response.data
      setBulkResult({
        successCount: data.success,
        createdCount: data.created || 0,
        updatedCount: data.updated || 0,
        failureCount: data.failed,
        errors: (data.errors || []).map((e: any) => ({ row: e.row, field: e.name || e.email || '', message: e.error })),
      })
      if (data.failed === 0) {
        const parts = []
        if (data.created > 0) parts.push(`신규 ${data.created}건`)
        if (data.updated > 0) parts.push(`업데이트 ${data.updated}건`)
        message.success(`${parts.join(', ')} 처리되었습니다`)
      } else {
        message.warning(`성공: ${data.success}건, 실패: ${data.failed}건`)
      }
      fetchPersonnel(page, pageSize, search, departmentFilter, statusFilter)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '일괄 등록에 실패했습니다')
    } finally {
      setBulkUploading(false)
    }
  }

  const handleBulkModalClose = () => {
    setBulkModalOpen(false)
    setBulkFileList([])
    setBulkResult(null)
    setUpdateExisting(false)
  }

  const bulkErrorColumns: ColumnsType<{ row: number; field: string; message: string }> = [
    { title: '행 번호', dataIndex: 'row', key: 'row', width: 80 },
    { title: '필드', dataIndex: 'field', key: 'field', width: 120 },
    { title: '오류 내용', dataIndex: 'message', key: 'message' },
  ]

  const columns: ColumnsType<Personnel> = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email: string | null) => email || '-',
    },
    {
      title: '전화번호',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (phone: string | null) => phone || '-',
    },
    {
      title: '직위',
      dataIndex: 'position',
      key: 'position',
      width: 100,
      render: (position: string | null) => position || '-',
    },
    {
      title: '부서',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120,
      render: (departmentName: string | null) => departmentName || '-',
    },
    {
      title: '연결 계정',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (userName: string | null) => userName || '-',
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            삭제
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <SearchInput
            placeholder="이름 또는 이메일로 검색"
            onSearch={handleSearch}
            width={300}
          />
          <Select
            placeholder="부서"
            allowClear
            style={{ width: 150 }}
            onChange={(value: number | undefined) => {
              setDepartmentFilter(value ?? undefined)
              setPage(1)
              fetchPersonnel(1, pageSize, search, value ?? undefined, statusFilter)
            }}
            value={departmentFilter ?? undefined}
            aria-label="부서"
          >
            {departments.filter(dept => dept.id != null).map((dept) => (
              <Select.Option key={dept.id} value={dept.id}>
                {dept.name}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="상태"
            allowClear
            style={{ width: 120 }}
            onChange={(value: boolean | undefined) => {
              setStatusFilter(value ?? undefined)
              setPage(1)
              fetchPersonnel(1, pageSize, search, departmentFilter, value ?? undefined)
            }}
            value={statusFilter ?? undefined}
            aria-label="상태"
          >
            <Select.Option value={true}>활성</Select.Option>
            <Select.Option value={false}>비활성</Select.Option>
          </Select>
        </Space>
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setBulkModalOpen(true)}
          >
            일괄 등록
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            담당자 추가
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={personnel}
        rowKey="id"
        loading={loading}
        bordered
        locale={{ emptyText: '데이터가 없습니다' }}
        pagination={false}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(t) => `총 ${t}명`}
          onChange={(newPage, newPageSize) => {
            console.log('[Pagination onChange] newPage:', newPage, 'newPageSize:', newPageSize)
            setPage(newPage)
            setPageSize(newPageSize)
            fetchPersonnel(newPage, newPageSize, search, departmentFilter, statusFilter)
          }}
        />
      </div>

      {/* 담당자 추가/수정 모달 */}
      <Modal
        title={editingPersonnel ? '담당자 수정' : '담당자 추가'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={submitting}
        okText={editingPersonnel ? '수정' : '추가'}
        cancelText="취소"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="이름"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input placeholder="이름을 입력하세요" />
          </Form.Item>
          <Form.Item name="email" label="이메일">
            <Input placeholder="이메일을 입력하세요" type="email" />
          </Form.Item>
          <Form.Item name="phone" label="전화번호">
            <Input placeholder="전화번호를 입력하세요" />
          </Form.Item>
          <Form.Item name="position" label="직위/직책">
            <Input placeholder="직위 또는 직책을 입력하세요" />
          </Form.Item>
          <Form.Item name="departmentId" label="부서">
            <Select
              placeholder="부서를 선택하세요"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {departments.filter(dept => dept.id != null).map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="userId" label="연결 계정">
            <Select
              placeholder="시스템 계정을 연결하세요 (선택사항)"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {users.filter(user => user.id != null).map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="note" label="비고">
            <Input.TextArea rows={3} placeholder="비고를 입력하세요" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 일괄 등록 모달 */}
      <Modal
        title="담당자 일괄 등록"
        open={bulkModalOpen}
        onCancel={handleBulkModalClose}
        footer={null}
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="엑셀 파일을 이용하여 담당자를 일괄 등록할 수 있습니다. 먼저 템플릿을 다운로드하여 양식에 맞게 작성해주세요."
            type="info"
            showIcon
          />

          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleTemplateDownload(false)}
              loading={templateDownloading}
            >
              빈 템플릿 다운로드
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleTemplateDownload(true)}
              loading={templateDownloading}
            >
              기존 데이터 포함 다운로드
            </Button>
          </Space>

          <Checkbox
            checked={updateExisting}
            onChange={(e) => setUpdateExisting(e.target.checked)}
          >
            기존 데이터 업데이트 (이름과 이메일이 동일한 담당자가 있으면 정보를 업데이트합니다)
          </Checkbox>

          <Dragger
            accept=".xlsx"
            maxCount={1}
            fileList={bulkFileList}
            beforeUpload={() => false}
            onChange={({ fileList }) => setBulkFileList(fileList)}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">클릭하거나 파일을 이 영역에 드래그하세요</p>
            <p className="ant-upload-hint">.xlsx 파일만 업로드 가능합니다</p>
          </Dragger>

          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleBulkUpload}
            loading={bulkUploading}
            disabled={bulkFileList.length === 0}
            block
          >
            업로드
          </Button>

          {bulkResult && (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Alert
                message="업로드 결과"
                description={
                  <Space>
                    {bulkResult.createdCount > 0 && <Text>신규: <Text strong style={{ color: '#52c41a' }}>{bulkResult.createdCount}건</Text></Text>}
                    {bulkResult.updatedCount > 0 && <Text>업데이트: <Text strong style={{ color: '#1890ff' }}>{bulkResult.updatedCount}건</Text></Text>}
                    <Text>실패: <Text strong style={{ color: bulkResult.failureCount > 0 ? '#ff4d4f' : undefined }}>{bulkResult.failureCount}건</Text></Text>
                  </Space>
                }
                type={bulkResult.failureCount > 0 ? 'warning' : 'success'}
                showIcon
              />
              {bulkResult.errors && bulkResult.errors.length > 0 && (
                <Table
                  columns={bulkErrorColumns}
                  dataSource={bulkResult.errors}
                  rowKey={(record) => `${record.row}-${record.field}`}
                  size="small"
                  pagination={{ pageSize: 5 }}
                  scroll={{ y: 200 }}
                />
              )}
            </Space>
          )}
        </Space>
      </Modal>
    </div>
  )
}

export default PersonnelPage
