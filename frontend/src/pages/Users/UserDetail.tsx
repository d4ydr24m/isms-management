import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Switch,
  Alert,
  Typography,
} from 'antd'
import { EditOutlined, ArrowLeftOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons'
import { userService } from '@/services/users'
import { apiClient } from '@/services/api'
import type { User, Role } from '@/types'

const { confirm } = Modal

function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [addRoleModalVisible, setAddRoleModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [roleForm] = Form.useForm()

  useEffect(() => {
    loadUserDetail()
    loadRoles()
    loadDepartments()
  }, [id])

  const loadUserDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const userData = await userService.getUser(parseInt(id))
      setUser(userData)
      form.setFieldsValue({
        name: userData.name,
        departmentId: userData.departmentId,
        isActive: userData.isActive,
      })
    } catch (error) {
      message.error('사용자 정보를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const rolesData = await userService.getRoles()
      setRoles(rolesData)
    } catch (error) {
      message.error('역할 목록을 불러오는데 실패했습니다')
    }
  }

  const loadDepartments = async () => {
    try {
      const response = await apiClient.get<{ items: Array<{ id: number; name: string }>; total: number }>('/departments', { params: { isActive: true } })
      setDepartments(response.data.items || [])
    } catch {
      // 부서 목록 로드 실패 시 무시
    }
  }

  const handleUpdate = async (values: any) => {
    if (!id) return
    try {
      await userService.updateUser(parseInt(id), values)
      message.success('사용자 정보가 수정되었습니다')
      setEditModalVisible(false)
      loadUserDetail()
    } catch (error) {
      message.error('사용자 정보 수정에 실패했습니다')
    }
  }

  const handleAddRole = async (values: { roleIds: number[] }) => {
    if (!id || !user) return
    try {
      const currentRoleIds = user.roles.map((r) => r.id)
      const newRoleIds = [...new Set([...currentRoleIds, ...values.roleIds])]
      await userService.assignRoles(parseInt(id), newRoleIds)
      message.success('역할이 추가되었습니다')
      setAddRoleModalVisible(false)
      roleForm.resetFields()
      loadUserDetail()
    } catch (error) {
      message.error('역할 추가에 실패했습니다')
    }
  }

  const handleRemoveRole = (roleId: number) => {
    if (!id || !user) return
    confirm({
      title: '역할을 제거하시겠습니까?',
      onOk: async () => {
        try {
          const newRoleIds = user.roles.filter((r) => r.id !== roleId).map((r) => r.id)
          await userService.assignRoles(parseInt(id), newRoleIds)
          message.success('역할이 제거되었습니다')
          loadUserDetail()
        } catch (error) {
          message.error('역할 제거에 실패했습니다')
        }
      },
    })
  }

  const handleToggleActive = () => {
    if (!id || !user) return
    const action = user.isActive ? '비활성화' : '활성화'
    confirm({
      title: `사용자를 ${action}하시겠습니까?`,
      onOk: async () => {
        try {
          await userService.updateUser(parseInt(id), {
            isActive: !user.isActive,
          })
          message.success(`사용자가 ${action}되었습니다`)
          loadUserDetail()
        } catch (error) {
          message.error(`사용자 ${action}에 실패했습니다`)
        }
      },
    })
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!user) {
    return <div style={{ padding: '24px' }}>사용자를 찾을 수 없습니다</div>
  }

  const availableRoles = roles.filter(
    (role) => !user.roles.some((userRole) => userRole.id === role.id)
  )

  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ marginBottom: '16px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/users')}>
          목록으로
        </Button>
      </Space>

      <Card
        title="사용자 정보"
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => setEditModalVisible(true)}>
              수정
            </Button>
            <Button
              danger={user.isActive}
              type={user.isActive ? 'default' : 'primary'}
              onClick={handleToggleActive}
            >
              {user.isActive ? '비활성화' : '활성화'}
            </Button>
          </Space>
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="이름">{user.name}</Descriptions.Item>
          <Descriptions.Item label="이메일">{user.email}</Descriptions.Item>
          <Descriptions.Item label="부서">
            {(user as any).departmentName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="상태">
            <Tag color={user.isActive ? 'green' : 'red'}>
              {user.isActive ? '활성' : '비활성'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="2FA">
            <Tag color={user.isMfaEnabled ? 'blue' : 'default'}>
              {user.isMfaEnabled ? '활성화' : '비활성화'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="생성일">
            {new Date(user.createdAt.endsWith('Z') ? user.createdAt : user.createdAt + 'Z').toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </Descriptions.Item>
          <Descriptions.Item label="마지막 로그인">
            {user.lastLoginAt ? new Date(user.lastLoginAt.endsWith('Z') ? user.lastLoginAt : user.lastLoginAt + 'Z').toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="마지막 접속 IP">
            {user.lastLoginIp || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="할당된 역할"
        style={{ marginTop: '16px' }}
        extra={
          <Button
            icon={<PlusOutlined />}
            onClick={() => setAddRoleModalVisible(true)}
            disabled={availableRoles.length === 0}
          >
            역할 추가
          </Button>
        }
      >
        <Space wrap>
          {user.roles.map((role) => (
            <Tag
              key={role.id}
              color="blue"
              closable
              onClose={() => handleRemoveRole(role.id)}
            >
              {role.name}
            </Tag>
          ))}
          {user.roles.length === 0 && <span>할당된 역할이 없습니다</span>}
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>IP 접근 제한</span>
          </Space>
        }
        style={{ marginTop: '16px' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Space>
              <Switch
                checked={user.ipWhitelistEnabled}
                onChange={async (checked) => {
                  try {
                    await userService.updateUser(parseInt(id!), { ipWhitelistEnabled: checked })
                    message.success(checked ? 'IP 제한이 활성화되었습니다' : 'IP 제한이 비활성화되었습니다')
                    loadUserDetail()
                  } catch {
                    message.error('설정 변경에 실패했습니다')
                  }
                }}
              />
              <Typography.Text strong>IP 화이트리스트 활성화</Typography.Text>
            </Space>
          </div>
          <div>
            <Typography.Text strong>허용 IP 주소 목록</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>(한 줄에 하나의 IP, CIDR 지원)</Typography.Text>
            <Input.TextArea
              rows={4}
              placeholder={'예시:\n192.168.1.1\n10.0.0.0/24'}
              value={(user.allowedIps || '').replace(/,/g, '\n')}
              disabled={!user.ipWhitelistEnabled}
              onChange={(e) => {
                // 로컬 상태 업데이트 (저장은 버튼 클릭 시)
                setUser({ ...user, allowedIps: e.target.value.replace(/\n/g, ',') })
              }}
              style={{ marginTop: 8 }}
            />
          </div>
          <Button
            type="primary"
            disabled={!user.ipWhitelistEnabled}
            onClick={async () => {
              try {
                await userService.updateUser(parseInt(id!), { allowedIps: user.allowedIps || '' })
                message.success('IP 목록이 저장되었습니다')
                loadUserDetail()
              } catch {
                message.error('IP 목록 저장에 실패했습니다')
              }
            }}
          >
            IP 목록 저장
          </Button>
          {user.ipWhitelistEnabled && (
            <Alert
              type="warning"
              showIcon
              message="주의"
              description="잘못된 IP 설정 시 이 사용자의 접근이 차단됩니다. 현재 접속 IP가 목록에 포함되어 있는지 확인하세요."
            />
          )}
        </Space>
      </Card>

      <Modal
        title="사용자 정보 수정"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleUpdate} layout="vertical">
          <Form.Item
            label="이름"
            name="name"
            rules={[{ required: true, message: '이름을 입력해주세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="부서" name="departmentId">
            <Select placeholder="부서 선택" allowClear showSearch optionFilterProp="label">
              {departments.map((dept) => (
                <Select.Option key={dept.id} value={dept.id} label={dept.name}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="활성 상태" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                저장
              </Button>
              <Button onClick={() => setEditModalVisible(false)}>취소</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="역할 추가"
        open={addRoleModalVisible}
        onCancel={() => {
          setAddRoleModalVisible(false)
          roleForm.resetFields()
        }}
        footer={null}
      >
        <Form form={roleForm} onFinish={handleAddRole} layout="vertical">
          <Form.Item
            label="역할 선택"
            name="roleIds"
            rules={[{ required: true, message: '역할을 선택해주세요' }]}
          >
            <Select mode="multiple" placeholder="역할을 선택하세요">
              {availableRoles.map((role) => (
                <Select.Option key={role.id} value={role.id}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                확인
              </Button>
              <Button
                onClick={() => {
                  setAddRoleModalVisible(false)
                  roleForm.resetFields()
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

export default UserDetail
