/**
 * 자산 필터 컴포넌트
 * 유형, 부서, 중요도, 상태 필터 지원
 */
import { Row, Col, Select, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { AssetType, AssetStatus, AssetFilterParams } from '@/types'

const { Option } = Select

interface AssetFilterProps {
  filters: AssetFilterParams
  assetTypes: AssetType[]
  onSearchChange: (value: string) => void
  onAssetTypeChange: (value?: number) => void
  onStatusChange: (value?: AssetStatus) => void
  onImportanceChange: (value?: number) => void
}

/** 자산 상태 옵션 */
const statusOptions: Array<{ value: AssetStatus; label: string }> = [
  { value: 'introduced', label: '도입' },
  { value: 'operating', label: '운영' },
  { value: 'changed', label: '변경' },
  { value: 'disposed', label: '폐기' },
]

/** 중요도 옵션 */
const importanceOptions = [
  { value: 3, label: '상' },
  { value: 2, label: '중' },
  { value: 1, label: '하' },
]

const AssetFilter = ({
  filters,
  assetTypes,
  onSearchChange,
  onAssetTypeChange,
  onStatusChange,
  onImportanceChange,
}: AssetFilterProps) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={8} lg={6}>
        <Input
          placeholder="자산명, 자산코드로 검색"
          prefix={<SearchOutlined />}
          onChange={(e) => onSearchChange(e.target.value)}
          value={filters.search}
          allowClear
        />
      </Col>
      <Col xs={24} sm={12} md={6} lg={4}>
        <Select
          placeholder="자산 유형"
          style={{ width: '100%' }}
          allowClear
          onChange={onAssetTypeChange}
          value={filters.assetTypeId ?? undefined}
        >
          {assetTypes.map((type) => (
            <Option key={type.id} value={type.id}>
              {type.name}
            </Option>
          ))}
        </Select>
      </Col>
      <Col xs={24} sm={12} md={6} lg={4}>
        <Select
          placeholder="상태"
          style={{ width: '100%' }}
          allowClear
          onChange={onStatusChange}
          value={filters.status ?? undefined}
        >
          {statusOptions.map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      </Col>
      <Col xs={24} sm={12} md={6} lg={4}>
        <Select
          placeholder="중요도"
          style={{ width: '100%' }}
          allowClear
          onChange={onImportanceChange}
          value={filters.importanceLevel ?? undefined}
        >
          {importanceOptions.map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      </Col>
    </Row>
  )
}

export default AssetFilter
