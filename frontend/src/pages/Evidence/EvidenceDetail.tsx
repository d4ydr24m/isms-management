import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  App,
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Row,
  Col,
  Spin,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  DownloadOutlined,
  UploadOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { FilePreview, ControlMapping, VersionHistory } from './components'
import { evidenceService } from '@/services/evidences'
import { controlService } from '@/services/controls'
import { usePermissions } from '@/hooks'
import type { Evidence, EvidenceVersion, ControlItem } from '@/types'

const { Title } = Typography

const statusConfig: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '유효' },
  draft: { color: 'orange', text: '초안' },
  expired: { color: 'red', text: '만료' },
  archived: { color: 'default', text: '보관' },
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const EvidenceDetail = () => {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission('evidence:update')
  const canDelete = hasPermission('evidence:delete')
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [versions, setVersions] = useState<EvidenceVersion[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [availableControls, setAvailableControls] = useState<ControlItem[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [editForm] = Form.useForm()
  const [uploadForm] = Form.useForm()

  const fetchEvidence = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const data = await evidenceService.getEvidence(Number(id))
      setEvidence(data)
    } catch {
      message.error('증적을 불러오는데 실패했습니다')
      navigate('/evidence')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  const fetchVersions = useCallback(async () => {
    if (!id) return

    setVersionsLoading(true)
    try {
      const data = await evidenceService.getVersions(Number(id))
      setVersions(data)
    } catch {
      message.error('버전 이력을 불러오는데 실패했습니다')
    } finally {
      setVersionsLoading(false)
    }
  }, [id])

  const fetchPreviewUrl = useCallback(async () => {
    if (!id) return

    setPreviewLoading(true)
    try {
      const url = await evidenceService.getPreviewUrl(Number(id))
      setPreviewUrl(url)
    } catch {
      // Preview may not be available for all file types
      setPreviewUrl(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [id])

  const fetchAvailableControls = useCallback(async () => {
    try {
      const response = await controlService.getControls({ pageSize: 200 })
      setAvailableControls(response.items || [])
    } catch {
      message.error('통제항목을 불러오는데 실패했습니다')
    }
  }, [])

  useEffect(() => {
    fetchEvidence()
    fetchVersions()
    fetchPreviewUrl()
    fetchAvailableControls()
  }, [fetchEvidence, fetchVersions, fetchPreviewUrl, fetchAvailableControls])

  const handleDownload = async () => {
    if (!evidence) return

    try {
      await evidenceService.downloadEvidence(evidence.id, evidence.fileName)
      message.success('다운로드가 시작되었습니다')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '파일 다운로드에 실패했습니다')
    }
  }

  const handleVersionDownload = async (versionId: number, fileName: string) => {
    if (!evidence) return
    try {
      const { downloadFile } = await import('@/services/api')
      await downloadFile(`/evidences/${evidence.id}/versions/${versionId}/download`, fileName)
      message.success('다운로드가 시작되었습니다')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '파일 다운로드에 실패했습니다')
    }
  }

  const handleVersionDelete = async (versionId: number) => {
    if (!evidence) return
    try {
      await evidenceService.deleteVersion(evidence.id, versionId)
      message.success('버전이 삭제되었습니다')
      // 버전 목록 갱신
      const fresh = await evidenceService.getVersions(evidence.id)
      setVersions(fresh)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '버전 삭제에 실패했습니다')
    }
  }

  const handleControlMappingChange = async (controlIds: number[]) => {
    if (!evidence) return

    try {
      await evidenceService.mapControls(evidence.id, controlIds)
      message.success('통제항목 매핑이 수정되었습니다')
      fetchEvidence()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '통제항목 매핑 수정에 실패했습니다')
    }
  }

  const handleEdit = () => {
    if (!evidence) return
    editForm.setFieldsValue({
      title: evidence.title,
      description: (evidence as any).description,
      status: evidence.status,
      validFrom: (evidence as any).validFrom ? dayjs((evidence as any).validFrom) : undefined,
      validUntil: (evidence as any).validUntil ? dayjs((evidence as any).validUntil) : undefined,
    })
    setEditModalVisible(true)
  }

  const handleEditSubmit = async () => {
    if (!evidence) return
    try {
      const values = await editForm.validateFields()
      await evidenceService.updateEvidence(evidence.id, {
        title: values.title,
        description: values.description,
        status: values.status,
        validFrom: values.validFrom?.format('YYYY-MM-DD'),
        validUntil: values.validUntil?.format('YYYY-MM-DD'),
      })
      message.success('증적이 수정되었습니다')
      setEditModalVisible(false)
      fetchEvidence()
    } catch (err: any) {
      if (err?.errorFields) return
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '증적 수정에 실패했습니다')
    }
  }

  const handleVersionUpload = async () => {
    if (!evidence || !uploadFile) return
    try {
      const values = await uploadForm.validateFields()
      await evidenceService.uploadVersion(evidence.id, uploadFile, values.changeDescription || '')
      message.success('새 버전이 업로드되었습니다')
      setUploadModalVisible(false)
      setUploadFile(null)
      uploadForm.resetFields()
      fetchEvidence()
      fetchVersions()
    } catch (err: any) {
      if (err?.errorFields) return
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '버전 업로드에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!evidence) {
    return null
  }

  const statusInfo = statusConfig[evidence.status]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space style={{ marginBottom: 16 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/evidence')}
            >
              뒤로
            </Button>
          </Space>

          <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
            <Col>
              <Space align="center">
                <Title level={3} style={{ margin: 0 }}>
                  {evidence.title}
                </Title>
                <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                <Tag>v{evidence.version}</Tag>
              </Space>
            </Col>
            <Col>
              <Space>
                {canUpdate && (
                  <Button icon={<EditOutlined />} onClick={handleEdit}>수정</Button>
                )}
                {canUpdate && (
                  <Button icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>새 버전 업로드</Button>
                )}
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                >
                  다운로드
                </Button>
              </Space>
            </Col>
          </Row>

          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="설명" span={3}>
              {evidence.description}
            </Descriptions.Item>
            <Descriptions.Item label="파일명">
              {evidence.fileName}
            </Descriptions.Item>
            <Descriptions.Item label="파일 크기">
              {formatFileSize(evidence.fileSize)}
            </Descriptions.Item>
            <Descriptions.Item label="파일 해시">
              <Typography.Text code copyable>
                {evidence.fileHash}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="유효 시작일">
              {evidence.validFrom ? dayjs(evidence.validFrom).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="유효 기한">
              {evidence.validUntil ? dayjs(evidence.validUntil).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="등록자">
              {evidence.uploaderName}
            </Descriptions.Item>
            <Descriptions.Item label="등록일">
              {dayjs(evidence.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="최종 수정일">
              {dayjs(evidence.updatedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <FilePreview
              previewUrl={previewUrl}
              fileName={evidence.fileName}
              mimeType={evidence.mimeType}
              loading={previewLoading}
              onDownload={handleDownload}
            />
          </Col>
          <Col xs={24} lg={10}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <ControlMapping
                mappedControls={
                  ((evidence as any).controlIds || []).map((cid: number, idx: number) => {
                    const ctrl = availableControls.find(c => c.id === cid)
                    return {
                      id: cid,
                      code: ctrl?.code || ((evidence as any).controlCodes || [])[idx] || '',
                      title: ctrl?.title || '',
                    }
                  })
                }
                availableControls={availableControls}
                onChange={handleControlMappingChange}
                readOnly={!canUpdate}
              />
              <VersionHistory
                versions={versions}
                currentVersion={evidence.version}
                onDownload={handleVersionDownload}
                onDelete={handleVersionDelete}
                canDelete={canDelete}
                loading={versionsLoading}
              />
            </Space>
          </Col>
        </Row>
      </Space>

      {/* 수정 모달 */}
      <Modal
        title="증적 수정"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        okText="저장"
        cancelText="취소"
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="제목"
            rules={[{ required: true, message: '제목을 입력하세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status" label="상태">
            <Select>
              <Select.Option value="active">유효</Select.Option>
              <Select.Option value="draft">초안</Select.Option>
              <Select.Option value="expired">만료</Select.Option>
              <Select.Option value="archived">보관</Select.Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="validFrom" label="유효 시작일">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="validUntil" label="유효 기한">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 새 버전 업로드 모달 */}
      <Modal
        title="새 버전 업로드"
        open={uploadModalVisible}
        onOk={handleVersionUpload}
        onCancel={() => {
          setUploadModalVisible(false)
          setUploadFile(null)
          uploadForm.resetFields()
        }}
        okText="업로드"
        cancelText="취소"
        okButtonProps={{ disabled: !uploadFile }}
      >
        <Form form={uploadForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="파일" required>
            <Upload.Dragger
              beforeUpload={(file) => {
                setUploadFile(file)
                return false
              }}
              onRemove={() => setUploadFile(null)}
              maxCount={1}
              fileList={uploadFile ? [{ uid: '-1', name: uploadFile.name, status: 'done' }] : []}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">클릭하거나 파일을 드래그하여 업로드하세요</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="changeDescription" label="변경 내역">
            <Input.TextArea rows={3} placeholder="이 버전에서 변경된 내용을 입력하세요" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default EvidenceDetail
