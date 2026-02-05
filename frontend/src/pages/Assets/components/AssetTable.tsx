/**
 * 자산 테이블 컴포넌트
 * 정렬, 필터, 페이지네이션 지원
 */
import { Link } from 'react-router-dom'
import { Table, Tag, Button, Space, Tooltip } from 'antd'
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import type { TableProps, TablePaginationConfig } from 'antd'
import type { Asset, AssetStatus } from '@/types'

interface AssetTableProps {
  data: Asset[]
  loading: boolean
  pagination: {
    current: number
    pageSize: number
    total: number
  }
  onTableChange: TableProps<Asset>['onChange']
  onDelete: (id: number) => void
}

/** 자산 상태 태그 색상 매핑 */
const statusColorMap: Record<AssetStatus, string> = {
  introduced: 'blue',
  operating: 'green',
  changed: 'orange',
  disposed: 'default',
}

/** 자산 상태 레이블 매핑 */
const statusLabelMap: Record<AssetStatus, string> = {
  introduced: '도입',
  operating: '운영',
  changed: '변경',
  disposed: '폐기',
}

/** 중요도 레이블 매핑 */
const importanceLabelMap: Record<number, { label: string; color: string }> = {
  1: { label: '하', color: 'default' },
  2: { label: '중', color: 'blue' },
  3: { label: '상', color: 'red' },
}

const AssetTable = ({
  data,
  loading,
  pagination,
  onTableChange,
  onDelete,
}: AssetTableProps) => {
  const columns: TableProps<Asset>['columns'] = [
    {
      title: '자산코드',
      dataIndex: 'assetCode',
      key: 'assetCode',
      width: 180,
      render: (code: string, record: Asset) => (
        <Link to={`/assets/${record.id}`} style={{ fontFamily: 'monospace' }}>
          {code}
        </Link>
      ),
    },
    {
      title: '자산명',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record: Asset) => (
        <Link to={`/assets/${record.id}`}>{name}</Link>
      ),
    },
    {
      title: '유형',
      dataIndex: 'assetTypeName',
      key: 'assetTypeName',
      width: 120,
    },
    {
      title: '담당부서',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120,
      render: (name?: string) => name || '-',
    },
    {
      title: '담당자',
      dataIndex: 'ownerName',
      key: 'ownerName',
      width: 100,
      render: (name?: string) => name || '-',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: AssetStatus) => (
        <Tag color={statusColorMap[status]}>{statusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '중요도',
      dataIndex: 'importanceLevel',
      key: 'importanceLevel',
      width: 80,
      align: 'center',
      render: (level?: number) => {
        if (!level) return '-'
        const { label, color } = importanceLabelMap[level] || { label: '-', color: 'default' }
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: '액션',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_: unknown, record: Asset) => (
        <Space size="small">
          <Tooltip title="상세보기">
            <Link to={`/assets/${record.id}`}>
              <Button type="text" icon={<EyeOutlined />} size="small" />
            </Link>
          </Tooltip>
          <Tooltip title="수정">
            <Link to={`/assets/${record.id}/edit`}>
              <Button type="text" icon={<EditOutlined />} size="small" />
            </Link>
          </Tooltip>
          <Tooltip title="삭제">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              onClick={() => onDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const paginationConfig: TablePaginationConfig = {
    ...pagination,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total) => `총 ${total}건`,
    pageSizeOptions: ['10', '20', '50', '100'],
  }

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={paginationConfig}
      onChange={onTableChange}
      scroll={{ x: 900 }}
      size="middle"
    />
  )
}

export default AssetTable
