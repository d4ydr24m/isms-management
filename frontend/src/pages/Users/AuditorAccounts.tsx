import { useState, useEffect } from 'react'
import {
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  DatePicker,
  Checkbox,
  Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import DataTable from '@/components/common/DataTable'
import SearchInput from '@/components/common/SearchInput'
import { auditorAccountService } from '@/services/auditorAccounts'
import type { AuditorAccount, AuditorAccountCreate, AuditorAccountUpdate } from '@/types'

const { confirm } = Modal
const { RangePicker } = DatePicker

const scopeOptions = [
  { label: '증적관리', value: '증적관리' },
  { label: '감사관리', value: '감사관리' },
  { label: '통제항목', value: '통제항목' },
  { label: '대시보드', value: '대시보드' },
]

function AuditorAccounts() {
  const [accounts, setAccounts] = useState<AuditorAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AuditorAccount | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadAccounts()
  }, [page, pageSize, search])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const response = await auditorAccountService.getAuditorAccounts({
        page,
        limit: pageSize,
        search: search || undefined,
      })
      setAccounts(response.items)
      setTotal(response.total)
    } catch (error) {
      message.error('심사원 계정 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleCreate = () => {
    setEditingAccount(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (account: AuditorAccount) => {
    setEditingAccount(account)
    form.setFieldsValue({
      name: account.name,
      email: account.email,
      organization: account.organization,
      validPeriod: [dayjs(account.validFrom), dayjs(account.validUntil)],
      scope: account.scope,
      canDownload: account.canDownload,
      isActive: account.isActive,
    })
    setModalVisible(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        name: values.name,
        email: values.email,
        organization: values.organization,
        validFrom: values.validPeriod[0].toISOString(),
        validUntil: values.validPeriod[1].toISOString(),
        scope: values.scope,
        canDownload: values.canDownload || false,
      }

      if (editingAccount) {
        const updateData: AuditorAccountUpdate = {
          ...data,
          isActive: values.isActive,
        }
        await auditorAccountService.updateAuditorAccount(editingAccount.id, updateData)
        message.success('심사원 계정이 수정되었습니다')
      } else {
        await auditorAccountService.createAuditorAccount(data as AuditorAccountCreate)
        message.success('심사원 계정이 생성되었습니다')
      }

      setModalVisible(false)
      form.resetFields()
      loadAccounts()
    } catch (error) {
      message.error(
        editingAccount ? '심사원 계정 수정에 실패했습니다' : '심사원 계정 생성에 실패했습니다'
      )
    }
  }

  const handleDelete = (accountId: number) => {
    confirm({
      title: '심사원 계정을 만료시키겠습니까?',
      icon: <ExclamationCircleOutlined />,
      content: '만료된 계정은 더 이상 시스템에 접근할 수 없습니다.',
      onOk: async () => {
        try {
          await auditorAccountService.deleteAuditorAccount(accountId)
          message.success('심사원 계정이 만료되었습니다')
          loadAccounts()
        } catch (error) {
          message.error('심사원 계정 만료에 실패했습니다')
        }
      },
    })
  }

  const isExpired = (validUntil: string) => {
    return dayjs(validUntil).isBefore(dayjs())
  }

  const columns: ColumnsType<AuditorAccount> = [
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
      width: 180,
    },
    {
      title: '소속',
      dataIndex: 'organization',
      key: 'organization',
      width: 150,
    },
    {
      title: '유효기간',
      key: 'validPeriod',
      width: 200,
      render: (_, record) => (
        <span>
          {dayjs(record.validFrom).format('YYYY-MM-DD')} ~{' '}
          {dayjs(record.validUntil).format('YYYY-MM-DD')}
        </span>
      ),
    },
    {
      title: '접근범위',
      dataIndex: 'scope',
      key: 'scope',
      width: 200,
      render: (scope: string[]) => (
        <>
          {scope.map((s) => (
            <Tag key={s} color="blue">
              {s}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '다운로드',
      dataIndex: 'canDownload',
      key: 'canDownload',
      width: 100,
      render: (canDownload: boolean) => (
        <Tag color={canDownload ? 'green' : 'default'}>{canDownload ? '허용' : '불가'}</Tag>
      ),
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean, record) => {
        if (!isActive) {
          return <Tag color="red">비활성</Tag>
        }
        if (isExpired(record.validUntil)) {
          return <Tag color="orange">만료</Tag>
        }
        return <Tag color="green">활성</Tag>
      },
    },
    {
      title: '생성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
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
            만료
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <SearchInput
          placeholder="이름 또는 소속으로 검색"
          onSearch={handleSearch}
          width={300}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          계정 생성
        </Button>
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
          showTotal: (total) => `총 ${total}개`,
        }}
      />

      <Modal
        title={editingAccount ? '심사원 계정 수정' : '심사원 계정 생성'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
            label="소속"
            name="organization"
            rules={[{ required: true, message: '소속을 입력해주세요' }]}
          >
            <Input placeholder="인증기관명" />
          </Form.Item>

          <Form.Item
            label="유효기간"
            name="validPeriod"
            rules={[{ required: true, message: '유효기간을 선택해주세요' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="접근범위"
            name="scope"
            rules={[{ required: true, message: '접근범위를 선택해주세요' }]}
          >
            <Checkbox.Group options={scopeOptions} />
          </Form.Item>

          <Form.Item label="다운로드 권한" name="canDownload" valuePropName="checked">
            <Switch />
          </Form.Item>

          {editingAccount && (
            <Form.Item label="활성 상태" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingAccount ? '저장' : '확인'}
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false)
                  form.resetFields()
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

export default AuditorAccounts
