/**
 * 자산 테이블 컴포넌트
 * 정렬, 필터, 페이지네이션 지원
 */
import { Link } from 'react-router-dom'
import { Table, Tag, Button, Space, Tooltip, Select } from 'antd'
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
  onStatusChange?: (id: number, status: string) => void
}

/** 자산 상태 태그 색상 매핑 (DB에 한국어로 저장됨) */
const statusColorMap: Record<string, string> = {
  '도입': 'blue',
  '운영': 'green',
  '변경': 'orange',
  '폐기': 'default',
  // 영문 호환
  introduced: 'blue',
  operating: 'green',
  changed: 'orange',
  disposed: 'default',
}

/** 자산 상태 레이블 매핑 */
const statusLabelMap: Record<string, string> = {
  '도입': '도입',
  '운영': '운영',
  '변경': '변경',
  '폐기': '폐기',
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

const statusOptions = [
  { value: '도입', label: '도입', color: 'blue' },
  { value: '운영', label: '운영', color: 'green' },
  { value: '변경', label: '변경', color: 'orange' },
  { value: '폐기', label: '폐기', color: 'default' },
]

const AssetTable = ({
  data,
  loading,
  pagination,
  onTableChange,
  onDelete,
  onStatusChange,
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
      width: 110,
      render: (status: string, record: Asset) => onStatusChange ? (
        <Select
          value={statusLabelMap[status] ? (Object.entries(statusLabelMap).find(([k, v]) => k === status)?.[0] || status) : status}
          size="small"
          variant="borderless"
          style={{ width: 90 }}
          onChange={(val) => onStatusChange(record.id, val)}
          options={statusOptions.map(o => ({
            value: o.value,
            label: <Tag color={o.color} style={{ margin: 0 }}>{o.label}</Tag>,
          }))}
        />
      ) : status ? (
        <Tag color={statusColorMap[status] || 'default'}>{statusLabelMap[status] || status}</Tag>
      ) : '—',
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
