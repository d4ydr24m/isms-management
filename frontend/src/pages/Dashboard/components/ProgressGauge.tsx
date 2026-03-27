import { Card, Progress, Row, Col, Statistic } from 'antd'
import {
  CheckCircleOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { EvidenceProgress } from '@/types'

interface ProgressGaugeProps {
  data: EvidenceProgress
}

const ProgressGauge: React.FC<ProgressGaugeProps> = ({ data }) => {
  const getProgressStatus = (percentage: number) => {
    if (percentage >= 80) return 'success'
    if (percentage < 50) return 'exception'
    return 'active'
  }

  return (
    <Card title="인증 준비 진척률" variant="borderless">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Progress
            type="dashboard"
            percent={data.progressPercentage}
            status={getProgressStatus(data.progressPercentage)}
            strokeWidth={8}
            format={(percent) => `${percent}%`}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={12} sm={6}>
          <Statistic
            title="전체"
            value={data.total}
            prefix={<FileTextOutlined />}
            valueStyle={{ fontSize: '20px' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="활성"
            value={data.active}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a', fontSize: '20px' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="초안"
            value={data.draft}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#faad14', fontSize: '20px' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="만료"
            value={data.expired}
            prefix={<WarningOutlined />}
            valueStyle={{ color: '#ff4d4f', fontSize: '20px' }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Col span={24}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#8c8c8c', marginBottom: 8 }}>
              필수 항목 진척률
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
              {data.requiredActive} / {data.requiredTotal}
            </div>
            <Progress
              percent={data.requiredProgressPercentage}
              status={getProgressStatus(data.requiredProgressPercentage)}
              strokeColor="#1890ff"
              style={{ marginTop: 8 }}
            />
          </div>
        </Col>
      </Row>
    </Card>
  )
}

export default ProgressGauge
