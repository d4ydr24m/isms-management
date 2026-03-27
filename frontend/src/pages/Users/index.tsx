import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Space, Tag, message, Modal, Select, Upload, Table, Typography, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import DataTable from '@/components/common/DataTable'
import SearchInput from '@/components/common/SearchInput'
import { userService } from '@/services/users'
import { apiClient } from '@/services/api'
import type { UserListItem } from '@/types'

const { confirm } = Modal
const { Dragger } = Upload
const { Text } = Typography

interface BulkUploadResult {
  successCount: number
  createdCount: number
  updatedCount: number
  failureCount: number
  errors: Array<{ row: number; field: string; message: string }>
}

function UserList() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFileList, setBulkFileList] = useState<UploadFile[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const [updateExisting, setUpdateExisting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [page, pageSize, search, statusFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await userService.getUsers({
        page,
        size: pageSize,
        search: search || undefined,
        isActive: statusFilter,
      })
      setUsers(response.items)
      setTotal(response.total)
    } catch (error) {
      message.error('사용자 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleDelete = (userId: number) => {
    confirm({
      title: '사용자를 비활성화하시겠습니까?',
      icon: <ExclamationCircleOutlined />,
      content: '비활성화된 사용자는 시스템에 접근할 수 없습니다.',
      onOk: async () => {
        try {
          await userService.deleteUser(userId)
          message.success('사용자가 비활성화되었습니다')
          loadUsers()
        } catch (err: any) {
          const detail = err?.response?.data?.detail || err?.message
          message.error(detail || '사용자 비활성화에 실패했습니다')
        }
      },
    })
  }

  const handleTemplateDownload = async (includeData = false) => {
    setTemplateDownloading(true)
    try {
      const response = await apiClient.get(`/bulk/users/template?include_data=${includeData}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const filename = includeData ? '사용자_목록.xlsx' : '사용자_일괄등록_템플릿.xlsx'
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
      const response = await apiClient.post(`/bulk/users/upload?update_existing=${updateExisting}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = response.data
      setBulkResult({
        successCount: data.success,
        createdCount: data.created || 0,
        updatedCount: data.updated || 0,
        failureCount: data.failed,
        errors: (data.errors || []).map((e: any) => ({ row: e.row, field: e.email || e.name || '', message: e.error })),
      })
      if (data.failed === 0) {
        const parts = []
        if (data.created > 0) parts.push(`신규 ${data.created}건`)
        if (data.updated > 0) parts.push(`업데이트 ${data.updated}건`)
        message.success(`${parts.join(', ')} 처리되었습니다`)
      } else {
        message.warning(`성공: ${data.success}건, 실패: ${data.failed}건`)
      }
      loadUsers()
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

  const columns: ColumnsType<UserListItem> = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '부서',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 150,
      render: (departmentName: string | null) => departmentName || '-',
    },
    {
      title: '역할',
      dataIndex: 'roles',
      key: 'roles',
      width: 200,
      render: (roles: Array<{ id: number; name: string }>) => (
        <>
          {roles.map((role) => (
            <Tag key={role.id} color="blue">
              {role.name}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '생성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString('ko-KR'),
    },
    {
      title: '마지막 로그인',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 170,
      render: (date: string | null) =>
        date ? new Date(date.endsWith('Z') ? date : date + 'Z').toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-',
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
            onClick={() => navigate(`/users/${record.id}`)}
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
            placeholder="상태"
            allowClear
            style={{ width: 120 }}
            onChange={setStatusFilter}
            value={statusFilter}
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
            onClick={() => navigate('/users/create')}
          >
            사용자 추가
          </Button>
        </Space>
      </div>

      <DataTable
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (newPage, newPageSize) => {
            setPage(newPage)
            setPageSize(newPageSize || 10)
          },
          showSizeChanger: true,
          showTotal: (total) => `총 ${total}개`,
        }}
      />

      <Modal
        title="사용자 일괄 등록"
        open={bulkModalOpen}
        onCancel={handleBulkModalClose}
        footer={null}
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="엑셀 파일을 이용하여 사용자를 일괄 등록할 수 있습니다. 먼저 템플릿을 다운로드하여 양식에 맞게 작성해주세요."
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
            기존 데이터 업데이트 (이메일이 동일한 사용자가 있으면 정보를 업데이트합니다)
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

export default UserList
