/**
 * 결함 증적 관리 페이지 (감사 관리 > 결함 증적 관리).
 *
 * 부적합(NC)에 연결된 증적을 '전 NC 범위'로 한눈에 볼 수 있게 한다. 일반 ISMS 증적
 * 관리(/evidences)와 정보 구조상 분리되어 있으며, 아이템 클릭 시 해당 NC 상세로 이동한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  App,
  Card,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'

import { auditService } from '@/services/audits'
import { formatDateTime } from '@/utils/format'
import type { NcEvidenceRow } from '@/types'

const { Option } = Select
const { Text } = Typography

const humanSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const NcEvidencesPage = () => {
  const { message } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()

  // 필터 상태는 URL 쿼리로 동기화하여 새로고침/공유 가능.
  const ncIdParam = searchParams.get('ncId')
  const nonConformityId = ncIdParam ? Number(ncIdParam) : undefined
  const search = searchParams.get('q') || ''

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [rows, setRows] = useState<NcEvidenceRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 부적합 필터용 옵션 (상단 풀다운). 실제 운영에서는 백엔드의 nonconformities API 를
  // 사용하지만, 여기서는 현재 결과에 등장한 NC id 목록으로 간략히 구성한다.
  const ncOptions = useMemo(() => {
    const map = new Map<number, string>()
    rows.forEach((r) => {
      if (!map.has(r.nonConformityId)) {
        map.set(r.nonConformityId, r.nonConformityTitle || `NC #${r.nonConformityId}`)
      }
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [rows])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await auditService.listAllNcEvidences({
        page,
        pageSize,
        nonConformityId,
        search: search || undefined,
      })
      setRows(data.items)
      setTotal(data.total)
    } catch {
      message.error('결함 증적 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [message, nonConformityId, page, pageSize, search])

  useEffect(() => {
    load()
  }, [load])

  const handleSearchChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next)
    setPage(1)
  }

  const handleNcChange = (ncId: number | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (ncId !== undefined) next.set('ncId', String(ncId))
    else next.delete('ncId')
    setSearchParams(next)
    setPage(1)
  }

  const columns: ColumnsType<NcEvidenceRow> = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '파일',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 200,
      render: (name: string, row) => (
        <Space direction="vertical" size={0}>
          <Text>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {humanSize(row.fileSize)}
            {row.mimeType ? ` · ${row.mimeType}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: '연결된 부적합',
      key: 'nonConformity',
      width: 320,
      render: (_, row) => (
        <Link to={`/non-conformities/${row.nonConformityId}`}>
          <Space>
            <Tag>NC #{row.nonConformityId}</Tag>
            <Text>{row.nonConformityTitle || '-'}</Text>
          </Space>
        </Link>
      ),
    },
    {
      title: '매핑 메모',
      dataIndex: 'mappingNote',
      key: 'mappingNote',
      ellipsis: true,
      render: (note: string | null) => note || <Text type="secondary">-</Text>,
    },
    {
      title: '연결 일시',
      dataIndex: 'mappedAt',
      key: 'mappedAt',
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
  ]

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (t) => `총 ${t}건`,
    onChange: (p, size) => {
      setPage(p)
      if (size && size !== pageSize) setPageSize(size)
    },
  }

  return (
    <Card title="결함 증적 관리">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="증적 제목 또는 파일명 검색"
            defaultValue={search}
            onSearch={handleSearchChange}
            style={{ width: 280 }}
            prefix={<SearchOutlined />}
          />
          <Select
            allowClear
            placeholder="부적합 필터"
            style={{ width: 260 }}
            value={nonConformityId}
            onChange={(v) => handleNcChange(v)}
          >
            {ncOptions.map((n) => (
              <Option key={n.id} value={n.id}>
                NC #{n.id} · {n.title}
              </Option>
            ))}
          </Select>
        </Space>
        <Table<NcEvidenceRow>
          rowKey={(r) => r.mappingId}
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={pagination}
        />
      </Space>
    </Card>
  )
}

export default NcEvidencesPage
