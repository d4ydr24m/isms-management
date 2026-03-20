/**
 * 위험 분포 차트 컴포넌트
 * 고위험/중위험/저위험 분포를 수평 바 차트 + 통계로 시각화
 */
import { Card, Empty, Spin, Progress, Row, Col, Statistic } from 'antd'
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import type { RiskDistribution } from '@/types'

interface RiskDistributionChartProps {
  data: RiskDistribution | null
  loading?: boolean
  doaExceedingCount?: number
}

const RiskDistributionChart = ({
  data,
  loading = false,
  doaExceedingCount,
}: RiskDistributionChartProps) => {
  if (loading) {
    return (
      <Card title="위험 분포">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      </Card>
    )
  }

  if (!data || data.total === 0) {
    return (
      <Card title="위험 분포">
        <Empty description="분포 데이터가 없습니다" />
      </Card>
    )
  }

  const { high, medium, low, total } = data
  const highPct = Math.round((high / total) * 100)
  const mediumPct = Math.round((medium / total) * 100)
  const lowPct = Math.round((low / total) * 100)

  return (
    <Card title="위험 분포" extra={<span style={{ fontSize: 12, color: '#8c8c8c' }}>총 {total}건</span>}>
      {/* 통계 카드 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={doaExceedingCount !== undefined ? 6 : 8}>
          <Statistic
            title="고위험"
            value={high}
            suffix={`건 (${highPct}%)`}
            valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
            prefix={<WarningOutlined />}
          />
        </Col>
        <Col span={doaExceedingCount !== undefined ? 6 : 8}>
          <Statistic
            title="중위험"
            value={medium}
            suffix={`건 (${mediumPct}%)`}
            valueStyle={{ color: '#faad14', fontSize: 20 }}
            prefix={<ExclamationCircleOutlined />}
          />
        </Col>
        <Col span={doaExceedingCount !== undefined ? 6 : 8}>
          <Statistic
            title="저위험"
            value={low}
            suffix={`건 (${lowPct}%)`}
            valueStyle={{ color: '#52c41a', fontSize: 20 }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        {doaExceedingCount !== undefined && (
          <Col span={6}>
            <Statistic
              title="DoA 초과"
              value={doaExceedingCount}
              suffix="건"
              valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
              prefix={<WarningOutlined />}
            />
          </Col>
        )}
      </Row>

      {/* 누적 바 차트 */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            height: 32,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {high > 0 && (
            <div
              style={{
                width: `${highPct}%`,
                backgroundColor: '#ff4d4f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold',
                minWidth: high > 0 ? 30 : 0,
              }}
            >
              {highPct}%
            </div>
          )}
          {medium > 0 && (
            <div
              style={{
                width: `${mediumPct}%`,
                backgroundColor: '#faad14',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold',
                minWidth: medium > 0 ? 30 : 0,
              }}
            >
              {mediumPct}%
            </div>
          )}
          {low > 0 && (
            <div
              style={{
                width: `${lowPct}%`,
                backgroundColor: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 'bold',
                minWidth: low > 0 ? 30 : 0,
              }}
            >
              {lowPct}%
            </div>
          )}
        </div>
      </div>

      {/* 개별 바 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>고위험</span>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>{high}건</span>
          </div>
          <Progress
            percent={highPct}
            strokeColor="#ff4d4f"
            showInfo={false}
            size="small"
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>중위험</span>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>{medium}건</span>
          </div>
          <Progress
            percent={mediumPct}
            strokeColor="#faad14"
            showInfo={false}
            size="small"
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13 }}>저위험</span>
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>{low}건</span>
          </div>
          <Progress
            percent={lowPct}
            strokeColor="#52c41a"
            showInfo={false}
            size="small"
          />
        </div>
      </div>
    </Card>
  )
}

export default RiskDistributionChart
