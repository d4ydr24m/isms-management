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
        userService.getUsers({ limit: 100 }),
        auditorAccountService.getAuditorAccounts({ limit: 100 }),
        controlService.getControls({ limit: 200 }),
      ])
      setUsers(usersData.data || [])
      setExternalAuditors(auditorsData.data || [])
      setControls(controlsData.data || [])
    } catch {
      message.error('Failed to load data')
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
      message.success('Audit plan created successfully')
      navigate(`/audits/${result.id}`)
    } catch {
      message.error('Failed to create audit plan')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate(-1)
  }

  const controlTransferData: TransferItem[] = controls.map((control) => ({
    key: String(control.id),
    title: `${control.number} - ${control.title}`,
    description: control.isRequired ? 'Required' : 'Optional',
  }))

  const handleControlChange: TransferProps['onChange'] = (nextTargetKeys) => {
    setSelectedControls(nextTargetKeys as string[])
  }

  const filterOption = (inputValue: string, option: TransferItem) =>
    option.title.toLowerCase().includes(inputValue.toLowerCase())

  return (
    <Card title="Create Audit Plan">
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
              label="Audit Title"
              rules={[{ required: true, message: 'Title is required' }]}
            >
              <Input placeholder="Enter audit title" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="auditType"
              label="Audit Type"
              rules={[{ required: true, message: 'Audit type is required' }]}
            >
              <Select placeholder="Select audit type">
                <Option value="internal">Internal</Option>
                <Option value="external">External</Option>
                <Option value="certification">Certification</Option>
                <Option value="surveillance">Surveillance</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="Description"
        >
          <TextArea rows={3} placeholder="Enter audit description" />
        </Form.Item>

        <Form.Item
          name="period"
          label="Audit Period"
          rules={[{ required: true, message: 'Audit period is required' }]}
        >
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="scope"
          label="Audit Scope"
          rules={[{ required: true, message: 'Audit scope is required' }]}
        >
          <TextArea rows={4} placeholder="Describe the audit scope" />
        </Form.Item>

        <Divider />

        <Title level={5}>Auditor Assignment</Title>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="internalAuditorIds"
              label="Internal Auditors"
            >
              <Select
                mode="multiple"
                placeholder="Select internal auditors"
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
              label="External Auditors"
            >
              <Select
                mode="multiple"
                placeholder="Select external auditors"
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

        <Title level={5}>Select Control Items</Title>
        <Form.Item
          name="controlItemIds"
          label="Control Items in Scope"
        >
          <Transfer
            dataSource={controlTransferData}
            titles={['Available', 'Selected']}
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
              Create
            </Button>
            <Button onClick={handleCancel}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default AuditCreate
