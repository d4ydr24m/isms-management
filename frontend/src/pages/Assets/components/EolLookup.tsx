/**
 * EoL 조회 모달
 * endoflife.date API를 통해 제품의 EoL 날짜를 조회하고 선택
 */
import { useState, useCallback } from 'react'
import {
  App,
  Modal,
  Input,
  Select,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Empty,
  Alert,
} from 'antd'
import { SearchOutlined, CalendarOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { eolService } from '@/services/eol'
import type { CycleInfo } from '@/services/eol'
import dayjs from 'dayjs'

const { Text } = Typography

interface EolLookupProps {
  open: boolean
  onClose: () => void
  onSelect: (eolDate: string, product: string, cycle: string) => void
  initialQuery?: string
}

const EolLookup = ({ open, onClose, onSelect, initialQuery }: EolLookupProps) => {
  const { message, modal } = App.useApp()

  // Step 1: Product search
  const [searchQuery, setSearchQuery] = useState(initialQuery || '')
  const [products, setProducts] = useState<string[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Step 2: Product cycles
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [cycles, setCycles] = useState<CycleInfo[]>([])
  const [cyclesLoading, setCyclesLoading] = useState(false)

  // Date pick dialog (when multiple dates available)
  const [datePickOpen, setDatePickOpen] = useState(false)
  const [dateOptions, setDateOptions] = useState<{ label: string; date: string }[]>([])
  const [datePickCycle, setDatePickCycle] = useState<CycleInfo | null>(null)

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSelectedProduct(null)
    setCycles([])
    try {
      const data = await eolService.searchProducts(searchQuery.trim())
      setProducts(data.products)
      if (data.products.length === 0) {
        message.info('검색 결과가 없습니다.')
      }
    } catch {
      message.error('제품 검색에 실패했습니다.')
    } finally {
      setSearchLoading(false)
    }
  }, [searchQuery, message])

  const handleSelectProduct = useCallback(async (product: string) => {
    setSelectedProduct(product)
    setCyclesLoading(true)
    try {
      const data = await eolService.getProductCycles(product)
      setCycles(data.cycles)
    } catch {
      message.error('버전 정보를 불러오는데 실패했습니다.')
    } finally {
      setCyclesLoading(false)
    }
  }, [message])

  const handleSelectCycle = (cycle: CycleInfo) => {
    const eolDate = typeof cycle.eol === 'string' ? cycle.eol : null
    const ltsDate = typeof cycle.extendedSupport === 'string'
      ? cycle.extendedSupport
      : typeof cycle.lts === 'string'
        ? cycle.lts
        : null
    const supportDate = typeof cycle.support === 'string' ? cycle.support : null

    // Collect all available dates
    const options: { label: string; date: string }[] = []
    if (eolDate) options.push({ label: `EoL: ${eolDate}`, date: eolDate })
    if (ltsDate && ltsDate !== eolDate) options.push({ label: `LTS / 연장지원: ${ltsDate}`, date: ltsDate })
    if (supportDate && supportDate !== eolDate && supportDate !== ltsDate) {
      options.push({ label: `기본 지원: ${supportDate}`, date: supportDate })
    }

    if (options.length === 0) {
      modal.confirm({
        title: 'EoL 날짜 미지정',
        content: `${cycle.releaseLabel || cycle.cycle} 버전은 현재 지원 중이며 EoL 날짜가 지정되지 않았습니다. EoL 없이 닫으시겠습니까?`,
        okText: '닫기',
        cancelText: '취소',
        onOk: () => handleReset(),
      })
      return
    }

    if (options.length === 1) {
      onSelect(options[0].date, selectedProduct || '', cycle.cycle)
      handleReset()
      return
    }

    // Multiple dates available — let user choose
    setDateOptions(options)
    setDatePickCycle(cycle)
    setDatePickOpen(true)
  }

  const handleReset = () => {
    setSearchQuery(initialQuery || '')
    setProducts([])
    setSelectedProduct(null)
    setCycles([])
    onClose()
  }

  const getEolStatus = (eol: string | boolean | null) => {
    if (eol === false || eol === null) return { color: 'green', text: '지원 중' }
    if (typeof eol === 'string') {
      const days = Math.ceil((new Date(eol).getTime() - Date.now()) / 86400000)
      if (days < 0) return { color: 'red', text: `만료 (${Math.abs(days)}일 경과)` }
      if (days <= 90) return { color: 'orange', text: `${days}일 남음` }
      return { color: 'blue', text: dayjs(eol).format('YYYY-MM-DD') }
    }
    return { color: 'default', text: String(eol) }
  }

  const columns: ColumnsType<CycleInfo> = [
    {
      title: '버전',
      key: 'cycle',
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.releaseLabel || record.cycle}</Text>
          {record.latest && <Text type="secondary" style={{ fontSize: 12 }}>{record.latest}</Text>}
        </Space>
      ),
    },
    {
      title: '출시일',
      dataIndex: 'releaseDate',
      key: 'releaseDate',
      width: 110,
      render: (d: string | null) => d || '-',
    },
    {
      title: 'EoL',
      key: 'eol',
      width: 160,
      render: (_, record) => {
        const s = getEolStatus(record.eol)
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: 'LTS / 연장지원',
      key: 'lts',
      width: 140,
      render: (_, record) => {
        // extendedSupport가 날짜이면 LTS 종료일로 표시
        if (typeof record.extendedSupport === 'string') {
          const s = getEolStatus(record.extendedSupport)
          return <Tag color={s.color}>{s.text}</Tag>
        }
        // lts가 날짜이면 LTS 종료일로 표시
        if (typeof record.lts === 'string') {
          const s = getEolStatus(record.lts)
          return <Tag color={s.color}>{s.text}</Tag>
        }
        // lts가 boolean true이면 LTS 표시
        if (record.lts === true) {
          return <CheckCircleOutlined style={{ color: '#52c41a' }} />
        }
        return '-'
      },
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => {
        return (
          <Button
            type="primary"
            size="small"
            onClick={() => handleSelectCycle(record)}
          >
            선택
          </Button>
        )
      },
    },
  ]

  return (
    <>
    <Modal
      title="EoL 조회 (endoflife.date)"
      open={open}
      onCancel={handleReset}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          message="endoflife.date에서 소프트웨어 및 OS의 End of Life 날짜를 조회합니다."
          type="info"
          showIcon
          closable
        />

        {/* Step 1: Search */}
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="제품명 검색 (예: windows-server, postgresql, nodejs)"
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button type="primary" onClick={handleSearch} loading={searchLoading}>
            검색
          </Button>
        </Space.Compact>

        {/* Search results → Select product */}
        {products.length > 0 && !selectedProduct && (
          <Select
            placeholder="제품을 선택하세요"
            style={{ width: '100%' }}
            showSearch
            value={selectedProduct}
            onChange={handleSelectProduct}
            filterOption={(input, option) =>
              (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={products.map((p) => ({ value: p, label: p }))}
          />
        )}

        {/* Selected product info */}
        {selectedProduct && (
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Tag color="blue">{selectedProduct}</Tag>
              <Button size="small" type="link" onClick={() => { setSelectedProduct(null); setCycles([]) }}>
                다른 제품 선택
              </Button>
            </Space>

            <Spin spinning={cyclesLoading}>
              {cycles.length > 0 ? (
                <Table
                  columns={columns}
                  dataSource={cycles}
                  rowKey="cycle"
                  size="small"
                  pagination={{ pageSize: 8 }}
                  scroll={{ y: 350 }}
                />
              ) : (
                !cyclesLoading && <Empty description="버전 정보가 없습니다" />
              )}
            </Spin>
          </div>
        )}

        {/* No results */}
        {!searchLoading && products.length === 0 && searchQuery && (
          <Empty description="검색 결과가 없습니다. 다른 키워드로 검색해보세요." />
        )}
      </Space>
    </Modal>

      {/* Date selection sub-modal */}
      <Modal
        title={`날짜 선택 — ${datePickCycle?.releaseLabel || datePickCycle?.cycle || ''}`}
        open={datePickOpen}
        onCancel={() => setDatePickOpen(false)}
        footer={null}
        width={400}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">적용할 날짜를 선택하세요:</Text>
          {dateOptions.map((opt) => (
            <Button
              key={opt.date}
              block
              size="large"
              onClick={() => {
                onSelect(opt.date, selectedProduct || '', datePickCycle?.cycle || '')
                setDatePickOpen(false)
                handleReset()
              }}
            >
              {opt.label}
            </Button>
          ))}
        </Space>
      </Modal>
    </>
  )
}

export default EolLookup
