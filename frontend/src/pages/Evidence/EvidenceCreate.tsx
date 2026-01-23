import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  Space,
  message,
  Upload,
  Progress,
  Typography,
} from 'antd'
import { InboxOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { evidenceService } from '@/services/evidences'
import { controlService } from '@/services/controls'
import type { ControlItem, EvidenceCreate as EvidenceCreateType } from '@/types'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Dragger } = Upload
const { Text } = Typography

const EvidenceCreate = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileList, setFileList] = useState<File[]>([])
  const [controls, setControls] = useState<ControlItem[]>([])
  const [controlsLoading, setControlsLoading] = useState(false)

  const fetchControls = useCallback(async () => {
    setControlsLoading(true)
    try {
      const response = await controlService.getControls({ limit: 100 })
      setControls(response.data || [])
    } catch {
      message.error('Failed to load control items')
    } finally {
      setControlsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchControls()
  }, [fetchControls])

  const handleFileChange = (files: File[]) => {
    setFileList(files)
    if (files.length > 0) {
      form.setFieldValue('file', files[0])
    }
  }

  const handleSubmit = async (values: any) => {
    if (fileList.length === 0) {
      message.error('Please upload a file')
      return
    }

    setLoading(true)
    setUploadProgress(0)

    try {
      const createData: EvidenceCreateType = {
        title: values.title,
        description: values.description || '',
        validFrom: values.validFrom ? values.validFrom.format('YYYY-MM-DD') : undefined,
        validUntil: values.validUntil ? values.validUntil.format('YYYY-MM-DD') : undefined,
        controlItemIds: values.controlItemIds || [],
        file: fileList[0],
      }

      await evidenceService.createEvidence(createData, (progress) => {
        setUploadProgress(progress)
      })

      message.success('Evidence created successfully')
      navigate('/evidence')
    } catch {
      message.error('Failed to create evidence')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  const handleCancel = () => {
    navigate('/evidence')
  }

  const validateValidUntil = (_: any, value: any) => {
    const validFrom = form.getFieldValue('validFrom')
    if (value && validFrom && value.isBefore(validFrom)) {
      return Promise.reject(new Error('Valid until must be after valid from'))
    }
    return Promise.resolve()
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handleCancel}
              type="text"
            />
            <span>Create Evidence</span>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 800 }}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="Enter evidence title" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              placeholder="Enter description"
              rows={4}
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="file"
            label="File"
            rules={[{ required: true, message: 'Please upload a file' }]}
          >
            <Dragger
              multiple={false}
              beforeUpload={() => false}
              onChange={(info) => {
                const files = info.fileList.map((f) => f.originFileObj as File).filter(Boolean)
                handleFileChange(files)
              }}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Click or drag file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Support for a single file upload. Strictly prohibited from uploading company data or other banned files.
              </p>
            </Dragger>
          </Form.Item>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <Form.Item>
              <Progress percent={uploadProgress} />
            </Form.Item>
          )}

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="validFrom"
              label="Valid From"
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="validUntil"
              label="Valid Until"
              style={{ flex: 1 }}
              rules={[{ validator: validateValidUntil }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="controlItemIds"
            label="Control Items"
          >
            <Select
              mode="multiple"
              placeholder="Select control items"
              loading={controlsLoading}
              optionFilterProp="label"
              allowClear
              options={controls.map((control) => ({
                value: control.id,
                label: `${control.number} - ${control.title}`,
              }))}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Create
              </Button>
              <Button onClick={handleCancel}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default EvidenceCreate
