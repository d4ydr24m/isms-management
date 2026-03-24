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
} from 'antd'
import { InboxOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { evidenceService } from '@/services/evidences'
import { controlService } from '@/services/controls'
import type { ControlItem, EvidenceCreate as EvidenceCreateType } from '@/types'

const { TextArea } = Input
const { Dragger } = Upload

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
      const response = await controlService.getControls({ pageSize: 200 })
      setControls(response.items || [])
    } catch {
      message.error('통제항목을 불러오는데 실패했습니다')
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
      message.error('파일을 업로드해 주세요')
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
        controlIds: values.controlIds || [],
        file: fileList[0],
      }

      await evidenceService.createEvidence(createData, (progress) => {
        setUploadProgress(progress)
      })

      message.success('증적이 등록되었습니다')
      navigate('/evidence')
    } catch {
      message.error('증적 등록에 실패했습니다')
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
      return Promise.reject(new Error('유효 기한은 유효 시작일 이후여야 합니다'))
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
            <span>증적 등록</span>
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
            label="제목"
            rules={[{ required: true, message: '제목을 입력해 주세요' }]}
          >
            <Input placeholder="증적 제목을 입력하세요" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="description"
            label="설명"
          >
            <TextArea
              placeholder="설명을 입력하세요"
              rows={4}
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="file"
            label="파일"
            rules={[{ required: true, message: '파일을 업로드해 주세요' }]}
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
                클릭하거나 파일을 이 영역으로 드래그하여 업로드하세요
              </p>
              <p className="ant-upload-hint">
                단일 파일 업로드만 지원됩니다. 회사 기밀 자료 또는 금지된 파일의 업로드는 엄격히 금지됩니다.
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
              label="유효 시작일"
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="validUntil"
              label="유효 기한"
              style={{ flex: 1 }}
              rules={[{ validator: validateValidUntil }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="controlIds"
            label="통제항목"
          >
            <Select
              mode="multiple"
              placeholder="통제항목을 선택하세요"
              loading={controlsLoading}
              optionFilterProp="label"
              allowClear
              options={controls.map((control) => ({
                value: control.id,
                label: `${control.code} - ${control.title}`,
              }))}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                등록
              </Button>
              <Button onClick={handleCancel}>취소</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default EvidenceCreate
