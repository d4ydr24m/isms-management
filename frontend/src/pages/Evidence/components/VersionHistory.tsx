import { Card, Timeline, Button, Tag, Typography, Space, Empty, Spin, Popconfirm } from 'antd'
import { DownloadOutlined, UserOutlined, FileOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { EvidenceVersion } from '@/types'

const { Text, Title } = Typography

interface VersionHistoryProps {
  versions: EvidenceVersion[]
  currentVersion: number
  onDownload: (versionId: number, fileName: string) => void
  onDelete?: (versionId: number) => void
  canDelete?: boolean
  loading?: boolean
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const VersionHistory = ({
  versions,
  currentVersion,
  onDownload,
  onDelete,
  canDelete = false,
  loading = false,
}: VersionHistoryProps) => {
  // Sort versions from newest to oldest
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version)

  return (
    <Spin spinning={loading}>
      <Card title="버전 이력">
        {sortedVersions.length === 0 ? (
          <Empty
            description="버전 이력이 없습니다"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Timeline
            items={sortedVersions.map((version) => ({
              color: version.version === currentVersion ? 'green' : 'gray',
              children: (
                <div key={version.id} style={{ paddingBottom: 8 }}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space align="center">
                      <Title level={5} style={{ margin: 0 }}>
                        v{version.version}
                      </Title>
                      {version.version === currentVersion && (
                        <Tag color="green">현재</Tag>
                      )}
                    </Space>

                    <Text>{version.fileName}</Text>

                    {version.changes && (
                      <Text type="secondary">{version.changes}</Text>
                    )}

                    <Space size="middle">
                      <Space size="small">
                        <UserOutlined />
                        <Text>{version.uploaderName}</Text>
                      </Space>
                      <Space size="small">
                        <FileOutlined />
                        <Text>{formatFileSize(version.fileSize)}</Text>
                      </Space>
                      <Text type="secondary">
                        {dayjs(version.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </Space>

                    <Space size="small">
                      <Button
                        type="link"
                        icon={<DownloadOutlined />}
                        onClick={() => onDownload(version.id, version.fileName)}
                        style={{ padding: 0 }}
                        aria-label="download"
                      >
                        다운로드
                      </Button>
                      {canDelete && onDelete && version.version !== currentVersion && (
                        <Popconfirm
                          title="버전 삭제"
                          description={`v${version.version} 파일을 삭제하시겠습니까? 복구할 수 없습니다.`}
                          onConfirm={() => onDelete(version.id)}
                          okText="삭제"
                          okButtonProps={{ danger: true }}
                          cancelText="취소"
                        >
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            style={{ padding: 0 }}
                            aria-label="delete version"
                          >
                            삭제
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                  </Space>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </Spin>
  )
}

export default VersionHistory
