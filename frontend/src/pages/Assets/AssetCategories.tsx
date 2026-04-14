/**
 * 자산 분류 관리 페이지
 * 계층 구조(대분류/중분류/소분류) CRUD
 */
import { useState, useEffect, useCallback } from 'react'
import { App, Card, Tree, Button, Space, Modal, Form, Input, InputNumber, Select, Popconfirm, Tag, Empty, Spin, Breadcrumb } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined, FolderOutlined, FolderOpenOutlined, FileOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { assetService } from '@/services/assets'
import type { AssetCategory, AssetCategoryCreate, AssetCategoryUpdate } from '@/types'
import type { DataNode } from 'antd/es/tree'

const { Option } = Select

const levelLabels: Record<number, string> = {
  1: '대분류',
  2: '중분류',
  3: '소분류',
}

const levelColors: Record<number, string> = {
  1: 'blue',
  2: 'cyan',
  3: 'green',
}

const AssetCategoriesPage = () => {
  const { message } = App.useApp()
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null)
  const [parentCategory, setParentCategory] = useState<AssetCategory | null>(null)
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [form] = Form.useForm()

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await assetService.getAssetCategories()
      setCategories(res.items || [])
    } catch {
      message.error('분류 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  /** 전체 트리를 flat으로 변환 (부모 찾기용) */
  const flattenAll = (cats: AssetCategory[]): AssetCategory[] => {
    const result: AssetCategory[] = []
    const walk = (items: AssetCategory[]) => {
      items.forEach(c => {
        result.push(c)
        if (c.children?.length) walk(c.children)
      })
    }
    walk(cats)
    return result
  }

  const allCategories = flattenAll(categories)

  /** 선택된 카테고리 찾기 */
  const findCategory = (id: number): AssetCategory | undefined =>
    allCategories.find(c => c.id === id)

  const selectedCategory = selectedKey ? findCategory(selectedKey) : null

  /** 추가 모달 열기 */
  const handleAdd = (parent?: AssetCategory) => {
    setEditingCategory(null)
    setParentCategory(parent || null)
    const newLevel = parent ? (parent.level + 1) as 1 | 2 | 3 : 1
    form.resetFields()
    form.setFieldsValue({
      level: newLevel,
      parentId: parent?.id || null,
      sortOrder: 0,
    })
    setModalVisible(true)
  }

  /** 수정 모달 열기 */
  const handleEdit = (cat: AssetCategory) => {
    setEditingCategory(cat)
    setParentCategory(null)
    form.resetFields()
    form.setFieldsValue({
      code: cat.code,
      name: cat.name,
      description: cat.description || '',
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    })
    setModalVisible(true)
  }

  /** 삭제 */
  const handleDelete = async (cat: AssetCategory) => {
    try {
      await assetService.deleteAssetCategory(cat.id)
      message.success(`'${cat.name}' 분류가 삭제되었습니다`)
      if (selectedKey === cat.id) setSelectedKey(null)
      await fetchCategories()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '분류 삭제에 실패했습니다')
    }
  }

  /** 모달 제출 */
  const handleSubmit = async (values: any) => {
    try {
      if (editingCategory) {
        const updateData: AssetCategoryUpdate = {
          name: values.name,
          description: values.description || undefined,
          sortOrder: values.sortOrder,
          isActive: values.isActive,
        }
        await assetService.updateAssetCategory(editingCategory.id, updateData)
        message.success('분류가 수정되었습니다')
      } else {
        const fullCode = parentCategory
          ? `${parentCategory.code}-${values.code}`
          : values.code
        const createData: AssetCategoryCreate = {
          code: fullCode,
          name: values.name,
          description: values.description || undefined,
          level: values.level,
          parentId: values.parentId || undefined,
          sortOrder: values.sortOrder || 0,
        }
        await assetService.createAssetCategory(createData)
        message.success('분류가 생성되었습니다')
      }
      setModalVisible(false)
      form.resetFields()
      await fetchCategories()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '분류 저장에 실패했습니다')
    }
  }

  /** 트리 데이터 변환 (인라인 액션 버튼 포함) */
  const categoryToTreeNode = (cat: AssetCategory): DataNode => ({
    key: cat.id,
    title: (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: cat.level === 1 ? 600 : 400 }}>{cat.name}</span>
        <Tag color={levelColors[cat.level]} style={{ fontSize: 11 }}>{levelLabels[cat.level]}</Tag>
        <span style={{ color: '#999', fontSize: 12 }}>{cat.code}</span>
        {!cat.isActive && <Tag color="default">비활성</Tag>}
        <span className="tree-actions" style={{ marginLeft: 8, opacity: 0, transition: 'opacity 0.2s' }}>
          {cat.level < 3 && (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={(e) => { e.stopPropagation(); handleAdd(cat) }}
              style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
            >
              하위 추가
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => { e.stopPropagation(); handleEdit(cat) }}
            style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
          />
          <Popconfirm
            title="분류 삭제"
            description={`'${cat.name}' 분류를 삭제하시겠습니까?`}
            onConfirm={() => handleDelete(cat)}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
              style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
            />
          </Popconfirm>
        </span>
      </div>
    ),
    icon: cat.level === 1 ? <FolderOutlined /> : cat.level === 2 ? <FolderOpenOutlined /> : <FileOutlined />,
    children: cat.children?.map(categoryToTreeNode) || [],
  })

  /** 트리 데이터 */
  const treeData: DataNode[] = categories.map(categoryToTreeNode)

  /** 선택 시 오른쪽 패널에 상세 표시 */
  const handleSelect = (keys: React.Key[]) => {
    setSelectedKey(keys.length > 0 ? Number(keys[0]) : null)
  }

  return (
    <div>
      <style>{`
        .ant-tree-node-content-wrapper:hover .tree-actions {
          opacity: 1 !important;
        }
      `}</style>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/assets">자산 관리</Link> },
          { title: '분류 관리' },
        ]}
      />

      <div style={{ display: 'flex', gap: 16 }}>
        {/* 왼쪽: 트리 */}
        <Card
          title="분류 체계"
          style={{ flex: 1, minWidth: 400 }}
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
              대분류 추가
            </Button>
          }
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : treeData.length === 0 ? (
            <Empty description="등록된 분류가 없습니다" />
          ) : (
            <Tree
              showIcon
              defaultExpandAll
              treeData={treeData}
              selectedKeys={selectedKey ? [selectedKey] : []}
              onSelect={handleSelect}
              style={{ fontSize: 14 }}
            />
          )}
        </Card>

        {/* 오른쪽: 상세 정보 + 액션 */}
        <Card title="분류 상세" style={{ width: 380 }}>
          {selectedCategory ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 16 }}>{selectedCategory.name}</strong>
                  <Tag color={levelColors[selectedCategory.level]} style={{ marginLeft: 8 }}>
                    {levelLabels[selectedCategory.level]}
                  </Tag>
                </div>
                <div style={{ color: '#666', marginBottom: 4 }}>
                  코드: <code>{selectedCategory.code}</code>
                </div>
                {selectedCategory.description && (
                  <div style={{ color: '#666', marginBottom: 4 }}>
                    설명: {selectedCategory.description}
                  </div>
                )}
                <div style={{ color: '#666', marginBottom: 4 }}>
                  정렬 순서: {selectedCategory.sortOrder}
                </div>
                <div style={{ color: '#666', marginBottom: 4 }}>
                  상태: {selectedCategory.isActive ? <Tag color="green">활성</Tag> : <Tag color="default">비활성</Tag>}
                </div>
                {selectedCategory.children?.length > 0 && (
                  <div style={{ color: '#666' }}>
                    하위 분류: {selectedCategory.children.length}개
                  </div>
                )}
              </div>

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  icon={<EditOutlined />}
                  block
                  onClick={() => handleEdit(selectedCategory)}
                >
                  수정
                </Button>
                {selectedCategory.level < 3 && (
                  <Button
                    icon={<PlusOutlined />}
                    block
                    onClick={() => handleAdd(selectedCategory)}
                  >
                    하위 분류 추가
                  </Button>
                )}
                <Popconfirm
                  title="분류 삭제"
                  description={`'${selectedCategory.name}' 분류를 삭제하시겠습니까?`}
                  onConfirm={() => handleDelete(selectedCategory)}
                  okText="삭제"
                  cancelText="취소"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<DeleteOutlined />} block>
                    삭제
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          ) : (
            <Empty description="분류를 선택하세요" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      </div>

      {/* 생성/수정 모달 */}
      <Modal
        title={editingCategory ? '분류 수정' : `${parentCategory ? `'${parentCategory.name}' 하위 ` : ''}분류 추가`}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingCategory && (
            <Form.Item
              name="code"
              label="분류 코드"
              rules={[
                { required: true, message: '분류 코드를 입력해주세요' },
                { pattern: /^[A-Z0-9-]+$/, message: '영문 대문자, 숫자, 하이픈만 사용 가능합니다' },
              ]}
              extra={parentCategory
                ? `최종 코드: ${parentCategory.code}-{입력값}`
                : '예: HW (영문 대문자, 숫자, 하이픈)'}
            >
              <Input
                addonBefore={parentCategory ? `${parentCategory.code}-` : undefined}
                placeholder={parentCategory ? 'NAC' : 'HW'}
                maxLength={20}
              />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="분류명"
            rules={[{ required: true, message: '분류명을 입력해주세요' }]}
          >
            <Input placeholder="분류명" maxLength={100} />
          </Form.Item>

          <Form.Item name="description" label="설명">
            <Input.TextArea rows={2} placeholder="설명 (선택)" maxLength={500} />
          </Form.Item>

          {!editingCategory && (
            <>
              <Form.Item name="level" label="분류 레벨" hidden>
                <InputNumber />
              </Form.Item>
              <Form.Item name="parentId" label="상위 분류" hidden>
                <InputNumber />
              </Form.Item>
            </>
          )}

          <Form.Item name="sortOrder" label="정렬 순서">
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>

          {editingCategory && (
            <Form.Item name="isActive" label="활성 상태">
              <Select>
                <Option value={true}>활성</Option>
                <Option value={false}>비활성</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingCategory ? '수정' : '생성'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false)
                form.resetFields()
              }}>
                취소
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AssetCategoriesPage
