/**
 * ThreeWayMapping 컴포넌트
 *
 * 자산-위협-취약점의 3-way 매핑을 시각화하고 입력받는 재사용 가능한 컴포넌트
 *
 * 기능:
 * - 자산, 위협, 취약점 선택
 * - 각 요소의 값/등급 평가 (1-3)
 * - 위험도 자동 계산 및 실시간 표시 (DoR = Asset Value × Threat Level × Vulnerability Level)
 * - 위험 등급 자동 분류 (low/medium/high)
 */

import { Row, Col, Select, Space, Card, Statistic, Tag } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import type { Asset, Threat, Vulnerability } from '@/types'
import { calculateRiskScore, classifyRiskLevel } from '@/types/risk'

// =============================================================================
// 타입 정의
// =============================================================================

export interface ThreeWayMappingValue {
  asset_id?: number
  threat_id?: number
  vulnerability_id?: number
  asset_value?: 1 | 2 | 3
  threat_level?: 1 | 2 | 3
  vulnerability_level?: 1 | 2 | 3
}

export interface ThreeWayMappingProps {
  assets: Asset[]
  threats: Threat[]
  vulnerabilities: Vulnerability[]
  value: ThreeWayMappingValue
  onChange: (value: ThreeWayMappingValue) => void
  disabled?: boolean
}

// =============================================================================
// 상수 정의
// =============================================================================

const LEVEL_OPTIONS = [
  { value: 1, label: '1 - 낮음' },
  { value: 2, label: '2 - 중간' },
  { value: 3, label: '3 - 높음' },
]

const RISK_LEVEL_CONFIG = {
  low: { label: '낮음', color: 'green' },
  medium: { label: '중간', color: 'orange' },
  high: { label: '높음', color: 'red' },
}

// =============================================================================
// 컴포넌트
// =============================================================================

export const ThreeWayMapping: React.FC<ThreeWayMappingProps> = ({
  assets,
  threats,
  vulnerabilities,
  value,
  onChange,
  disabled = false,
}) => {
  // ===========================================================================
  // 핸들러 함수
  // ===========================================================================

  const handleAssetChange = (assetId: number) => {
    onChange({
      ...value,
      asset_id: assetId,
    })
  }

  const handleThreatChange = (threatId: number) => {
    onChange({
      ...value,
      threat_id: threatId,
    })
  }

  const handleVulnerabilityChange = (vulnerabilityId: number) => {
    onChange({
      ...value,
      vulnerability_id: vulnerabilityId,
    })
  }

  const handleAssetValueChange = (assetValue: 1 | 2 | 3) => {
    onChange({
      ...value,
      asset_value: assetValue,
    })
  }

  const handleThreatLevelChange = (threatLevel: 1 | 2 | 3) => {
    onChange({
      ...value,
      threat_level: threatLevel,
    })
  }

  const handleVulnerabilityLevelChange = (vulnerabilityLevel: 1 | 2 | 3) => {
    onChange({
      ...value,
      vulnerability_level: vulnerabilityLevel,
    })
  }

  // ===========================================================================
  // 위험도 계산
  // ===========================================================================

  const calculateRisk = () => {
    const { asset_value, threat_level, vulnerability_level } = value

    if (!asset_value || !threat_level || !vulnerability_level) {
      return null
    }

    const score = calculateRiskScore(asset_value, threat_level, vulnerability_level)
    const level = classifyRiskLevel(score)

    return {
      score,
      level,
      config: RISK_LEVEL_CONFIG[level],
    }
  }

  const riskResult = calculateRisk()

  // ===========================================================================
  // 렌더링
  // ===========================================================================

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 자산-위협-취약점 선택 */}
      <Card title="3-Way 매핑: 자산 × 위협 × 취약점" size="small">
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <strong>자산</strong>
              <Select
                showSearch
                placeholder="자산을 선택하세요"
                style={{ width: '100%' }}
                value={value.asset_id}
                onChange={handleAssetChange}
                disabled={disabled}
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={assets.map((asset) => ({
                  value: asset.id,
                  label: `${asset.assetCode} - ${asset.name}`,
                }))}
              />
            </Space>
          </Col>

          <Col span={8}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <strong>위협</strong>
              <Select
                showSearch
                placeholder="위협을 선택하세요"
                style={{ width: '100%' }}
                value={value.threat_id}
                onChange={handleThreatChange}
                disabled={disabled}
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={threats.map((threat) => ({
                  value: threat.id,
                  label: `${threat.code} - ${threat.name}`,
                }))}
              />
            </Space>
          </Col>

          <Col span={8}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <strong>취약점</strong>
              <Select
                showSearch
                placeholder="취약점을 선택하세요"
                style={{ width: '100%' }}
                value={value.vulnerability_id}
                onChange={handleVulnerabilityChange}
                disabled={disabled}
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={vulnerabilities.map((vuln) => ({
                  value: vuln.id,
                  label: `${vuln.code} - ${vuln.name}`,
                }))}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 값/등급 평가 */}
      <Card title="값/등급 평가" size="small">
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <strong>자산가치</strong>
              <Select
                placeholder="값 선택 (1-3)"
                style={{ width: '100%' }}
                value={value.asset_value}
                onChange={handleAssetValueChange}
                disabled={disabled}
                options={LEVEL_OPTIONS}
              />
            </Space>
          </Col>

          <Col span={8}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <strong>위협등급</strong>
              <Select
                placeholder="등급 선택 (1-3)"
                style={{ width: '100%' }}
                value={value.threat_level}
                onChange={handleThreatLevelChange}
                disabled={disabled}
                options={LEVEL_OPTIONS}
              />
            </Space>
          </Col>

          <Col span={8}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <strong>취약점등급</strong>
              <Select
                placeholder="등급 선택 (1-3)"
                style={{ width: '100%' }}
                value={value.vulnerability_level}
                onChange={handleVulnerabilityLevelChange}
                disabled={disabled}
                options={LEVEL_OPTIONS}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 위험도 자동 계산 결과 */}
      {riskResult && (
        <Card
          size="small"
          style={{
            backgroundColor: '#f6f8fa',
            borderLeft: `4px solid ${riskResult.config.color}`,
          }}
        >
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Statistic
                title="계산된 위험도 (DoR)"
                value={riskResult.score}
                prefix={<WarningOutlined />}
                suffix={
                  <Tag color={riskResult.config.color} style={{ marginLeft: 8 }}>
                    {riskResult.config.label}
                  </Tag>
                }
              />
            </Col>
            <Col>
              <Space direction="vertical" size="small" style={{ fontSize: '12px', color: '#666' }}>
                <div>
                  공식: 자산가치({value.asset_value}) × 위협등급({value.threat_level}) × 취약점등급(
                  {value.vulnerability_level})
                </div>
                <div>
                  분류: 1-8 낮음 / 9-17 중간 / 18-27 높음
                </div>
              </Space>
            </Col>
          </Row>
        </Card>
      )}
    </Space>
  )
}
