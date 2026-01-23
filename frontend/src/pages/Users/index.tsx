import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Space, Tag, message, Modal, Select } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import DataTable from '@/components/common/DataTable'
import SearchInput from '@/components/common/SearchInput'
import { userService } from '@/services/users'
import type { UserListItem } from '@/types'

const { confirm } = Modal

function UserList() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    loadUsers()
  }, [page, pageSize, search, statusFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await userService.getUsers({
        page,
        pageSize,
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
        } catch (error) {
          message.error('사용자 비활성화에 실패했습니다')
        }
      },
    })
  }

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
      dataIndex: 'department',
      key: 'department',
      width: 150,
      render: (department: string | null) => department || '-',
    },
    {
      title: '역할',
      dataIndex: 'roles',
      key: 'roles',
      width: 200,
      render: (roles: string[]) => (
        <>
          {roles.map((role) => (
            <Tag key={role} color="blue">
              {role}
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
            style={{ width: 300 }}
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/users/create')}
        >
          사용자 추가
        </Button>
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
    </div>
  )
}

export default UserList
