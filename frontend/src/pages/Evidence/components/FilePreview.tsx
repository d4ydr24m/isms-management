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

// 서버에서 LibreOffice로 PDF 변환되는 Office 문서 유형
// (백엔드 preview_service.OFFICE_EXTENSIONS와 동기화)
const OFFICE_EXTENSIONS = new Set([
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'odt', 'ods', 'odp', 'rtf', 'csv',
])
const OFFICE_MIME_PREFIXES = [
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.',
  'application/vnd.oasis.opendocument.',
  'application/haansoftdocx',
  'application/haansoftxlsx',
  'application/haansoftpptx',
  'application/rtf',
  'text/rtf',
  'text/csv',
]

function isOfficeDocument(mimeType: string, fileName: string): boolean {
  if (OFFICE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return true
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return false
  const ext = fileName.slice(dot + 1).toLowerCase()
  return OFFICE_EXTENSIONS.has(ext)
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
  // Office 문서는 백엔드가 PDF로 변환해 스트리밍하므로 iframe으로 렌더
  const isOffice = isOfficeDocument(mimeType, fileName)

  const canPreview = (isPdf || isImage || isOffice) && previewUrl

  const renderPreview = () => {
    if (!previewUrl) {
      return (
        <Empty
          image={<FileOutlined style={{ fontSize: 64, color: '#ccc' }} />}
          description="미리보기를 사용할 수 없습니다"
        >
          <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload}>
            파일 다운로드
          </Button>
        </Empty>
      )
    }

    if (isPdf || isOffice) {
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
            <Text>이 파일 유형은 미리보기를 지원하지 않습니다</Text>
            <Text type="secondary">{mimeType}</Text>
          </Space>
        }
      >
        <Button type="primary" icon={<DownloadOutlined />} onClick={onDownload}>
          다운로드하여 보기
        </Button>
      </Empty>
    )
  }

  return (
    <Spin spinning={loading}>
      <Card
        title="파일 미리보기"
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
                전체 화면
              </Button>
            )}
          </Space>
        }
      >
        {renderPreview()}
      </Card>
    </Spin>
  )
}

export default FilePreview
