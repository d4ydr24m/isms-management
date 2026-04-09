import { Card, Row, Col, Statistic, Progress, Space } from 'antd'
import { Link } from 'react-router-dom'
import { WarningOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { NonConformitySummary } from '@/types'

interface NonConformityStatusProps {
  data: NonConformitySummary
}

const NonConformityStatus: React.FC<NonConformityStatusProps> = ({ data }) => {
  const getTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      critical: '#ff4d4f',
      major: '#ff7a45',
      minor: '#ffa940',
      observation: '#1890ff',
    }
    return colorMap[type] || '#d9d9d9'
  }

  const getTypeLabel = (type: string) => {
    const labelMap: Record<string, string> = {
      critical: '치명적',
      major: '중대',
      minor: '경미',
      observation: '관찰사항',
    }
    return labelMap[type] || type
  }

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      pending: '처리 대기',
      inProgress: '처리 중',
      completed: '완료',
      verified: '검증 완료',
    }
    return labelMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: '#8c8c8c',
      inProgress: '#1890ff',
      completed: '#52c41a',
      verified: '#13c2c2',
    }
    return colorMap[status] || '#d9d9d9'
  }

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  return (
    <Card
      title="부적합 현황"
      variant="borderless"
      extra={<Link to="/nonconformities">상세보기</Link>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12}>
          <Statistic
            title="잔여 부적합 사항"
            value={data.total}
            prefix={<WarningOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col xs={12} sm={12}>
          <Statistic
            title="기한 초과"
            value={data.overdueCount}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: data.overdueCount > 0 ? '#ff4d4f' : '#52c41a' }}
          />
        </Col>
      </Row>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 16 }}>
          유형별 분포
        </div>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {Object.entries(data.byType).map(([type, count]) => (
            <div key={type}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '12px' }}>
                  {getTypeLabel(type)}: {count}
                </span>
              </div>
              <Progress
                percent={calculatePercentage(count, data.total)}
                strokeColor={getTypeColor(type)}
                status={type === 'critical' ? 'exception' : 'normal'}
                size="small"
              />
            </div>
          ))}
        </Space>
      </div>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: 16 }}>
          처리 진행률
        </div>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div key={status}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: '12px' }}>
                  {getStatusLabel(status)}: {count}
                </span>
              </div>
              <Progress
                percent={calculatePercentage(count, data.total)}
                strokeColor={getStatusColor(status)}
                size="small"
              />
            </div>
          ))}
        </Space>
      </div>
    </Card>
  )
}

export default NonConformityStatus
