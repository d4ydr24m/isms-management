/**
 * 자산 유형 관리 페이지
 * 자산 유형 CRUD
 */
import { useState, useEffect, useCallback } from 'react'
import { App, Card, Button, Space, Modal, Form, Input, InputNumber, Switch, Breadcrumb, Tag, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { assetService } from '@/services/assets'
import SortableTable from '@/components/SortableTable'
import type { AssetType, AssetTypeCreate } from '@/types'
import type { TableProps } from 'antd'

const AssetTypesPage = () => {
  const { message } = App.useApp()
  const [types, setTypes] = useState<AssetType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingType, setEditingType] = useState<AssetType | null>(null)
  const [form] = Form.useForm()

  const fetchTypes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await assetService.getAssetTypes()
      setTypes(res.items || [])
    } catch {
      message.error('자산 유형을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTypes()
  }, [fetchTypes])

  const handleAdd = () => {
    setEditingType(null)
    setModalVisible(true)
  }

  const handleEdit = (record: AssetType) => {
    setEditingType(record)
    setModalVisible(true)
  }

  const handleModalOpenChange = (open: boolean) => {
    if (open) {
      form.resetFields()
      if (editingType) {
        form.setFieldsValue({
          code: editingType.code,
          name: editingType.name,
          description: editingType.description || '',
          sortOrder: editingType.sortOrder,
          isActive: editingType.isActive,
        })
      } else {
        form.setFieldsValue({ sortOrder: 0, isActive: true })
      }
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingType) {
        await assetService.updateAssetType(editingType.id, {
          name: values.name,
          description: values.description || undefined,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        })
        message.success('자산 유형이 수정되었습니다')
      } else {
        const data: AssetTypeCreate = {
          code: values.code,
          name: values.name,
          description: values.description || undefined,
          sortOrder: values.sortOrder || 0,
        }
        await assetService.createAssetType(data)
        message.success('자산 유형이 생성되었습니다')
      }
      setModalVisible(false)
      fetchTypes()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      if (detail) message.error(detail)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await assetService.deleteAssetType(id)
      message.success('자산 유형이 비활성화되었습니다')
      fetchTypes()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '삭제에 실패했습니다')
    }
  }

  const handleSortEnd = async (activeId: string | number, overId: string | number) => {
    const oldIndex = types.findIndex(t => t.id === Number(activeId))
    const newIndex = types.findIndex(t => t.id === Number(overId))
    if (oldIndex < 0 || newIndex < 0) return
    // 로컬 순서 업데이트
    const reordered = [...types]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    setTypes(reordered)
    // 서버에 순서 저장
    try {
      await Promise.all(
        reordered.map((t, i) =>
          t.sortOrder !== i ? assetService.updateAssetType(t.id, { sortOrder: i }) : Promise.resolve()
        )
      )
    } catch {
      message.error('정렬 순서 저장에 실패했습니다')
      fetchTypes()
    }
  }

  const columns: TableProps<AssetType>['columns'] = [
    {
      title: '코드',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string) => <code>{code}</code>,
    },
    {
      title: '유형명',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc?: string) => desc || '-',
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      align: 'center',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? '활성' : '비활성'}</Tag>
      ),
    },
    {
      title: '커스텀',
      dataIndex: 'isCustom',
      key: 'isCustom',
      width: 80,
      align: 'center',
      render: (custom: boolean) => custom ? <Tag color="blue">커스텀</Tag> : <Tag>기본</Tag>,
    },
    {
      title: '액션',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_: unknown, record: AssetType) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          {record.isActive && (
            <Popconfirm
              title="이 유형을 비활성화하시겠습니까?"
              onConfirm={() => handleDelete(record.id)}
              okText="확인"
              cancelText="취소"
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          )}
        </Space>
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
          { title: '자산 유형 관리' },
        ]}
      />

      <Card
        title="자산 유형 관리"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            유형 추가
          </Button>
        }
      >
        <SortableTable<AssetType>
          columns={columns}
          dataSource={types}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={false}
          onSortEnd={handleSortEnd}
        />
      </Card>

      <Modal
        title={editingType ? '자산 유형 수정' : '자산 유형 추가'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        afterOpenChange={handleModalOpenChange}
        okText={editingType ? '수정' : '추가'}
        cancelText="취소"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {!editingType && (
            <Form.Item
              name="code"
              label="유형 코드"
              rules={[
                { required: true, message: '유형 코드를 입력해주세요' },
                { pattern: /^[A-Z0-9]+$/, message: '영문 대문자, 숫자만 사용 가능합니다' },
              ]}
              extra="예: PPD (영문 대문자, 숫자)"
            >
              <Input placeholder="PPD" maxLength={20} />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="유형명"
            rules={[{ required: true, message: '유형명을 입력해주세요' }]}
          >
            <Input placeholder="유형명" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={2} placeholder="설명 (선택)" maxLength={500} />
          </Form.Item>
          <Form.Item name="sortOrder" label="정렬 순서">
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
          {editingType && (
            <Form.Item name="isActive" label="활성 상태" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default AssetTypesPage
