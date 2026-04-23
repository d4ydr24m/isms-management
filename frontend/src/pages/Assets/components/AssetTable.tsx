/**
 * 자산 테이블 컴포넌트
 * 정렬, 필터, 페이지네이션 지원
 */
import { Link } from 'react-router-dom'
import { Table, Tag, Button, Space, Tooltip, Select } from 'antd'
import { EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons'
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
  selectedRowKeys?: React.Key[]
  onSelectionChange?: (keys: React.Key[]) => void
  canUpdate?: boolean
  canDelete?: boolean
  /** 상세 페이지에서 "뒤로가기" 시 복귀할 목록 URL 검색 문자열 (예: "?page=2&status=operating") */
  listSearch?: string
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
  selectedRowKeys,
  onSelectionChange,
  canUpdate = true,
  canDelete = true,
  listSearch,
}: AssetTableProps) => {
  // 상세 페이지에서 목록 복귀 시 필터를 복원할 수 있도록 현재 목록의 검색 문자열을 state로 전달
  const detailLinkState = listSearch ? { listSearch } : undefined

  const columns: TableProps<Asset>['columns'] = [
    {
      title: '자산코드',
      dataIndex: 'assetCode',
      key: 'assetCode',
      width: 180,
      sorter: true,
      render: (code: string, record: Asset) => (
        <Link to={`/assets/${record.id}`} state={detailLinkState} style={{ fontFamily: 'monospace' }}>
          {code}
        </Link>
      ),
    },
    {
      title: '자산명',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: true,
      render: (name: string, record: Asset) => {
        let eolTag = null
        if (record.eolDate) {
          const days = Math.ceil((new Date(record.eolDate).getTime() - Date.now()) / 86400000)
          if (days < 0) {
            eolTag = <Tooltip title={`EoL 만료 (${Math.abs(days)}일 경과)`}><Tag color="red" style={{ marginLeft: 4, fontSize: 11 }}><WarningOutlined /> EoL</Tag></Tooltip>
          } else if (days <= 90) {
            eolTag = <Tooltip title={`EoL ${days}일 남음`}><Tag color="orange" style={{ marginLeft: 4, fontSize: 11 }}><WarningOutlined /> EoL</Tag></Tooltip>
          }
        }
        return (
          <span>
            <Link to={`/assets/${record.id}`} state={detailLinkState}>{name}</Link>
            {eolTag}
          </span>
        )
      },
    },
    {
      title: '유형',
      dataIndex: 'assetTypeName',
      key: 'assetTypeName',
      width: 120,
      sorter: true,
    },
    {
      title: '분류',
      dataIndex: 'categoryNames',
      key: 'categoryNames',
      width: 150,
      ellipsis: true,
      render: (names?: string[]) => names && names.length > 0 ? names.join(', ') : '-',
    },
    {
      title: '담당부서',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120,
      render: (name?: string) => name || '-',
    },
    {
      title: '소유자',
      dataIndex: 'personnelOwnerName',
      key: 'personnelOwnerName',
      width: 100,
      render: (name?: string) => name || '-',
    },
    {
      title: '담당자',
      dataIndex: 'assigneeNames',
      key: 'assigneeNames',
      width: 120,
      render: (names?: string[]) => names && names.length > 0 ? names.join(', ') : '-',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      sorter: true,
      render: (status: string, record: Asset) => onStatusChange && canUpdate ? (
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
      sorter: true,
      render: (level?: number) => {
        if (!level) return '-'
        const { label, color } = importanceLabelMap[level] || { label: '-', color: 'default' }
        return <Tag color={color}>{label}</Tag>
      },
    },
    ...(canUpdate || canDelete ? [{
      title: '액션',
      key: 'actions',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: Asset) => (
        <Space size="small">
          {canUpdate && (
            <Tooltip title="수정">
              <Link to={`/assets/${record.id}/edit`}>
                <Button type="text" icon={<EditOutlined />} size="small" />
              </Link>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="삭제">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                onClick={() => onDelete(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    }] : []),
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
      rowSelection={onSelectionChange ? {
        selectedRowKeys,
        onChange: onSelectionChange,
      } : undefined}
    />
  )
}

export default AssetTable
