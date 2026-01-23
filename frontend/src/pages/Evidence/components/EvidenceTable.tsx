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
  active: { color: 'green', text: 'Active' },
  draft: { color: 'orange', text: 'Draft' },
  expired: { color: 'red', text: 'Expired' },
  archived: { color: 'default', text: 'Archived' },
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
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      render: (text: string, record: EvidenceListItem) => (
        <Link to={`/evidence/${record.id}`}>{text}</Link>
      ),
    },
    {
      title: 'File Name',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: EvidenceStatus) => {
        const config = statusConfig[status]
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      align: 'center',
      render: (version: number) => `v${version}`,
    },
    {
      title: 'Valid Until',
      dataIndex: 'validUntil',
      key: 'validUntil',
      sorter: true,
      render: (validUntil: string | null) => validUntil || '-',
    },
    {
      title: 'Uploader',
      dataIndex: 'uploaderName',
      key: 'uploaderName',
    },
    {
      title: 'Controls',
      dataIndex: 'controlItemCount',
      key: 'controlItemCount',
      width: 80,
      align: 'center',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: EvidenceListItem) => (
        <Space size="small">
          <Tooltip title="View">
            <Link to={`/evidence/${record.id}`}>
              <Button type="text" size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
          <Tooltip title="Edit">
            <Link to={`/evidence/${record.id}/edit`}>
              <Button type="text" size="small" icon={<EditOutlined />} />
            </Link>
          </Tooltip>
          {onDownload && (
            <Tooltip title="Download">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => onDownload(record.id, record.fileName)}
              />
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete">
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
                `${range[0]}-${range[1]} of ${total} items`,
            }
          : false
      }
      onChange={onTableChange}
      rowSelection={rowSelection}
      bordered
      locale={{
        emptyText: 'No data',
      }}
    />
  )
}

export default EvidenceTable
