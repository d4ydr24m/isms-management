import { useState, useEffect, useCallback } from 'react'
import {
  App,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Checkbox,
  Popconfirm,
  Typography,
} from 'antd'
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import DataTable from '@/components/common/DataTable'
import { apiClient } from '@/services/api'
import { usePermissions } from '@/hooks'

const { RangePicker } = DatePicker
const { Text } = Typography

interface AuditorAccount {
  id: number
  userId: number
  userEmail: string
  userName: string
  auditPlanId: number
  auditPlanTitle: string
  validFrom: string
  validUntil: string
  accessScope: string
  allowDownload: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  tempPassword?: string
}

interface AuditPlan {
  id: number
  title: string
}

const accessScopeOptions = [
  { label: '전체', value: '전체' },
  { label: '증적만', value: '증적만' },
  { label: '통제항목만', value: '통제항목만' },
]

function AuditorAccountsPage() {
  const { message } = App.useApp()
  const { hasPermission } = usePermissions()
  const canCreate = hasPermission('audit:create')
  const canUpdate = hasPermission('audit:update')
  const canDelete = hasPermission('audit:delete')
  const [accounts, setAccounts] = useState<AuditorAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AuditorAccount | null>(null)

  const [auditPlans, setAuditPlans] = useState<AuditPlan[]>([])
  const [auditPlansLoading, setAuditPlansLoading] = useState(false)

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/auditor-accounts', {
        params: { page, size: pageSize },
      })
      const data = res.data
      setAccounts(data.items || [])
      setTotal(data.total || 0)
    } catch {
      message.error('외부 심사원 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  const loadAuditPlans = async () => {
    setAuditPlansLoading(true)
    try {
      const res = await apiClient.get('/audits', { params: { page: 1, size: 100 } })
      const data = res.data
      setAuditPlans(
        (data.items || []).map((item: any) => ({
          id: item.id,
          title: item.title,
        }))
      )
    } catch {
      message.error('감사 계획 목록을 불러오는데 실패했습니다')
    } finally {
      setAuditPlansLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const handleOpenCreate = () => {
    createForm.resetFields()
    loadAuditPlans()
    setCreateModalVisible(true)
  }

  const handleCreate = async (values: any) => {
    try {
      const payload = {
        email: values.email,
        name: values.name,
        auditPlanId: values.auditPlanId,
        validFrom: values.validPeriod[0].format('YYYY-MM-DD'),
        validUntil: values.validPeriod[1].format('YYYY-MM-DD'),
        accessScope: values.accessScope,
        allowDownload: values.allowDownload || false,
      }
      const res = await apiClient.post('/auditor-accounts', payload)
      const created = res.data

      setCreateModalVisible(false)
      createForm.resetFields()
      loadAccounts()

      // Show temp password modal - critical, only shown once
      if (created.tempPassword) {
        Modal.success({
          title: '외부 심사원 계정이 생성되었습니다',
          width: 480,
          content: (
            <div style={{ marginTop: 16 }}>
              <Text strong>임시 비밀번호</Text>
              <div
                style={{
                  marginTop: 8,
                  padding: '12px 16px',
                  background: '#f5f5f5',
                  borderRadius: 6,
                  fontFamily: 'monospace',
                  fontSize: 16,
                  userSelect: 'all',
                  cursor: 'text',
                }}
              >
                {created.tempPassword}
              </div>
              <Text type="danger" style={{ display: 'block', marginTop: 12 }}>
                이 비밀번호는 다시 확인할 수 없습니다. 반드시 복사하여 심사원에게 전달해주세요.
              </Text>
            </div>
          ),
          okText: '확인',
        })
      } else {
        message.success('외부 심사원 계정이 생성되었습니다')
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '외부 심사원 계정 생성에 실패했습니다')
    }
  }

  const handleOpenEdit = (account: AuditorAccount) => {
    setEditingAccount(account)
    editForm.setFieldsValue({
      validUntil: dayjs(account.validUntil),
      accessScope: account.accessScope,
      allowDownload: account.allowDownload,
      isActive: account.isActive,
    })
    setEditModalVisible(true)
  }

  const handleEdit = async (values: any) => {
    if (!editingAccount) return
    try {
      await apiClient.put(`/auditor-accounts/${editingAccount.id}`, {
        validUntil: values.validUntil.format('YYYY-MM-DD'),
        accessScope: values.accessScope,
        allowDownload: values.allowDownload || false,
        isActive: values.isActive,
      })
      message.success('외부 심사원 계정이 수정되었습니다')
      setEditModalVisible(false)
      editForm.resetFields()
      setEditingAccount(null)
      loadAccounts()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '외부 심사원 계정 수정에 실패했습니다')
    }
  }

  const handleDeactivate = async (id: number) => {
    try {
      await apiClient.delete(`/auditor-accounts/${id}`)
      message.success('외부 심사원 계정이 비활성화되었습니다')
      loadAccounts()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '외부 심사원 계정 비활성화에 실패했습니다')
    }
  }

  const columns: ColumnsType<AuditorAccount> = [
    {
      title: '이름',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
    },
    {
      title: '이메일',
      dataIndex: 'userEmail',
      key: 'userEmail',
      width: 200,
    },
    {
      title: '감사 계획',
      dataIndex: 'auditPlanTitle',
      key: 'auditPlanTitle',
      width: 180,
    },
    {
      title: '유효 기간',
      key: 'validPeriod',
      width: 220,
      render: (_, record) => (
        <span>
          {dayjs(record.validFrom).format('YYYY-MM-DD')} ~{' '}
          {dayjs(record.validUntil).format('YYYY-MM-DD')}
        </span>
      ),
    },
    {
      title: '접근 범위',
      dataIndex: 'accessScope',
      key: 'accessScope',
      width: 120,
      render: (scope: string) => <Tag color="blue">{scope}</Tag>,
    },
    {
      title: '다운로드',
      dataIndex: 'allowDownload',
      key: 'allowDownload',
      width: 100,
      render: (allow: boolean) => (
        <Tag color={allow ? 'green' : 'default'}>{allow ? '허용' : '불가'}</Tag>
      ),
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
      width: 180,
      render: (_, record) => (
        <Space size="small">
          {canUpdate && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
              수정
            </Button>
          )}
          {canDelete && record.isActive && (
            <Popconfirm
              title="비활성화 확인"
              description="이 심사원 계정을 비활성화하시겠습니까?"
              onConfirm={() => handleDeactivate(record.id)}
              okText="비활성화"
              cancelText="취소"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger icon={<StopOutlined />}>
                비활성화
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>외부 심사원 관리</h2>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            외부 심사원 추가
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        dataSource={accounts}
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
          showTotal: (t) => `총 ${t}개`,
        }}
      />

      {/* 생성 모달 */}
      <Modal
        title="외부 심사원 추가"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false)
          createForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="이름"
            name="name"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input placeholder="심사원 이름" />
          </Form.Item>

          <Form.Item
            label="이메일"
            name="email"
            rules={[
              { required: true, message: '이메일을 입력해주세요' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다' },
            ]}
          >
            <Input placeholder="auditor@example.com" />
          </Form.Item>

          <Form.Item
            label="감사 계획"
            name="auditPlanId"
            rules={[{ required: true, message: '감사 계획을 선택해주세요' }]}
          >
            <Select
              placeholder="감사 계획 선택"
              loading={auditPlansLoading}
              options={auditPlans.map((plan) => ({
                value: plan.id,
                label: plan.title,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            />
          </Form.Item>

          <Form.Item
            label="유효 기간"
            name="validPeriod"
            rules={[{ required: true, message: '유효 기간을 선택해주세요' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="접근 범위"
            name="accessScope"
            rules={[{ required: true, message: '접근 범위를 선택해주세요' }]}
          >
            <Select placeholder="접근 범위 선택" options={accessScopeOptions} />
          </Form.Item>

          <Form.Item name="allowDownload" valuePropName="checked">
            <Checkbox>다운로드 허용</Checkbox>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                생성
              </Button>
              <Button
                onClick={() => {
                  setCreateModalVisible(false)
                  createForm.resetFields()
                }}
              >
                취소
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 수정 모달 */}
      <Modal
        title="외부 심사원 수정"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          editForm.resetFields()
          setEditingAccount(null)
        }}
        footer={null}
        width={500}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            label="유효 기간 종료일"
            name="validUntil"
            rules={[{ required: true, message: '유효 기간 종료일을 선택해주세요' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="접근 범위"
            name="accessScope"
            rules={[{ required: true, message: '접근 범위를 선택해주세요' }]}
          >
            <Select placeholder="접근 범위 선택" options={accessScopeOptions} />
          </Form.Item>

          <Form.Item name="allowDownload" valuePropName="checked">
            <Checkbox>다운로드 허용</Checkbox>
          </Form.Item>

          <Form.Item name="isActive" valuePropName="checked">
            <Checkbox>활성 상태</Checkbox>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                저장
              </Button>
              <Button
                onClick={() => {
                  setEditModalVisible(false)
                  editForm.resetFields()
                  setEditingAccount(null)
                }}
              >
                취소
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AuditorAccountsPage
