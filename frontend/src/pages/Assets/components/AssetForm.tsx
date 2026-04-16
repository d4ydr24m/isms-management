/**
 * 자산 폼 컴포넌트
 * 자산 등록/수정에 사용
 */
import { useEffect, useState } from 'react'
import { Form, Input, Select, DatePicker, InputNumber, Row, Col, Divider, Space, Button, Spin } from 'antd'
import { SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import EolLookup from './EolLookup'
import type { AssetCreate, AssetUpdate, AssetType, AssetCategory, Asset } from '@/types'

const { Option } = Select
const { TextArea } = Input

export interface AssigneeEntry {
  assignmentId?: number
  personnelId: number
  role: 'owner' | 'manager' | 'user'
}

interface AssetFormProps {
  initialValues?: Asset
  assetTypes: AssetType[]
  categories: AssetCategory[]
  departments: Array<{ id: number; name: string }>
  users: Array<{ id: number; name: string; email: string }>
  existingAssignees?: AssigneeEntry[]
  loading?: boolean
  onSubmit: (values: AssetCreate | AssetUpdate, extra?: { ciaData?: { confidentiality: number; integrity: number; availability: number; evaluationReason?: string }; assignees?: AssigneeEntry[] }) => Promise<void>
  onCancel: () => void
}

/**
 * 자산 유형 코드 → 허용 분류 코드 접두사 매핑
 * 분류 코드가 이 접두사로 시작하면 해당 유형에 표시됨
 */
const typeToAllowedPrefixes: Record<string, string[]> = {
  SRV: ['HW-SRV'],
  NET: ['HW-NET'],
  SEC: ['HW-SEC', 'SW-SEC'],
  PC:  ['HW-END'],
  MOB: ['HW-END'],
  STG: ['HW-STG'],
  PPD: ['HW-PPD'],
  DB:  ['SW-DB'],
  APP: ['SW-APP', 'SW-OS'],
  DOC: ['DATA'],
  SVC: ['SVC'],
  FAC: ['FAC'],
  HUM: ['HUM'],
}

/** 분류 코드 접두사 → 자산 유형 코드 매핑 (역방향, 자동 선택용) */
const prefixToTypeMap: Record<string, string> = {
  'HW-SRV': 'SRV',
  'HW-NET': 'NET',
  'HW-SEC': 'SEC',
  'HW-END': 'PC',
  'HW-STG': 'STG',
  'HW-PPD': 'PPD',
  'SW-DB':  'DB',
  'SW-APP': 'APP',
  'SW-OS':  'APP',
  'SW-SEC': 'SEC',
  'DATA':   'DOC',
  'SVC':    'SVC',
  'FAC':    'FAC',
  'HUM':    'HUM',
}

/** 자산 유형별 추가 필드 정의 */
const typeSpecificFields: Record<string, string[]> = {
  SRV: ['ipAddress', 'url', 'hostname', 'osVersion', 'serviceVersion', 'specifications'],
  NET: ['ipAddress', 'url', 'macAddress', 'hostname', 'serviceVersion'],
  SEC: ['ipAddress', 'url', 'hostname', 'osVersion', 'serviceVersion'],
  DB: ['ipAddress', 'url', 'hostname', 'serviceVersion'],
  APP: ['ipAddress', 'url', 'hostname', 'serviceVersion'],
  PC: ['ipAddress', 'macAddress', 'hostname', 'osVersion'],
  PPD: ['ipAddress', 'macAddress', 'hostname'],
  DOC: [],
  HUM: [],
}

const AssetForm = ({
  initialValues,
  assetTypes,
  categories,
  departments,
  users,
  existingAssignees,
  loading = false,
  onSubmit,
  onCancel,
}: AssetFormProps) => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>('')
  const [eolModalOpen, setEolModalOpen] = useState(false)

  // 초기값 설정
  useEffect(() => {
    if (initialValues) {
      const formValues = {
        ...initialValues,
        acquisitionDate: initialValues.acquisitionDate ? dayjs(initialValues.acquisitionDate) : undefined,
        warrantyEndDate: initialValues.warrantyEndDate ? dayjs(initialValues.warrantyEndDate) : undefined,
        eolDate: initialValues.eolDate ? dayjs(initialValues.eolDate) : undefined,
      }
      // 기존 담당자 설정 (소유자 제외)
      if (existingAssignees?.length) {
        formValues.assignees = existingAssignees
          .filter(a => a.role !== 'owner')
          .map(a => ({ personnelId: a.personnelId, role: a.role }))
      }
      form.setFieldsValue(formValues)

      // 자산 유형 코드 설정
      const assetType = assetTypes.find(t => t.id === initialValues.assetTypeId)
      if (assetType) {
        setSelectedTypeCode(assetType.code)
      }
    }
  }, [initialValues, assetTypes, form])

  /** 분류가 특정 자산 유형에 허용되는지 확인 */
  const isCategoryAllowedForType = (catCode: string, typeCode: string): boolean => {
    const prefixes = typeToAllowedPrefixes[typeCode]
    if (!prefixes) return true // 매핑 없으면 모두 허용
    // 분류의 level-2 접두사가 어떤 유형에도 매핑되지 않으면 모두에게 허용
    const catLevel2Prefix = catCode.split('-').slice(0, 2).join('-')
    const isMappedToAnyType = Object.values(typeToAllowedPrefixes).some(
      ps => ps.some(p => catLevel2Prefix.startsWith(p) || p.startsWith(catLevel2Prefix))
    )
    if (!isMappedToAnyType) return true // 매핑되지 않은 분류는 모든 유형에 표시
    return prefixes.some(prefix => catCode.startsWith(prefix))
  }

  /** 분류 코드로부터 자산 유형 코드 추론 (가장 긴 접두사 매칭) */
  const inferTypeFromCategory = (catCode: string): string | undefined => {
    // 긴 접두사부터 매칭 (HW-SRV가 HW보다 우선)
    const sortedPrefixes = Object.keys(prefixToTypeMap).sort((a, b) => b.length - a.length)
    for (const prefix of sortedPrefixes) {
      if (catCode.startsWith(prefix)) {
        return prefixToTypeMap[prefix]
      }
    }
    return undefined
  }

  // 자산 유형 변경 핸들러
  const handleAssetTypeChange = (value: number) => {
    const assetType = assetTypes.find(t => t.id === value)
    if (assetType) {
      setSelectedTypeCode(assetType.code)
      // 현재 선택된 분류가 새 유형과 호환되지 않으면 초기화
      const currentCategoryIds: number[] = form.getFieldValue('categoryIds') || []
      if (currentCategoryIds.length > 0) {
        const compatible = currentCategoryIds.filter(cid => {
          const cat = flatCategories.find(c => c.id === cid)
          return cat ? isCategoryAllowedForType(cat.code, assetType.code) : false
        })
        if (compatible.length !== currentCategoryIds.length) {
          form.setFieldsValue({ categoryIds: compatible })
        }
      }
    }
  }

  // 분류 변경 핸들러 — 선택된 분류에 맞는 자산 유형 자동 선택
  const handleCategoryChange = (categoryIds: number[]) => {
    if (categoryIds.length === 0) return
    // 마지막으로 추가된 분류 기준으로 유형 추론
    const lastCatId = categoryIds[categoryIds.length - 1]
    const lastCat = flatCategories.find(c => c.id === lastCatId)
    if (!lastCat) return
    const inferredTypeCode = inferTypeFromCategory(lastCat.code)
    if (!inferredTypeCode) return
    // 현재 자산 유형이 이미 호환되면 유지
    if (selectedTypeCode && isCategoryAllowedForType(lastCat.code, selectedTypeCode)) return
    // 호환되지 않으면 추론된 유형으로 자동 설정
    const matchedType = assetTypes.find(t => t.code === inferredTypeCode && t.isActive)
    if (matchedType) {
      form.setFieldsValue({ assetTypeId: matchedType.id })
      setSelectedTypeCode(matchedType.code)
    }
  }

  // 분류 트리를 flat 리스트로 변환
  const flattenCategories = (cats: AssetCategory[], result: AssetCategory[] = []): AssetCategory[] => {
    cats.forEach(cat => {
      result.push(cat)
      if (cat.children && cat.children.length > 0) {
        flattenCategories(cat.children, result)
      }
    })
    return result
  }

  const flatCategories = flattenCategories(categories)

  // 폼 제출 핸들러
  const handleFinish = async (values: any) => {
    setSubmitting(true)
    try {
      // CIA 및 담당자 필드를 분리 (자산 API에 보내지 않음)
      const { confidentiality, integrity, availability, evaluationReason, assignees: assigneesRaw, ...assetValues } = values
      const submitData: Record<string, any> = {
        ...assetValues,
        acquisitionDate: assetValues.acquisitionDate?.format?.('YYYY-MM-DD') || assetValues.acquisitionDate || undefined,
        warrantyEndDate: assetValues.warrantyEndDate?.format?.('YYYY-MM-DD') || assetValues.warrantyEndDate || undefined,
        eolDate: assetValues.eolDate?.format?.('YYYY-MM-DD') || assetValues.eolDate || undefined,
      }
      // null/undefined 값 제거
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined || submitData[key] === null || submitData[key] === '') {
          delete submitData[key]
        }
      })
      const ciaData = (confidentiality && integrity && availability)
        ? { confidentiality, integrity, availability, evaluationReason }
        : undefined
      // 담당자 데이터 구성
      const assignees: AssigneeEntry[] | undefined = assigneesRaw?.length
        ? assigneesRaw.filter((a: any) => a?.personnelId).map((a: any) => ({
            personnelId: a.personnelId,
            role: a.role || 'user',
          }))
        : undefined
      await onSubmit(submitData, { ciaData, assignees })
    } finally {
      setSubmitting(false)
    }
  }

  // 현재 유형에 따른 추가 필드 표시 여부
  const shouldShowField = (fieldName: string): boolean => {
    if (!selectedTypeCode) return false
    const fields = typeSpecificFields[selectedTypeCode] || []
    return fields.includes(fieldName)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{
        status: '도입',
      }}
    >
      {/* 기본 정보 */}
      <Divider orientation="left">기본 정보</Divider>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="name"
            label="자산명"
            rules={[{ required: true, message: '자산명을 입력해주세요' }]}
          >
            <Input placeholder="자산명을 입력하세요" maxLength={200} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="assetTypeId"
            label="자산 유형"
            rules={[{ required: true, message: '자산 유형을 선택해주세요' }]}
          >
            <Select
              placeholder="자산 유형 선택"
              allowClear
              onChange={(value) => {
                if (value) {
                  handleAssetTypeChange(value)
                } else {
                  setSelectedTypeCode('')
                }
              }}
              showSearch
              optionFilterProp="children"
            >
              {assetTypes.filter(t => t.isActive).map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item name="categoryIds" label="분류">
            <Select
              mode="multiple"
              placeholder="분류 선택 (복수 선택 가능)"
              allowClear
              showSearch
              onChange={handleCategoryChange}
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={(() => {
                const filtered = flatCategories.filter(c => {
                  if (!c.isActive) return false
                  if (selectedTypeCode) {
                    return isCategoryAllowedForType(c.code, selectedTypeCode)
                  }
                  return true
                })
                // level-2를 그룹 헤더, level-3만 선택 가능
                const level2Cats = filtered.filter(c => c.level === 2)
                const groups = level2Cats.map(l2 => ({
                  label: l2.name,
                  options: filtered
                    .filter(c => c.level === 3 && c.code.startsWith(l2.code))
                    .map(c => ({ value: c.id, label: c.name })),
                })).filter(g => g.options.length > 0)
                // level-3가 없는 level-2는 단독 옵션으로 표시
                const l2WithoutChildren = level2Cats.filter(l2 =>
                  !filtered.some(c => c.level === 3 && c.code.startsWith(l2.code))
                )
                if (l2WithoutChildren.length > 0) {
                  groups.push({
                    label: '기타',
                    options: l2WithoutChildren.map(c => ({ value: c.id, label: c.name })),
                  })
                }
                return groups
              })()}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="location" label="위치">
            <Input placeholder="물리적 위치를 입력하세요" maxLength={200} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24}>
          <Form.Item name="description" label="설명">
            <TextArea rows={3} placeholder="자산에 대한 설명을 입력하세요" maxLength={1000} />
          </Form.Item>
        </Col>
      </Row>

      {/* 담당 정보 */}
      <Divider orientation="left">담당 정보</Divider>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item name="departmentId" label="담당 부서">
            <Select placeholder="부서 선택" allowClear showSearch optionFilterProp="children">
              {departments.map(dept => (
                <Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="personnelOwnerId" label="소유자">
            <Select placeholder="소유자 선택" allowClear showSearch optionFilterProp="children">
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.name}{user.email ? ` (${user.email})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Form.List name="assignees">
        {(fields, { add, remove }) => (
          <>
            <Row gutter={16} style={{ marginBottom: fields.length ? 8 : 0 }}>
              <Col xs={24}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#666', fontSize: 13 }}>담당자</span>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add({ role: 'user' })}>
                    담당자 추가
                  </Button>
                </div>
              </Col>
            </Row>
            {fields.map(({ key, name, ...restField }) => (
              <Row gutter={8} key={key} align="middle" style={{ marginBottom: 8 }}>
                <Col flex="auto">
                  <Form.Item
                    {...restField}
                    name={[name, 'personnelId']}
                    rules={[{ required: true, message: '담당자를 선택하세요' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select placeholder="담당자 선택" showSearch optionFilterProp="children">
                      {users.map(user => (
                        <Option key={user.id} value={user.id}>
                          {user.name}{user.email ? ` (${user.email})` : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col flex="140px">
                  <Form.Item
                    {...restField}
                    name={[name, 'role']}
                    rules={[{ required: true, message: '역할 선택' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select>
                      <Option value="manager">관리자</Option>
                      <Option value="user">사용자</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col flex="32px">
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} size="small" />
                </Col>
              </Row>
            ))}
          </>
        )}
      </Form.List>

      {/* 기술 정보 (유형에 따라 동적 표시) */}
      {selectedTypeCode && (
        <>
          <Divider orientation="left">기술 정보</Divider>
          <Row gutter={16}>
            {shouldShowField('ipAddress') && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="ipAddress" label="IP 주소">
                  <Input placeholder="192.168.1.1 또는 192.168.1.0/24 또는 192.168.1.1-254" maxLength={200} />
                </Form.Item>
              </Col>
            )}
            {shouldShowField('macAddress') && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="macAddress" label="MAC 주소">
                  <Input placeholder="00:00:00:00:00:00" maxLength={50} />
                </Form.Item>
              </Col>
            )}
            {shouldShowField('hostname') && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="hostname" label="호스트명">
                  <Input placeholder="서버 호스트명" maxLength={100} />
                </Form.Item>
              </Col>
            )}
            {shouldShowField('osVersion') && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="osVersion" label="OS 버전">
                  <Input placeholder="예: Windows Server 2019" maxLength={100} />
                </Form.Item>
              </Col>
            )}
            {shouldShowField('url') && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="url" label="URL">
                  <Input placeholder="예: https://example.com" maxLength={500} />
                </Form.Item>
              </Col>
            )}
            {shouldShowField('serviceVersion') && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="serviceVersion" label="버전">
                  <Input placeholder="예: 3.2.1" maxLength={100} />
                </Form.Item>
              </Col>
            )}
          </Row>
        </>
      )}

      {/* 제조/취득 정보 */}
      <Divider orientation="left">제조/취득 정보</Divider>
      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="manufacturer" label="제조사">
            <Input placeholder="제조사명" maxLength={100} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="model" label="모델명">
            <Input placeholder="모델명" maxLength={100} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="serialNumber" label="시리얼 번호">
            <Input placeholder="시리얼 번호" maxLength={100} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="acquisitionDate" label="취득일">
            <DatePicker style={{ width: '100%' }} placeholder="날짜 선택" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="acquisitionCost" label="취득 비용 (원)">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={9999999999}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => (value!.replace(/\$\s?|(,*)/g, '') as unknown as 0 | 9999999999)}
              placeholder="취득 비용"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="warrantyEndDate" label="보증 만료일">
            <DatePicker style={{ width: '100%' }} placeholder="날짜 선택" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Form.Item name="eolDate" label="EoL 만료일" extra="End of Life / End of Support 일자">
            <DatePicker style={{ width: '100%' }} placeholder="날짜 선택" />
          </Form.Item>
          <Button
            size="small"
            icon={<SearchOutlined />}
            onClick={() => setEolModalOpen(true)}
            style={{ marginTop: -8 }}
          >
            endoflife.date에서 조회
          </Button>
        </Col>
      </Row>

      {/* 중요도 평가 (CIA) */}
      <Divider orientation="left">중요도 평가</Divider>
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item name="confidentiality" label="기밀성 (C)" extra="정보의 비밀 유지 중요도">
            <Select placeholder="선택">
              <Option value={1}>하 (1) - 공개 정보</Option>
              <Option value={2}>중 (2) - 내부 정보</Option>
              <Option value={3}>상 (3) - 기밀 정보</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="integrity" label="무결성 (I)" extra="정보의 정확성 및 완전성 중요도">
            <Select placeholder="선택">
              <Option value={1}>하 (1) - 변경 허용</Option>
              <Option value={2}>중 (2) - 제한적 변경</Option>
              <Option value={3}>상 (3) - 변경 금지</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item name="availability" label="가용성 (A)" extra="정보 접근 가능성 중요도">
            <Select placeholder="선택">
              <Option value={1}>하 (1) - 일부 중단 허용</Option>
              <Option value={2}>중 (2) - 최소 중단</Option>
              <Option value={3}>상 (3) - 중단 불가</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24}>
          <Form.Item name="evaluationReason" label="평가 사유">
            <TextArea rows={2} placeholder="평가 사유를 입력하세요" maxLength={500} />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">상태 정보</Divider>
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item name="status" label="상태">
            <Select placeholder="상태 선택">
              <Option value="도입">도입</Option>
              <Option value="운영">운영</Option>
              <Option value="변경">변경</Option>
              <Option value="폐기">폐기</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {/* 버튼 */}
      <Divider />
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {initialValues ? '수정' : '등록'}
          </Button>
          <Button onClick={onCancel}>취소</Button>
        </Space>
      </Form.Item>

      <EolLookup
        open={eolModalOpen}
        onClose={() => setEolModalOpen(false)}
        onSelect={(eolDate) => {
          form.setFieldValue('eolDate', dayjs(eolDate))
          setEolModalOpen(false)
        }}
        initialQuery={form.getFieldValue('osVersion') || form.getFieldValue('serviceVersion') || ''}
      />
    </Form>
  )
}

export default AssetForm
