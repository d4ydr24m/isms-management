import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Checkbox,
  Tree,
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Typography,
  Badge,
  Empty,
  Spin,
  Tooltip,
  Upload,
  Table,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { UploadFile } from 'antd/es/upload/interface'
import { apiClient } from '@/services/api'

const { Text } = Typography
const { Dragger } = Upload

interface Department {
  id: number
  name: string
  code: string
  description: string | null
  parentId: number | null
  isActive: boolean
  userCount: number
  createdAt: string
}

interface DepartmentTreeNode extends Department {
  children?: DepartmentTreeNode[]
}

interface DepartmentFormValues {
  name: string
  code: string
  description?: string
  parentId?: number | null
}

interface BulkUploadResult {
  successCount: number
  createdCount: number
  updatedCount: number
  failureCount: number
  errors: Array<{ row: number; field: string; message: string }>
}

function DepartmentsPage() {
  const [treeData, setTreeData] = useState<DepartmentTreeNode[]>([])
  const [flatDepartments, setFlatDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [addParentId, setAddParentId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [form] = Form.useForm<DepartmentFormValues>()
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkFileList, setBulkFileList] = useState<UploadFile[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const [updateExisting, setUpdateExisting] = useState(false)

  const loadDepartments = useCallback(async () => {
    setLoading(true)
    try {
      // flat list for parent select options
      const flatRes = await apiClient.get<{ items: Department[]; total: number }>('/departments')
      const flat = flatRes.data.items || []
      setFlatDepartments(flat)

      // build tree from flat list
      const tree = buildTree(flat)
      setTreeData(tree)

      // auto expand all
      setExpandedKeys(flat.map((d) => d.id))
    } catch {
      message.error('부서 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  /** flat list → tree structure */
  const buildTree = (items: Department[]): DepartmentTreeNode[] => {
    const map = new Map<number, DepartmentTreeNode>()
    const roots: DepartmentTreeNode[] = []

    items.forEach((item) => {
      map.set(item.id, { ...item, children: [] })
    })

    items.forEach((item) => {
      const node = map.get(item.id)!
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }

  const handleAdd = (parentId?: number) => {
    setEditingDepartment(null)
    setAddParentId(parentId || null)
    form.resetFields()
    if (parentId) {
      form.setFieldsValue({ parentId })
    }
    setModalOpen(true)
  }

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept)
    setAddParentId(null)
    setModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/departments/${id}`)
      message.success('부서가 삭제되었습니다')
      loadDepartments()
    } catch {
      message.error('부서 삭제에 실패했습니다')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (editingDepartment) {
        await apiClient.put(`/departments/${editingDepartment.id}`, values)
        message.success('부서가 수정되었습니다')
      } else {
        await apiClient.post('/departments', values)
        message.success('부서가 추가되었습니다')
      }

      setModalOpen(false)
      form.resetFields()
      setEditingDepartment(null)
      setAddParentId(null)
      loadDepartments()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(editingDepartment ? '부서 수정에 실패했습니다' : '부서 추가에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setModalOpen(false)
    form.resetFields()
    setEditingDepartment(null)
    setAddParentId(null)
  }

  const handleTemplateDownload = async (includeData = false) => {
    setTemplateDownloading(true)
    try {
      const response = await apiClient.get(`/bulk/departments/template?include_data=${includeData}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const filename = includeData ? '부서_목록.xlsx' : '부서_일괄등록_템플릿.xlsx'
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('다운로드가 완료되었습니다')
    } catch (error) {
      message.error('다운로드에 실패했습니다')
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
      const response = await apiClient.post(`/bulk/departments/upload?update_existing=${updateExisting}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = response.data
      setBulkResult({
        successCount: data.success,
        createdCount: data.created || 0,
        updatedCount: data.updated || 0,
        failureCount: data.failed,
        errors: (data.errors || []).map((e: any) => ({ row: e.row, field: e.name || '', message: e.error })),
      })
      if (data.failed === 0) {
        const parts = []
        if (data.created > 0) parts.push(`신규 ${data.created}건`)
        if (data.updated > 0) parts.push(`업데이트 ${data.updated}건`)
        message.success(`${parts.join(', ')} 처리되었습니다`)
      } else {
        message.warning(`성공: ${data.success}건, 실패: ${data.failed}건`)
      }
      loadDepartments()
    } catch (error) {
      message.error('일괄 등록에 실패했습니다')
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

  const bulkErrorColumns = [
    { title: '행 번호', dataIndex: 'row', key: 'row', width: 80 },
    { title: '필드', dataIndex: 'field', key: 'field', width: 120 },
    { title: '오류 내용', dataIndex: 'message', key: 'message' },
  ]

  const parentOptions = flatDepartments
    .filter((d) => d.isActive && (!editingDepartment || d.id !== editingDepartment.id))
    .map((d) => ({ label: d.name, value: d.id }))

  /** DepartmentTreeNode → Ant Design DataNode */
  const convertToTreeData = (nodes: DepartmentTreeNode[]): DataNode[] => {
    return nodes.map((dept) => ({
      key: dept.id,
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
          <Space size="middle" style={{ flex: 1 }}>
            <Text strong>{dept.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{dept.code}</Text>
            {dept.description && (
              <Tooltip title={dept.description}>
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                  {dept.description}
                </Text>
              </Tooltip>
            )}
            <Badge count={dept.userCount} style={{ backgroundColor: '#1890ff' }} overflowCount={999} showZero>
              <TeamOutlined style={{ fontSize: 16, color: '#999' }} />
            </Badge>
            <Tag color={dept.isActive ? 'green' : 'red'} style={{ marginLeft: 0 }}>
              {dept.isActive ? '활성' : '비활성'}
            </Tag>
          </Space>
          <Space size="small" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="하위 부서 추가">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAdd(dept.id)}
              />
            </Tooltip>
            <Tooltip title="수정">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(dept)}
              />
            </Tooltip>
            <Popconfirm
              title="부서를 삭제하시겠습니까?"
              description="삭제된 부서는 복구할 수 없습니다."
              onConfirm={() => handleDelete(dept.id)}
              okText="삭제"
              cancelText="취소"
            >
              <Tooltip title="삭제">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>
      ),
      icon: dept.children && dept.children.length > 0
        ? ({ expanded }: any) => expanded ? <FolderOpenOutlined /> : <FolderOutlined />
        : <ApartmentOutlined />,
      children: dept.children && dept.children.length > 0 ? convertToTreeData(dept.children) : undefined,
    }))
  }

  const onExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys)
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <ApartmentOutlined />
            <span>부서 관리</span>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
              총 {flatDepartments.length}개
            </Text>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setBulkModalOpen(true)}>
              일괄 등록
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
              부서 추가
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <Spin size="large" />
          </div>
        ) : treeData.length > 0 ? (
          <Tree
            showIcon
            blockNode
            expandedKeys={expandedKeys}
            onExpand={onExpand}
            treeData={convertToTreeData(treeData)}
            style={{ fontSize: 14 }}
          />
        ) : (
          <Empty description="등록된 부서가 없습니다" />
        )}
      </Card>

      <Modal
        title={editingDepartment ? '부서 수정' : '부서 추가'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={submitting}
        okText={editingDepartment ? '수정' : '추가'}
        cancelText="취소"
        afterOpenChange={(open) => {
          if (open && editingDepartment) {
            form.setFieldsValue({
              name: editingDepartment.name,
              code: editingDepartment.code,
              description: editingDepartment.description || undefined,
              parentId: editingDepartment.parentId || undefined,
            })
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="부서명"
            rules={[{ required: true, message: '부서명을 입력해주세요' }]}
          >
            <Input placeholder="부서명을 입력하세요" />
          </Form.Item>
          <Form.Item
            name="code"
            label="코드"
            rules={[{ required: true, message: '코드를 입력해주세요' }]}
          >
            <Input placeholder="부서 코드를 입력하세요" />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} placeholder="설명을 입력하세요" />
          </Form.Item>
          <Form.Item name="parentId" label="상위 부서">
            <Select
              placeholder="상위 부서를 선택하세요"
              allowClear
              options={parentOptions}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="부서 일괄 등록"
        open={bulkModalOpen}
        onCancel={handleBulkModalClose}
        footer={null}
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="엑셀 파일을 이용하여 부서를 일괄 등록할 수 있습니다. 먼저 템플릿을 다운로드하여 양식에 맞게 작성해주세요."
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
            기존 데이터 업데이트 (부서코드가 동일한 부서가 있으면 정보를 업데이트합니다)
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

export default DepartmentsPage
