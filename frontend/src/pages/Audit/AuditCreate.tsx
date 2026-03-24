import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Row,
  Col,
  Transfer,
  Typography,
  Divider,
} from 'antd'
import type { TransferProps } from 'antd'
import dayjs from 'dayjs'
import { auditService } from '@/services/audits'
import { userService } from '@/services/users'
import { auditorAccountService } from '@/services/auditorAccounts'
import { controlService } from '@/services/controls'
import type { AuditPlanCreate, UserListItem, AuditorAccount, ControlItem } from '@/types'

const { TextArea } = Input
const { RangePicker } = DatePicker
const { Option } = Select
const { Title } = Typography

interface FormValues {
  title: string
  description: string
  auditType: string
  period: [dayjs.Dayjs, dayjs.Dayjs]
  scope: string
  internalAuditorIds: number[]
  externalAuditorIds: number[]
  controlItemIds: string[]
}

interface TransferItem {
  key: string
  title: string
  description?: string
}

const AuditCreate = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserListItem[]>([])
  const [externalAuditors, setExternalAuditors] = useState<AuditorAccount[]>([])
  const [controls, setControls] = useState<ControlItem[]>([])
  const [selectedControls, setSelectedControls] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [usersData, auditorsData, controlsData] = await Promise.all([
        userService.getUsers({ size: 100 }),
        auditorAccountService.getAuditorAccounts({ size: 100 }),
        controlService.getControls({ pageSize: 200 }),
      ])
      setUsers(usersData.items || [])
      setExternalAuditors(auditorsData.items || [])
      setControls(controlsData.items || [])
    } catch {
      message.error('데이터를 불러오는데 실패했습니다')
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const auditorIds = [
        ...(values.internalAuditorIds || []),
        ...(values.externalAuditorIds || []),
      ]

      const data: AuditPlanCreate = {
        title: values.title,
        description: values.description,
        auditType: values.auditType,
        startDate: values.period[0].format('YYYY-MM-DD'),
        endDate: values.period[1].format('YYYY-MM-DD'),
        scope: values.scope,
        auditorIds,
      }

      const result = await auditService.createAudit(data)
      message.success('감사 계획이 등록되었습니다')
      navigate(`/audits/${result.id}`)
    } catch {
      message.error('감사 계획 등록에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate(-1)
  }

  const controlTransferData: TransferItem[] = controls.map((control) => ({
    key: String(control.id),
    title: `${control.code} - ${control.title}`,
    description: control.isRequired ? '필수' : '선택',
  }))

  const handleControlChange: TransferProps['onChange'] = (nextTargetKeys) => {
    setSelectedControls(nextTargetKeys as string[])
  }

  const filterOption = (inputValue: string, option: TransferItem) =>
    option.title.toLowerCase().includes(inputValue.toLowerCase())

  return (
    <Card title="감사 계획 등록">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          auditType: undefined,
          internalAuditorIds: [],
          externalAuditorIds: [],
        }}
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="title"
              label="감사 제목"
              rules={[{ required: true, message: '제목을 입력해주세요' }]}
            >
              <Input placeholder="감사 제목 입력" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="auditType"
              label="감사 유형"
              rules={[{ required: true, message: '감사 유형을 선택해주세요' }]}
            >
              <Select placeholder="감사 유형 선택">
                <Option value="internal">내부 감사</Option>
                <Option value="external">외부 감사</Option>
                <Option value="certification">인증 심사</Option>
                <Option value="surveillance">사후 심사</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="설명"
        >
          <TextArea rows={3} placeholder="감사 설명 입력" />
        </Form.Item>

        <Form.Item
          name="period"
          label="감사 기간"
          rules={[{ required: true, message: '감사 기간을 선택해주세요' }]}
        >
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="scope"
          label="감사 범위"
          rules={[{ required: true, message: '감사 범위를 입력해주세요' }]}
        >
          <TextArea rows={4} placeholder="감사 범위 기술" />
        </Form.Item>

        <Divider />

        <Title level={5}>감사원 배정</Title>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="internalAuditorIds"
              label="내부 감사원"
            >
              <Select
                mode="multiple"
                placeholder="내부 감사원 선택"
                optionFilterProp="children"
                allowClear
              >
                {users
                  .filter((u) => u.roles?.includes('auditor') || u.roles?.includes('admin'))
                  .map((user) => (
                    <Option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="externalAuditorIds"
              label="외부 감사원"
            >
              <Select
                mode="multiple"
                placeholder="외부 감사원 선택"
                optionFilterProp="children"
                allowClear
              >
                {externalAuditors
                  .filter((a) => a.isActive)
                  .map((auditor) => (
                    <Option key={auditor.id} value={auditor.id}>
                      {auditor.name} ({auditor.organization})
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider />

        <Title level={5}>통제항목 선택</Title>
        <Form.Item
          name="controlItemIds"
          label="범위 내 통제항목"
        >
          <Transfer
            dataSource={controlTransferData}
            titles={['선택 가능', '선택됨']}
            targetKeys={selectedControls}
            onChange={handleControlChange}
            filterOption={filterOption}
            showSearch
            listStyle={{
              width: '100%',
              height: 300,
            }}
            render={(item) => item.title}
          />
        </Form.Item>

        <Form.Item style={{ marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              등록
            </Button>
            <Button onClick={handleCancel}>취소</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default AuditCreate
