/**
 * 자산 폼 컴포넌트
 * 자산 등록/수정에 사용
 */
import { useEffect, useState } from 'react'
import { Form, Input, Select, DatePicker, InputNumber, Row, Col, Divider, Space, Button, Spin } from 'antd'
import dayjs from 'dayjs'
import type { AssetCreate, AssetUpdate, AssetType, AssetCategory, Asset } from '@/types'

const { Option } = Select
const { TextArea } = Input

interface AssetFormProps {
  initialValues?: Asset
  assetTypes: AssetType[]
  categories: AssetCategory[]
  departments: Array<{ id: number; name: string }>
  users: Array<{ id: number; name: string; email: string }>
  loading?: boolean
  onSubmit: (values: AssetCreate | AssetUpdate, ciaData?: { confidentiality: number; integrity: number; availability: number; evaluationReason?: string }) => Promise<void>
  onCancel: () => void
}

/** 자산 유형별 추가 필드 정의 */
const typeSpecificFields: Record<string, string[]> = {
  SERVER: ['ipAddress', 'hostname', 'osVersion', 'specifications'],
  NETWORK: ['ipAddress', 'macAddress', 'hostname'],
  SECURITY: ['ipAddress', 'hostname', 'osVersion'],
  DATABASE: ['ipAddress', 'hostname'],
  APPLICATION: ['hostname'],
  PC: ['ipAddress', 'macAddress', 'hostname', 'osVersion'],
  DOCUMENT: [],
  PERSONNEL: [],
}

const AssetForm = ({
  initialValues,
  assetTypes,
  categories,
  departments,
  users,
  loading = false,
  onSubmit,
  onCancel,
}: AssetFormProps) => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>('')

  // 초기값 설정
  useEffect(() => {
    if (initialValues) {
      const formValues = {
        ...initialValues,
        acquisitionDate: initialValues.acquisitionDate ? dayjs(initialValues.acquisitionDate) : undefined,
        warrantyEndDate: initialValues.warrantyEndDate ? dayjs(initialValues.warrantyEndDate) : undefined,
      }
      form.setFieldsValue(formValues)

      // 자산 유형 코드 설정
      const assetType = assetTypes.find(t => t.id === initialValues.assetTypeId)
      if (assetType) {
        setSelectedTypeCode(assetType.code)
      }
    }
  }, [initialValues, assetTypes, form])

  // 자산 유형 변경 핸들러
  const handleAssetTypeChange = (value: number) => {
    const assetType = assetTypes.find(t => t.id === value)
    if (assetType) {
      setSelectedTypeCode(assetType.code)
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
      // CIA 필드를 분리 (자산 API에 보내지 않음)
      const { confidentiality, integrity, availability, evaluationReason, ...assetValues } = values
      const submitData: Record<string, any> = {
        ...assetValues,
        acquisitionDate: assetValues.acquisitionDate?.format?.('YYYY-MM-DD') || assetValues.acquisitionDate || undefined,
        warrantyEndDate: assetValues.warrantyEndDate?.format?.('YYYY-MM-DD') || assetValues.warrantyEndDate || undefined,
      }
      // null/undefined 값 제거
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === undefined || submitData[key] === null || submitData[key] === '') {
          delete submitData[key]
        }
      })
      // onSubmit에 CIA 데이터를 같이 전달
      const ciaData = (confidentiality && integrity && availability)
        ? { confidentiality, integrity, availability, evaluationReason }
        : undefined
      await onSubmit(submitData, ciaData)
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
              onChange={handleAssetTypeChange}
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
          <Form.Item name="categoryId" label="분류">
            <Select
              placeholder="분류 선택"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={flatCategories.filter(c => c.isActive).map(cat => ({
                value: cat.id,
                label: `${'─'.repeat(cat.level - 1)}${cat.level > 1 ? ' ' : ''}${cat.name}`,
              }))}
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
          <Form.Item name="personnelOwnerId" label="자산 소유자">
            <Select placeholder="담당자 선택" allowClear showSearch optionFilterProp="children">
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.name}{user.email ? ` (${user.email})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {/* 기술 정보 (유형에 따라 동적 표시) */}
      {selectedTypeCode && (
        <>
          <Divider orientation="left">기술 정보</Divider>
          <Row gutter={16}>
            {shouldShowField('ipAddress') && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="ipAddress" label="IP 주소">
                  <Input placeholder="192.168.1.1" maxLength={50} />
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

      {/* 수정 시에만 상태 변경 가능 */}
      {initialValues && (
        <>
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
        </>
      )}

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
    </Form>
  )
}

export default AssetForm
