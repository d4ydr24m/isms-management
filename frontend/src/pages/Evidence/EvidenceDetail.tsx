import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  message,
  Row,
  Col,
  Spin,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { FilePreview, ControlMapping, VersionHistory } from './components'
import { evidenceService } from '@/services/evidences'
import { controlService } from '@/services/controls'
import dayjs from 'dayjs'
import type { Evidence, EvidenceVersion, ControlItem } from '@/types'

const { Title } = Typography

const statusConfig: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: 'Active' },
  draft: { color: 'orange', text: 'Draft' },
  expired: { color: 'red', text: 'Expired' },
  archived: { color: 'default', text: 'Archived' },
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const EvidenceDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [evidence, setEvidence] = useState<Evidence | null>(null)
  const [versions, setVersions] = useState<EvidenceVersion[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [availableControls, setAvailableControls] = useState<ControlItem[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  const fetchEvidence = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const data = await evidenceService.getEvidence(Number(id))
      setEvidence(data)
    } catch {
      message.error('Failed to load evidence')
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
      message.error('Failed to load version history')
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
      const response = await controlService.getControls({ limit: 100 })
      setAvailableControls(response.data || [])
    } catch {
      message.error('Failed to load control items')
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
      message.success('Download started')
    } catch {
      message.error('Failed to download file')
    }
  }

  const handleVersionDownload = async (versionId: number, fileName: string) => {
    try {
      await evidenceService.downloadEvidence(versionId, fileName)
      message.success('Download started')
    } catch {
      message.error('Failed to download file')
    }
  }

  const handleControlMappingChange = async (controlIds: number[]) => {
    if (!evidence) return

    try {
      await evidenceService.mapControls(evidence.id, controlIds)
      message.success('Control mapping updated')
      fetchEvidence()
    } catch {
      message.error('Failed to update control mapping')
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
              Back
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
                <Link to={`/evidence/${evidence.id}/edit`}>
                  <Button icon={<EditOutlined />}>Edit</Button>
                </Link>
                <Link to={`/evidence/${evidence.id}/upload`}>
                  <Button icon={<UploadOutlined />}>Upload New Version</Button>
                </Link>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                >
                  Download
                </Button>
              </Space>
            </Col>
          </Row>

          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Description" span={3}>
              {evidence.description}
            </Descriptions.Item>
            <Descriptions.Item label="File Name">
              {evidence.fileName}
            </Descriptions.Item>
            <Descriptions.Item label="File Size">
              {formatFileSize(evidence.fileSize)}
            </Descriptions.Item>
            <Descriptions.Item label="File Hash">
              <Typography.Text code copyable>
                {evidence.fileHash}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Valid From">
              {evidence.validFrom ? dayjs(evidence.validFrom).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Valid Until">
              {evidence.validUntil ? dayjs(evidence.validUntil).format('YYYY-MM-DD') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Uploader">
              {evidence.uploaderName}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {dayjs(evidence.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
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
                mappedControls={evidence.controlItems}
                availableControls={availableControls}
                onChange={handleControlMappingChange}
              />
              <VersionHistory
                versions={versions}
                currentVersion={evidence.version}
                onDownload={handleVersionDownload}
                loading={versionsLoading}
              />
            </Space>
          </Col>
        </Row>
      </Space>
    </div>
  )
}

export default EvidenceDetail
