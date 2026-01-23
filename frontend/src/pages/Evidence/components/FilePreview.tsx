import { Card, Button, Space, Typography, Empty, Spin, Image } from 'antd'
import { DownloadOutlined, ExpandOutlined, FileOutlined } from '@ant-design/icons'

const { Text } = Typography

interface FilePreviewProps {
  previewUrl: string | null
  fileName: string
  mimeType: string
  loading?: boolean
  onDownload: () => void
}

const FilePreview = ({
  previewUrl,
  fileName,
  mimeType,
  loading = false,
  onDownload,
}: FilePreviewProps) => {
  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')

  const canPreview = (isPdf || isImage) && previewUrl

  const renderPreview = () => {
    if (!previewUrl) {
      return (
        <Empty
          image={<FileOutlined style={{ fontSize: 64, color: '#ccc' }} />}
          description="No preview available"
        >
          <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload}>
            Download File
          </Button>
        </Empty>
      )
    }

    if (isPdf) {
      return (
        <iframe
          src={previewUrl}
          title={fileName}
          style={{
            width: '100%',
            height: '600px',
            border: 'none',
          }}
        />
      )
    }

    if (isImage) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Image
            src={previewUrl}
            alt={fileName}
            style={{
              maxWidth: '100%',
              maxHeight: '600px',
              objectFit: 'contain',
            }}
          />
        </div>
      )
    }

    // Unsupported file type
    return (
      <Empty
        image={<FileOutlined style={{ fontSize: 64, color: '#ccc' }} />}
        description={
          <Space direction="vertical" size="small">
            <Text>Preview not available for this file type</Text>
            <Text type="secondary">{mimeType}</Text>
          </Space>
        }
      >
        <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload}>
          Download to View
        </Button>
      </Empty>
    )
  }

  return (
    <Spin spinning={loading}>
      <Card
        title="File Preview"
        extra={
          <Space>
            <Text type="secondary">{fileName}</Text>
            {canPreview && (
              <Button
                type="text"
                icon={<ExpandOutlined />}
                onClick={() => window.open(previewUrl!, '_blank')}
                aria-label="fullscreen"
              >
                Fullscreen
              </Button>
            )}
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={onDownload}
            >
              Download
            </Button>
          </Space>
        }
      >
        {renderPreview()}
      </Card>
    </Spin>
  )
}

export default FilePreview
