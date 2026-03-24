import { useState, useEffect, useCallback } from 'react'
import {
  Card,
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
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FolderOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { apiClient } from '@/services/api'

const { Text } = Typography

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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
            부서 추가
          </Button>
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
    </div>
  )
}

export default DepartmentsPage
