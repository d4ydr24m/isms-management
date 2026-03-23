import { Table, Space, Button, Tooltip, Tag } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import type { ColumnsType, TableProps } from 'antd/es/table'
import type { EvidenceListItem, EvidenceStatus } from '@/types'

interface EvidenceTableProps {
  data: EvidenceListItem[]
  loading?: boolean
  pagination?: {
    current: number
    pageSize: number
    total: number
  }
  onTableChange?: TableProps<EvidenceListItem>['onChange']
  onDelete?: (id: number) => void
  onDownload?: (id: number, fileName: string) => void
  rowSelection?: TableProps<EvidenceListItem>['rowSelection']
}

const statusConfig: Record<
  EvidenceStatus,
  { color: string; text: string }
> = {
  active: { color: 'green', text: '유효' },
  draft: { color: 'orange', text: '초안' },
  expired: { color: 'red', text: '만료' },
  archived: { color: 'default', text: '보관' },
}

const EvidenceTable = ({
  data,
  loading = false,
  pagination,
  onTableChange,
  onDelete,
  onDownload,
  rowSelection,
}: EvidenceTableProps) => {
  const columns: ColumnsType<EvidenceListItem> = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      render: (text: string, record: EvidenceListItem) => (
        <Link to={`/evidence/${record.id}`}>{text}</Link>
      ),
    },
    {
      title: '파일명',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      render: (status: EvidenceStatus) => {
        const config = statusConfig[status]
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '버전',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      align: 'center',
      render: (version: number) => `v${version}`,
    },
    {
      title: '유효 기한',
      dataIndex: 'validUntil',
      key: 'validUntil',
      sorter: true,
      render: (validUntil: string | null) => validUntil || '-',
    },
    {
      title: '등록자',
      dataIndex: 'uploaderName',
      key: 'uploaderName',
    },
    {
      title: '통제항목',
      dataIndex: 'controlItemCount',
      key: 'controlItemCount',
      width: 80,
      align: 'center',
    },
    {
      title: '작업',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: EvidenceListItem) => (
        <Space size="small">
          <Tooltip title="보기">
            <Link to={`/evidence/${record.id}`}>
              <Button type="text" size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
          <Tooltip title="수정">
            <Link to={`/evidence/${record.id}/edit`}>
              <Button type="text" size="small" icon={<EditOutlined />} />
            </Link>
          </Tooltip>
          {onDownload && (
            <Tooltip title="다운로드">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => onDownload(record.id, record.fileName)}
              />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="삭제">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onDelete(record.id)}
                aria-label="delete"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Table<EvidenceListItem>
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={
        pagination
          ? {
              ...pagination,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} / 총 ${total}건`,
            }
          : false
      }
      onChange={onTableChange}
      rowSelection={rowSelection}
      bordered
      locale={{
        emptyText: '데이터가 없습니다',
      }}
    />
  )
}

export default EvidenceTable
