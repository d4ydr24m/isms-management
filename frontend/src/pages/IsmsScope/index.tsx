import { useState, useEffect, useCallback } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import SearchInput from '@/components/common/SearchInput'
import {
  ismsScopeService,
  type AssetScopeItem,
  type PersonnelScopeItem,
  type DepartmentScopeItem,
  type ScopeChangeItem,
  type ScopeSummary,
} from '@/services/ismsScope'
import { apiClient } from '@/services/api'

const { Text, Title } = Typography

interface Department {
  id: number
  name: string
}

function IsmsScopePage() {
  const { message, modal } = App.useApp()
  const [activeTab, setActiveTab] = useState('assets')
  const [stats, setStats] = useState<ScopeSummary | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])

  // Asset state
  const [assets, setAssets] = useState<AssetScopeItem[]>([])
  const [assetTotal, setAssetTotal] = useState(0)
  const [assetPage, setAssetPage] = useState(1)
  const [assetPageSize, setAssetPageSize] = useState(20)
  const [assetSearch, setAssetSearch] = useState('')
  const [assetScopeFilter, setAssetScopeFilter] = useState<boolean | undefined>(undefined)
  const [assetDeptFilter, setAssetDeptFilter] = useState<number | undefined>(undefined)
  const [assetLoading, setAssetLoading] = useState(false)
  const [selectedAssetKeys, setSelectedAssetKeys] = useState<number[]>([])

  // Personnel state
  const [personnel, setPersonnel] = useState<PersonnelScopeItem[]>([])
  const [personnelTotal, setPersonnelTotal] = useState(0)
  const [personnelPage, setPersonnelPage] = useState(1)
  const [personnelPageSize, setPersonnelPageSize] = useState(20)
  const [personnelSearch, setPersonnelSearch] = useState('')
  const [personnelScopeFilter, setPersonnelScopeFilter] = useState<boolean | undefined>(undefined)
  const [personnelDeptFilter, setPersonnelDeptFilter] = useState<number | undefined>(undefined)
  const [personnelLoading, setPersonnelLoading] = useState(false)
  const [selectedPersonnelKeys, setSelectedPersonnelKeys] = useState<number[]>([])

  // Department state
  const [depts, setDepts] = useState<DepartmentScopeItem[]>([])
  const [deptTotal, setDeptTotal] = useState(0)
  const [deptPage, setDeptPage] = useState(1)
  const [deptPageSize, setDeptPageSize] = useState(20)
  const [deptSearch, setDeptSearch] = useState('')
  const [deptScopeFilter, setDeptScopeFilter] = useState<boolean | undefined>(undefined)
  const [deptLoading, setDeptLoading] = useState(false)
  const [selectedDeptKeys, setSelectedDeptKeys] = useState<number[]>([])

  // Change history state
  const [changes, setChanges] = useState<ScopeChangeItem[]>([])
  const [changeTotal, setChangeTotal] = useState(0)
  const [changePage, setChangePage] = useState(1)
  const [changePageSize, setChangePageSize] = useState(20)
  const [changeTypeFilter, setChangeTypeFilter] = useState<string | undefined>(undefined)
  const [changeLoading, setChangeLoading] = useState(false)

  // Load departments for filters
  useEffect(() => {
    apiClient.get<{ items: Department[] }>('/departments')
      .then(res => setDepartments(res.data.items || []))
      .catch(() => {})
  }, [])

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const res = await ismsScopeService.getStats()
      setStats(res.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // ---------------------------------------------------------------------------
  // Reload trigger: bump to force re-fetch after mutations
  // ---------------------------------------------------------------------------
  const [assetReload, setAssetReload] = useState(0)
  const [personnelReload, setPersonnelReload] = useState(0)
  const [deptReload, setDeptReload] = useState(0)
  const [changeReload, setChangeReload] = useState(0)

  // ---------------------------------------------------------------------------
  // Asset fetcher — driven entirely by state + useEffect
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'assets') return
    let cancelled = false
    const fetchAssets = async () => {
      setAssetLoading(true)
      try {
        const params: Record<string, any> = { page: assetPage, pageSize: assetPageSize }
        if (assetSearch) params.search = assetSearch
        if (assetScopeFilter !== undefined) params.inIsmsScope = assetScopeFilter
        if (assetDeptFilter !== undefined) params.departmentId = assetDeptFilter
        const res = await ismsScopeService.getAssets(params)
        if (!cancelled) {
          setAssets(res.data.items || [])
          setAssetTotal(res.data.total || 0)
        }
      } catch {
        if (!cancelled) message.error('자산 목록을 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setAssetLoading(false)
      }
    }
    fetchAssets()
    return () => { cancelled = true }
  }, [activeTab, assetPage, assetPageSize, assetSearch, assetScopeFilter, assetDeptFilter, assetReload])

  // ---------------------------------------------------------------------------
  // Personnel fetcher
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'personnel') return
    let cancelled = false
    const fetchPersonnel = async () => {
      setPersonnelLoading(true)
      try {
        const params: Record<string, any> = { page: personnelPage, pageSize: personnelPageSize }
        if (personnelSearch) params.search = personnelSearch
        if (personnelScopeFilter !== undefined) params.inIsmsScope = personnelScopeFilter
        if (personnelDeptFilter !== undefined) params.departmentId = personnelDeptFilter
        const res = await ismsScopeService.getPersonnel(params)
        if (!cancelled) {
          setPersonnel(res.data.items || [])
          setPersonnelTotal(res.data.total || 0)
        }
      } catch {
        if (!cancelled) message.error('담당자 목록을 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setPersonnelLoading(false)
      }
    }
    fetchPersonnel()
    return () => { cancelled = true }
  }, [activeTab, personnelPage, personnelPageSize, personnelSearch, personnelScopeFilter, personnelDeptFilter, personnelReload])

  // ---------------------------------------------------------------------------
  // Department fetcher
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'departments') return
    let cancelled = false
    const fetchDepts = async () => {
      setDeptLoading(true)
      try {
        const params: Record<string, any> = { page: deptPage, pageSize: deptPageSize }
        if (deptSearch) params.search = deptSearch
        if (deptScopeFilter !== undefined) params.inIsmsScope = deptScopeFilter
        const res = await ismsScopeService.getDepartments(params)
        if (!cancelled) {
          setDepts(res.data.items || [])
          setDeptTotal(res.data.total || 0)
        }
      } catch {
        if (!cancelled) message.error('부서 목록을 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setDeptLoading(false)
      }
    }
    fetchDepts()
    return () => { cancelled = true }
  }, [activeTab, deptPage, deptPageSize, deptSearch, deptScopeFilter, deptReload])

  // ---------------------------------------------------------------------------
  // Change history fetcher
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'changes') return
    let cancelled = false
    const fetchChanges = async () => {
      setChangeLoading(true)
      try {
        const params: Record<string, any> = { page: changePage, pageSize: changePageSize }
        if (changeTypeFilter) params.entityType = changeTypeFilter
        const res = await ismsScopeService.getChanges(params)
        if (!cancelled) {
          setChanges(res.data.items || [])
          setChangeTotal(res.data.total || 0)
        }
      } catch {
        if (!cancelled) message.error('변경 이력을 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setChangeLoading(false)
      }
    }
    fetchChanges()
    return () => { cancelled = true }
  }, [activeTab, changePage, changePageSize, changeTypeFilter, changeReload])

  // ---------------------------------------------------------------------------
  // Individual scope toggles
  // ---------------------------------------------------------------------------
  const handleAssetScopeToggle = (record: AssetScopeItem) => {
    const newScope = !record.inIsmsScope
    const label = newScope ? '범위 포함' : '범위 제외'

    modal.confirm({
      title: `자산 "${record.name}"을(를) 인증 ${label}하시겠습니까?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <Input.TextArea
          placeholder="변경 사유 입력 (선택)"
          rows={3}
          id="scope-reason-input"
          style={{ marginTop: 8 }}
        />
      ),
      okText: label,
      cancelText: '취소',
      onOk: async () => {
        const reasonEl = document.getElementById('scope-reason-input') as HTMLTextAreaElement
        const reason = reasonEl?.value || ''
        try {
          await ismsScopeService.updateAssetScope(record.id, { inIsmsScope: newScope, reason })
          message.success(`자산이 인증 범위에서 ${label}되었습니다`)
          setAssetReload(r => r + 1)
          loadStats()
        } catch {
          message.error('범위 변경에 실패했습니다')
        }
      },
    })
  }

  const handlePersonnelScopeToggle = (record: PersonnelScopeItem) => {
    const newScope = !record.inIsmsScope
    const label = newScope ? '범위 포함' : '범위 제외'

    modal.confirm({
      title: `담당자 "${record.name}"을(를) 인증 ${label}하시겠습니까?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <Input.TextArea
          placeholder="변경 사유 입력 (선택)"
          rows={3}
          id="scope-reason-input"
          style={{ marginTop: 8 }}
        />
      ),
      okText: label,
      cancelText: '취소',
      onOk: async () => {
        const reasonEl = document.getElementById('scope-reason-input') as HTMLTextAreaElement
        const reason = reasonEl?.value || ''
        try {
          await ismsScopeService.updatePersonnelScope(record.id, { inIsmsScope: newScope, reason })
          message.success(`담당자가 인증 범위에서 ${label}되었습니다`)
          setPersonnelReload(r => r + 1)
          loadStats()
        } catch {
          message.error('범위 변경에 실패했습니다')
        }
      },
    })
  }

  const handleDeptScopeToggle = (record: DepartmentScopeItem) => {
    const newScope = !record.inIsmsScope
    const label = newScope ? '범위 포함' : '범위 제외'

    modal.confirm({
      title: `부서 "${record.name}"을(를) 인증 ${label}하시겠습니까?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <Input.TextArea
          placeholder="변경 사유 입력 (선택)"
          rows={3}
          id="scope-reason-input"
          style={{ marginTop: 8 }}
        />
      ),
      okText: label,
      cancelText: '취소',
      onOk: async () => {
        const reasonEl = document.getElementById('scope-reason-input') as HTMLTextAreaElement
        const reason = reasonEl?.value || ''
        try {
          await ismsScopeService.updateDepartmentScope(record.id, { inIsmsScope: newScope, reason })
          message.success(`부서가 인증 범위에서 ${label}되었습니다`)
          setDeptReload(r => r + 1)
          loadStats()
        } catch {
          message.error('범위 변경에 실패했습니다')
        }
      },
    })
  }

  // Bulk scope toggle
  const handleBulkAssetScope = (inScope: boolean) => {
    if (selectedAssetKeys.length === 0) {
      message.warning('대상을 선택해주세요')
      return
    }
    const label = inScope ? '범위 포함' : '범위 제외'
    modal.confirm({
      title: `선택한 ${selectedAssetKeys.length}개 자산을 인증 ${label}하시겠습니까?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <Input.TextArea
          placeholder="변경 사유 입력 (선택)"
          rows={3}
          id="scope-reason-input"
          style={{ marginTop: 8 }}
        />
      ),
      okText: label,
      cancelText: '취소',
      onOk: async () => {
        const reasonEl = document.getElementById('scope-reason-input') as HTMLTextAreaElement
        const reason = reasonEl?.value || ''
        try {
          const res = await ismsScopeService.bulkUpdateAssetScope({
            ids: selectedAssetKeys, inIsmsScope: inScope, reason,
          })
          message.success(res.data.message)
          setSelectedAssetKeys([])
          setAssetReload(r => r + 1)
          loadStats()
        } catch {
          message.error('일괄 변경에 실패했습니다')
        }
      },
    })
  }

  const handleBulkPersonnelScope = (inScope: boolean) => {
    if (selectedPersonnelKeys.length === 0) {
      message.warning('대상을 선택해주세요')
      return
    }
    const label = inScope ? '범위 포함' : '범위 제외'
    modal.confirm({
      title: `선택한 ${selectedPersonnelKeys.length}명의 담당자를 인증 ${label}하시겠습니까?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <Input.TextArea
          placeholder="변경 사유 입력 (선택)"
          rows={3}
          id="scope-reason-input"
          style={{ marginTop: 8 }}
        />
      ),
      okText: label,
      cancelText: '취소',
      onOk: async () => {
        const reasonEl = document.getElementById('scope-reason-input') as HTMLTextAreaElement
        const reason = reasonEl?.value || ''
        try {
          const res = await ismsScopeService.bulkUpdatePersonnelScope({
            ids: selectedPersonnelKeys, inIsmsScope: inScope, reason,
          })
          message.success(res.data.message)
          setSelectedPersonnelKeys([])
          setPersonnelReload(r => r + 1)
          loadStats()
        } catch {
          message.error('일괄 변경에 실패했습니다')
        }
      },
    })
  }

  const handleBulkDeptScope = (inScope: boolean) => {
    if (selectedDeptKeys.length === 0) {
      message.warning('대상을 선택해주세요')
      return
    }
    const label = inScope ? '범위 포함' : '범위 제외'
    modal.confirm({
      title: `선택한 ${selectedDeptKeys.length}개 부서를 인증 ${label}하시겠습니까?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <Input.TextArea
          placeholder="변경 사유 입력 (선택)"
          rows={3}
          id="scope-reason-input"
          style={{ marginTop: 8 }}
        />
      ),
      okText: label,
      cancelText: '취소',
      onOk: async () => {
        const reasonEl = document.getElementById('scope-reason-input') as HTMLTextAreaElement
        const reason = reasonEl?.value || ''
        try {
          const res = await ismsScopeService.bulkUpdateDepartmentScope({
            ids: selectedDeptKeys, inIsmsScope: inScope, reason,
          })
          message.success(res.data.message)
          setSelectedDeptKeys([])
          setDeptReload(r => r + 1)
          loadStats()
        } catch {
          message.error('일괄 변경에 실패했습니다')
        }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------
  const scopeTag = (inScope: boolean) => (
    <Tag color={inScope ? 'green' : 'default'} icon={inScope ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
      {inScope ? '범위 내' : '범위 외'}
    </Tag>
  )

  const assetColumns: ColumnsType<AssetScopeItem> = [
    { title: '자산코드', dataIndex: 'assetCode', key: 'assetCode', width: 120 },
    { title: '자산명', dataIndex: 'name', key: 'name', width: 200 },
    { title: '유형', dataIndex: 'assetTypeName', key: 'assetTypeName', width: 120, render: v => v || '-' },
    { title: '부서', dataIndex: 'departmentName', key: 'departmentName', width: 120, render: v => v || '-' },
    { title: '상태', dataIndex: 'status', key: 'status', width: 80, render: v => v || '-' },
    {
      title: '인증 범위',
      dataIndex: 'inIsmsScope',
      key: 'inIsmsScope',
      width: 100,
      render: (val: boolean) => scopeTag(val),
    },
    { title: '사유', dataIndex: 'scopeReason', key: 'scopeReason', width: 200, render: v => v || '-', ellipsis: true },
    {
      title: '작업',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Switch
          checked={record.inIsmsScope}
          checkedChildren="포함"
          unCheckedChildren="제외"
          onChange={() => handleAssetScopeToggle(record)}
        />
      ),
    },
  ]

  const personnelColumns: ColumnsType<PersonnelScopeItem> = [
    { title: '이름', dataIndex: 'name', key: 'name', width: 120 },
    { title: '이메일', dataIndex: 'email', key: 'email', width: 200, render: v => v || '-' },
    { title: '직위', dataIndex: 'position', key: 'position', width: 100, render: v => v || '-' },
    { title: '부서', dataIndex: 'departmentName', key: 'departmentName', width: 120, render: v => v || '-' },
    {
      title: '인증 범위',
      dataIndex: 'inIsmsScope',
      key: 'inIsmsScope',
      width: 100,
      render: (val: boolean) => scopeTag(val),
    },
    { title: '사유', dataIndex: 'scopeReason', key: 'scopeReason', width: 200, render: v => v || '-', ellipsis: true },
    {
      title: '작업',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Switch
          checked={record.inIsmsScope}
          checkedChildren="포함"
          unCheckedChildren="제외"
          onChange={() => handlePersonnelScopeToggle(record)}
        />
      ),
    },
  ]

  const deptColumns: ColumnsType<DepartmentScopeItem> = [
    { title: '부서 코드', dataIndex: 'code', key: 'code', width: 120 },
    { title: '부서명', dataIndex: 'name', key: 'name', width: 200 },
    { title: '상위 부서', dataIndex: 'parentName', key: 'parentName', width: 150, render: v => v || '-' },
    {
      title: '인증 범위',
      dataIndex: 'inIsmsScope',
      key: 'inIsmsScope',
      width: 100,
      render: (val: boolean) => scopeTag(val),
    },
    { title: '사유', dataIndex: 'scopeReason', key: 'scopeReason', width: 200, render: v => v || '-', ellipsis: true },
    {
      title: '작업',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Switch
          checked={record.inIsmsScope}
          checkedChildren="포함"
          unCheckedChildren="제외"
          onChange={() => handleDeptScopeToggle(record)}
        />
      ),
    },
  ]

  const entityTypeLabel: Record<string, string> = {
    asset: '자산',
    personnel: '담당자',
    department: '부서',
  }

  const changeColumns: ColumnsType<ScopeChangeItem> = [
    {
      title: '유형', dataIndex: 'entityType', key: 'entityType', width: 80,
      render: (v: string) => entityTypeLabel[v] || v,
    },
    { title: '대상', dataIndex: 'entityName', key: 'entityName', width: 200, render: v => v || '-' },
    {
      title: '변경', key: 'scopeChange', width: 200,
      render: (_, record) => (
        <Space>
          {scopeTag(record.oldScope)}
          <span>→</span>
          {scopeTag(record.newScope)}
        </Space>
      ),
    },
    { title: '사유', dataIndex: 'reason', key: 'reason', width: 200, render: v => v || '-', ellipsis: true },
    { title: '변경자', dataIndex: 'changedByName', key: 'changedByName', width: 100, render: v => v || '-' },
    {
      title: '변경일시', dataIndex: 'changedAt', key: 'changedAt', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('ko-KR') : '-',
    },
  ]

  // ---------------------------------------------------------------------------
  // Stats cards
  // ---------------------------------------------------------------------------
  const renderStats = () => {
    if (!stats) return null
    const items = [
      { label: '자산', data: stats.assets, color: '#1890ff' },
      { label: '담당자', data: stats.personnel, color: '#52c41a' },
      { label: '부서', data: stats.departments, color: '#722ed1' },
    ]
    return (
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {items.map(item => (
          <Col span={8} key={item.label}>
            <Card size="small">
              <Statistic
                title={`${item.label} 인증 범위`}
                value={item.data.inScope}
                suffix={`/ ${item.data.total}`}
                valueStyle={{ color: item.color }}
              />
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">범위 외: {item.data.outOfScope}건</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    )
  }

  // ---------------------------------------------------------------------------
  // Filter bars
  // ---------------------------------------------------------------------------
  const scopeFilterSelect = (value: boolean | undefined, onChange: (v: boolean | undefined) => void) => (
    <Select
      placeholder="범위 상태"
      allowClear
      style={{ width: 130 }}
      value={value}
      onChange={(v) => onChange(v ?? undefined)}
    >
      <Select.Option value={true}>범위 내</Select.Option>
      <Select.Option value={false}>범위 외</Select.Option>
    </Select>
  )

  const deptFilterSelect = (value: number | undefined, onChange: (v: number | undefined) => void) => (
    <Select
      placeholder="부서"
      allowClear
      showSearch
      optionFilterProp="children"
      style={{ width: 150 }}
      value={value}
      onChange={(v) => onChange(v ?? undefined)}
    >
      {departments.filter(d => d.id != null).map(d => (
        <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
      ))}
    </Select>
  )

  // ---------------------------------------------------------------------------
  // Tab content
  // ---------------------------------------------------------------------------
  const tabItems = [
    {
      key: 'assets',
      label: `자산 (${stats?.assets.total || 0})`,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <SearchInput
                placeholder="자산명/코드 검색"
                onSearch={(v) => { setAssetSearch(v); setAssetPage(1) }}
                width={250}
              />
              {scopeFilterSelect(assetScopeFilter, (v) => { setAssetScopeFilter(v); setAssetPage(1) })}
              {deptFilterSelect(assetDeptFilter, (v) => { setAssetDeptFilter(v); setAssetPage(1) })}
            </Space>
            <Space>
              {selectedAssetKeys.length > 0 && (
                <>
                  <Text type="secondary">{selectedAssetKeys.length}개 선택됨</Text>
                  <Button size="small" onClick={() => handleBulkAssetScope(true)}>범위 포함</Button>
                  <Button size="small" danger onClick={() => handleBulkAssetScope(false)}>범위 제외</Button>
                </>
              )}
            </Space>
          </div>
          <Table
            columns={assetColumns}
            dataSource={assets}
            rowKey="id"
            loading={assetLoading}
            bordered
            size="small"
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedAssetKeys,
              onChange: (keys) => setSelectedAssetKeys(keys as number[]),
            }}
            locale={{ emptyText: '데이터가 없습니다' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination
              current={assetPage}
              pageSize={assetPageSize}
              total={assetTotal}
              showSizeChanger
              showTotal={(t) => `총 ${t}건`}
              onChange={(p, ps) => { setAssetPage(p); setAssetPageSize(ps) }}
            />
          </div>
        </>
      ),
    },
    {
      key: 'personnel',
      label: `담당자 (${stats?.personnel.total || 0})`,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <SearchInput
                placeholder="이름/이메일 검색"
                onSearch={(v) => { setPersonnelSearch(v); setPersonnelPage(1) }}
                width={250}
              />
              {scopeFilterSelect(personnelScopeFilter, (v) => { setPersonnelScopeFilter(v); setPersonnelPage(1) })}
              {deptFilterSelect(personnelDeptFilter, (v) => { setPersonnelDeptFilter(v); setPersonnelPage(1) })}
            </Space>
            <Space>
              {selectedPersonnelKeys.length > 0 && (
                <>
                  <Text type="secondary">{selectedPersonnelKeys.length}명 선택됨</Text>
                  <Button size="small" onClick={() => handleBulkPersonnelScope(true)}>범위 포함</Button>
                  <Button size="small" danger onClick={() => handleBulkPersonnelScope(false)}>범위 제외</Button>
                </>
              )}
            </Space>
          </div>
          <Table
            columns={personnelColumns}
            dataSource={personnel}
            rowKey="id"
            loading={personnelLoading}
            bordered
            size="small"
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedPersonnelKeys,
              onChange: (keys) => setSelectedPersonnelKeys(keys as number[]),
            }}
            locale={{ emptyText: '데이터가 없습니다' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination
              current={personnelPage}
              pageSize={personnelPageSize}
              total={personnelTotal}
              showSizeChanger
              showTotal={(t) => `총 ${t}명`}
              onChange={(p, ps) => { setPersonnelPage(p); setPersonnelPageSize(ps) }}
            />
          </div>
        </>
      ),
    },
    {
      key: 'departments',
      label: `부서 (${stats?.departments.total || 0})`,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <SearchInput
                placeholder="부서명/코드 검색"
                onSearch={(v) => { setDeptSearch(v); setDeptPage(1) }}
                width={250}
              />
              {scopeFilterSelect(deptScopeFilter, (v) => { setDeptScopeFilter(v); setDeptPage(1) })}
            </Space>
            <Space>
              {selectedDeptKeys.length > 0 && (
                <>
                  <Text type="secondary">{selectedDeptKeys.length}개 선택됨</Text>
                  <Button size="small" onClick={() => handleBulkDeptScope(true)}>범위 포함</Button>
                  <Button size="small" danger onClick={() => handleBulkDeptScope(false)}>범위 제외</Button>
                </>
              )}
            </Space>
          </div>
          <Table
            columns={deptColumns}
            dataSource={depts}
            rowKey="id"
            loading={deptLoading}
            bordered
            size="small"
            pagination={false}
            rowSelection={{
              selectedRowKeys: selectedDeptKeys,
              onChange: (keys) => setSelectedDeptKeys(keys as number[]),
            }}
            locale={{ emptyText: '데이터가 없습니다' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination
              current={deptPage}
              pageSize={deptPageSize}
              total={deptTotal}
              showSizeChanger
              showTotal={(t) => `총 ${t}건`}
              onChange={(p, ps) => { setDeptPage(p); setDeptPageSize(ps) }}
            />
          </div>
        </>
      ),
    },
    {
      key: 'changes',
      label: '변경 이력',
      icon: <HistoryOutlined />,
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Select
              placeholder="유형 필터"
              allowClear
              style={{ width: 150 }}
              value={changeTypeFilter}
              onChange={(v) => { setChangeTypeFilter(v ?? undefined); setChangePage(1) }}
            >
              <Select.Option value="asset">자산</Select.Option>
              <Select.Option value="personnel">담당자</Select.Option>
              <Select.Option value="department">부서</Select.Option>
            </Select>
          </div>
          <Table
            columns={changeColumns}
            dataSource={changes}
            rowKey="id"
            loading={changeLoading}
            bordered
            size="small"
            pagination={false}
            locale={{ emptyText: '변경 이력이 없습니다' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Pagination
              current={changePage}
              pageSize={changePageSize}
              total={changeTotal}
              showSizeChanger
              showTotal={(t) => `총 ${t}건`}
              onChange={(p, ps) => { setChangePage(p); setChangePageSize(ps) }}
            />
          </div>
        </>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        <SafetyCertificateOutlined style={{ marginRight: 8 }} />
        ISMS 인증 범위 관리
      </Title>

      {renderStats()}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>
    </div>
  )
}

export default IsmsScopePage
