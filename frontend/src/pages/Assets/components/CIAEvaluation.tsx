/**
 * CIA 평가 컴포넌트
 * 기밀성, 무결성, 가용성 시각적 게이지 표시
 */
import { App, Card, Row, Col, Progress, Typography, Tag, Button, Modal, Form, Select, Input, Tooltip, Table } from 'antd'
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { AssetValuation, AssetValuationCreate } from '@/types'

const { Text } = Typography
const { Option } = Select
const { TextArea } = Input

interface CIAEvaluationProps {
  valuation?: AssetValuation
  assetId: number
  onUpdate?: (data: AssetValuationCreate) => Promise<void>
  readonly?: boolean
}

/** CIA 항목 레이블 */
const ciaLabels = {
  confidentiality: '기밀성 (C)',
  integrity: '무결성 (I)',
  availability: '가용성 (A)',
}

/** 등급별 색상 */
const levelColors: Record<number, string> = {
  1: '#52c41a', // 하 - green
  2: '#faad14', // 중 - yellow
  3: '#f5222d', // 상 - red
}

/** 등급별 레이블 */
const levelLabels: Record<number, string> = {
  1: '하',
  2: '중',
  3: '상',
}

/** 중요도 점수 계산 (C+I+A 합산 방식) */
const calculateImportanceScore = (c: number, i: number, a: number): number => {
  return c + i + a
}

/** 중요도 점수 → 등급 변환 (3-5:하, 6-7:중, 8-9:상) */
const scoreToLevel = (score: number): number => {
  if (score >= 8) return 3 // 상
  if (score >= 6) return 2 // 중
  return 1 // 하
}

/** 등급별 분류 기준 설명 */
const importanceCriteria: Record<number, string> = {
  1: '점수 3~5: C+I+A 합산이 낮은 경우',
  2: '점수 6~7: C+I+A 합산이 보통인 경우',
  3: '점수 8~9: C+I+A 합산이 높은 경우',
}

/** 점수별 색상 (3~9) */
const scoreColors: Record<number, string> = {
  3: '#52c41a', 4: '#52c41a', 5: '#52c41a',
  6: '#faad14', 7: '#faad14',
  8: '#f5222d', 9: '#f5222d',
}

/** 중요도 분류 기준 테이블 데이터 */
const importanceCriteriaData = [
  { key: '3', level: '상', color: '#f5222d', score: '8 ~ 9', criteria: 'C+I+A 합산 점수가 8 이상', example: 'C=3, I=3, A=2 → 8점 → 상' },
  { key: '2', level: '중', color: '#faad14', score: '6 ~ 7', criteria: 'C+I+A 합산 점수가 6 이상 7 이하', example: 'C=2, I=2, A=2 → 6점 → 중' },
  { key: '1', level: '하', color: '#52c41a', score: '3 ~ 5', criteria: 'C+I+A 합산 점수가 5 이하', example: 'C=1, I=2, A=1 → 4점 → 하' },
]

const importanceCriteriaColumns = [
  { title: '등급', dataIndex: 'level', key: 'level', width: 60, render: (text: string, record: { color: string }) => <Tag color={record.color}>{text}</Tag> },
  { title: '점수 범위', dataIndex: 'score', key: 'score', width: 90 },
  { title: '분류 기준', dataIndex: 'criteria', key: 'criteria' },
  { title: '예시', dataIndex: 'example', key: 'example' },
]

/** 평가 등급표 셀 스타일 */
const thStyle: React.CSSProperties = { border: '1px solid #d9d9d9', padding: '6px 8px', backgroundColor: '#fafafa', fontWeight: 'bold' }
const tdStyle: React.CSSProperties = { border: '1px solid #d9d9d9', padding: '6px 8px' }

const CIAEvaluation = ({ valuation, assetId: _assetId, onUpdate, readonly = false }: CIAEvaluationProps) => {
  const { message } = App.useApp()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const handleOpenModal = () => {
    if (valuation) {
      form.setFieldsValue({
        confidentiality: valuation.confidentiality,
        integrity: valuation.integrity,
        availability: valuation.availability,
        evaluationReason: valuation.evaluationReason,
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (onUpdate) {
        await onUpdate(values as AssetValuationCreate)
        message.success('CIA 평가가 저장되었습니다')
        setIsModalOpen(false)
      }
    } catch {
      // validation error
    } finally {
      setSubmitting(false)
    }
  }

  const renderGauge = (label: string, value?: number) => {
    const displayValue = value || 0
    const percent = (displayValue / 3) * 100
    const color = levelColors[displayValue] || '#d9d9d9'

    return (
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Progress
          type="dashboard"
          percent={percent}
          format={() => (
            <div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color }}>
                {levelLabels[displayValue] || '-'}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>{displayValue || 0}/3</div>
            </div>
          )}
          strokeColor={color}
          size={100}
        />
        <div style={{ marginTop: 8 }}>
          <Text strong>{label}</Text>
        </div>
      </div>
    )
  }

  const importanceScore = valuation
    ? calculateImportanceScore(valuation.confidentiality, valuation.integrity, valuation.availability)
    : 0
  const importanceLevel = importanceScore > 0 ? scoreToLevel(importanceScore) : 0

  return (
    <>
      <Card
        title="CIA 평가"
        extra={
          !readonly && (
            <Button icon={<EditOutlined />} onClick={handleOpenModal}>
              {valuation ? '수정' : '평가 등록'}
            </Button>
          )
        }
      >
        {valuation ? (
          <>
            <Row gutter={16} justify="center">
              <Col xs={24} sm={8}>
                {renderGauge(ciaLabels.confidentiality, valuation.confidentiality)}
              </Col>
              <Col xs={24} sm={8}>
                {renderGauge(ciaLabels.integrity, valuation.integrity)}
              </Col>
              <Col xs={24} sm={8}>
                {renderGauge(ciaLabels.availability, valuation.availability)}
              </Col>
            </Row>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text type="secondary">자산 중요도: </Text>
              <Tag color={levelColors[importanceLevel]} style={{ fontSize: 16, padding: '4px 12px' }}>
                {levelLabels[importanceLevel]}
              </Tag>
              <Tag color={scoreColors[importanceScore]} style={{ fontSize: 14, padding: '2px 8px', marginLeft: 4 }}>
                {importanceScore}점
              </Tag>
              <Tooltip title={importanceCriteria[importanceLevel]}>
                <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff', cursor: 'pointer' }} />
              </Tooltip>
            </div>

            <div style={{ marginTop: 12, padding: '12px 16px', background: '#fafafa', borderRadius: 4, border: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                산정 기준: 중요도 점수 = 기밀성({valuation.confidentiality}) + 무결성({valuation.integrity}) + 가용성({valuation.availability}) = {importanceScore}점 → {levelLabels[importanceLevel]}
              </Text>
            </div>

            <div style={{ marginTop: 12 }}>
              <Table
                columns={importanceCriteriaColumns}
                dataSource={importanceCriteriaData}
                size="small"
                pagination={false}
                bordered
                title={() => <Text type="secondary" strong style={{ fontSize: 12 }}>중요도 분류 기준표</Text>}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                {'<'}정보자산 중요도 평가 등급{'>'}
              </Text>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, textAlign: 'center' }}>
                  <thead>
                    <tr>
                      <th style={thStyle} colSpan={2}>기밀성</th>
                      <th style={thStyle} colSpan={3}>L(1)</th>
                      <th style={thStyle} colSpan={3}>M(2)</th>
                      <th style={thStyle} colSpan={3}>H(3)</th>
                    </tr>
                    <tr>
                      <th style={thStyle} colSpan={2}>무결성</th>
                      <th style={thStyle}>L(1)</th>
                      <th style={thStyle}>M(2)</th>
                      <th style={thStyle}>H(3)</th>
                      <th style={thStyle}>L(1)</th>
                      <th style={thStyle}>M(2)</th>
                      <th style={thStyle}>H(3)</th>
                      <th style={thStyle}>L(1)</th>
                      <th style={thStyle}>M(2)</th>
                      <th style={thStyle}>H(3)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([1, 2, 3] as const).map((a, ai) => (
                      <tr key={a}>
                        {ai === 0 && <td style={{ ...tdStyle, fontWeight: 'bold' }} rowSpan={3}>가용성</td>}
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{a === 1 ? 'L(1)' : a === 2 ? 'M(2)' : 'H(3)'}</td>
                        {([1, 2, 3] as const).map((c) =>
                          ([1, 2, 3] as const).map((i) => {
                            const score = c + i + a
                            return (
                              <td key={`${c}-${i}-${a}`} style={{ ...tdStyle, backgroundColor: scoreColors[score] + '33', fontWeight: score === importanceScore ? 'bold' : 'normal', border: score === importanceScore ? '2px solid #1890ff' : '1px solid #d9d9d9' }}>
                                {score}
                              </td>
                            )
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {valuation.evaluationReason && (
              <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
                <Text type="secondary">평가 사유</Text>
                <p style={{ margin: '8px 0 0 0' }}>{valuation.evaluationReason}</p>
              </div>
            )}

            {valuation.evaluatorName && (
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  평가자: {valuation.evaluatorName} | 평가일시: {valuation.evaluatedAt?.substring(0, 10)}
                </Text>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            아직 CIA 평가가 등록되지 않았습니다.
            {!readonly && (
              <div style={{ marginTop: 16 }}>
                <Button type="primary" onClick={handleOpenModal}>
                  평가 등록하기
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 평가 모달 */}
      <Modal
        title="CIA 평가"
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={submitting}
        okText="저장"
        cancelText="취소"
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="confidentiality"
            label="기밀성 (Confidentiality)"
            rules={[{ required: true, message: '기밀성 등급을 선택해주세요' }]}
            extra="정보의 비밀 유지 중요도"
          >
            <Select placeholder="선택">
              <Option value={1}>하 (1) - 공개 정보</Option>
              <Option value={2}>중 (2) - 내부 정보</Option>
              <Option value={3}>상 (3) - 기밀 정보</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="integrity"
            label="무결성 (Integrity)"
            rules={[{ required: true, message: '무결성 등급을 선택해주세요' }]}
            extra="정보의 정확성 및 완전성 중요도"
          >
            <Select placeholder="선택">
              <Option value={1}>하 (1) - 변경 허용</Option>
              <Option value={2}>중 (2) - 제한적 변경</Option>
              <Option value={3}>상 (3) - 변경 금지</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="availability"
            label="가용성 (Availability)"
            rules={[{ required: true, message: '가용성 등급을 선택해주세요' }]}
            extra="정보 접근 가능성 중요도"
          >
            <Select placeholder="선택">
              <Option value={1}>하 (1) - 일부 중단 허용</Option>
              <Option value={2}>중 (2) - 최소 중단</Option>
              <Option value={3}>상 (3) - 중단 불가</Option>
            </Select>
          </Form.Item>

          <Form.Item name="evaluationReason" label="평가 사유">
            <TextArea rows={3} placeholder="평가 사유를 입력하세요" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default CIAEvaluation
