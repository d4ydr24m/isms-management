/**
 * 데이터베이스 백업/복원 설정 페이지
 */
import { useState, useEffect, useCallback } from 'react'
import {
  App,
  Card,
  Button,
  Space,
  Table,
  Typography,
  Alert,
  Upload,
  Popconfirm,
  Tag,
  Tooltip,
  Input,
  Modal,
} from 'antd'
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import {
  getBackups,
  createBackup,
  restoreBackup,
  restoreFromUpload,
  downloadBackup,
  deleteBackup,
} from '@/services/backup'
import type { BackupInfo } from '@/services/backup'

const { Text } = Typography
const { TextArea } = Input

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const BackupSettings: React.FC = () => {
  const { message, modal } = App.useApp()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [description, setDescription] = useState('')
  const [uploadFile, setUploadFile] = useState<UploadFile | null>(null)

  const loadBackups = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getBackups()
      setBackups(result.items)
    } catch {
      message.error('백업 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const handleCreateBackup = async () => {
    setCreating(true)
    try {
      await createBackup(description)
      message.success('백업이 생성되었습니다.')
      setDescription('')
      loadBackups()
    } catch {
      message.error('백업 생성 실패')
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = (backup: BackupInfo) => {
    modal.confirm({
      title: '데이터베이스 복원',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            <Text strong>{backup.fileName}</Text> 백업으로 복원하시겠습니까?
          </p>
          <Alert
            type="error"
            showIcon
            message="현재 데이터가 모두 백업 시점의 데이터로 대체됩니다."
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '복원',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        setRestoring(true)
        try {
          const result = await restoreBackup(backup.filePath)
          message.success(result.message)
          loadBackups()
        } catch {
          message.error('복원 실패')
        } finally {
          setRestoring(false)
        }
      },
    })
  }

  const handleRestoreFromFile = () => {
    if (!uploadFile) {
      message.error('백업 파일을 선택해주세요.')
      return
    }

    modal.confirm({
      title: '파일에서 복원',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            업로드한 <Text strong>{(uploadFile as unknown as File).name}</Text> 파일로 복원하시겠습니까?
          </p>
          <Alert
            type="error"
            showIcon
            message="현재 데이터가 모두 대체됩니다. 이 작업은 되돌릴 수 없습니다."
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '복원',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        setRestoring(true)
        try {
          const result = await restoreFromUpload(uploadFile as unknown as File)
          message.success(result.message)
          setUploadFile(null)
          loadBackups()
        } catch {
          message.error('복원 실패')
        } finally {
          setRestoring(false)
        }
      },
    })
  }

  const handleDownload = async (backup: BackupInfo) => {
    try {
      await downloadBackup(backup.fileName)
    } catch {
      message.error('다운로드 실패')
    }
  }

  const handleDelete = async (backup: BackupInfo) => {
    try {
      await deleteBackup(backup.fileName)
      message.success('백업이 삭제되었습니다.')
      loadBackups()
    } catch {
      message.error('삭제 실패')
    }
  }

  const columns: ColumnsType<BackupInfo> = [
    {
      title: '파일명',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (name: string) => (
        <Space>
          <SaveOutlined />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '크기',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '생성일시',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="다운로드">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          <Tooltip title="이 백업으로 복원">
            <Button
              type="text"
              size="small"
              icon={<UndoOutlined />}
              onClick={() => handleRestore(record)}
              loading={restoring}
            />
          </Tooltip>
          <Popconfirm
            title="이 백업을 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record)}
            okText="삭제"
            cancelText="취소"
          >
            <Tooltip title="삭제">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 백업 생성 */}
      <Card
        title={
          <Space>
            <CloudUploadOutlined style={{ color: '#1890ff' }} />
            <span>백업 생성</span>
          </Space>
        }
        variant="borderless"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">
            데이터베이스와 업로드된 모든 파일(증적, 스크립트 등)의 전체 백업을 생성합니다.
            백업은 서버에 저장되며, 매일 오전 3시에 자동 백업이 실행됩니다. (30일 보관)
          </Text>
          <Input
            placeholder="백업 설명 (선택사항)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ maxWidth: 400 }}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleCreateBackup}
            loading={creating}
          >
            지금 백업 생성
          </Button>
        </Space>
      </Card>

      {/* 백업 목록 */}
      <Card
        title={
          <Space>
            <HistoryOutlined style={{ color: '#52c41a' }} />
            <span>백업 내역</span>
            <Tag>{backups.length}건</Tag>
          </Space>
        }
        variant="borderless"
      >
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="filePath"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
          locale={{ emptyText: '백업 내역이 없습니다.' }}
        />
      </Card>

      {/* 파일에서 복원 */}
      <Card
        title={
          <Space>
            <CloudDownloadOutlined style={{ color: '#faad14' }} />
            <span>파일에서 복원</span>
          </Space>
        }
        variant="borderless"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="주의: 복원 시 현재 데이터베이스와 파일이 모두 대체됩니다."
            description="복원 전에 반드시 현재 상태를 백업해두세요. 복원은 되돌릴 수 없습니다. (.zip 파일은 DB+파일 전체 복원, .sql 파일은 DB만 복원)"
          />
          <Upload
            beforeUpload={(file) => {
              setUploadFile(file as unknown as UploadFile)
              return false
            }}
            maxCount={1}
            fileList={uploadFile ? [uploadFile] : []}
            onRemove={() => setUploadFile(null)}
            accept=".zip,.sql,.dump,.bak"
          >
            <Button icon={<CloudUploadOutlined />}>백업 파일 선택 (.zip, .sql)</Button>
          </Upload>
          {uploadFile && (
            <Button
              type="primary"
              danger
              icon={<UndoOutlined />}
              onClick={handleRestoreFromFile}
              loading={restoring}
            >
              업로드한 파일로 복원
            </Button>
          )}
        </Space>
      </Card>
    </Space>
  )
}

export default BackupSettings
