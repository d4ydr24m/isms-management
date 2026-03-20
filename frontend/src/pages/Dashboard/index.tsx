import { useState, useEffect } from 'react'
import { Row, Col, Button, Alert, Spin } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { dashboardService } from '@/services/dashboard'
import type { DashboardSummary } from '@/types'
import ProgressGauge from './components/ProgressGauge'
import ActivityList from './components/ActivityList'
import ExpiringEvidences from './components/ExpiringEvidences'
import PendingTasks from './components/PendingTasks'
import NonConformityStatus from './components/NonConformityStatus'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardSummary | null>(null)

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const summary = await dashboardService.getSummary()
      setData(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const handleRefresh = () => {
    loadDashboardData()
  }

  const handleActivityPeriodChange = async (period: 'today' | 'week' | 'month') => {
    // 활동 기간 변경 시 데이터 재로드 (실제로는 API 호출)
    console.log('Period changed:', period)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        message="오류"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={handleRefresh}>
            다시 시도
          </Button>
        }
      />
    )
  }

  if (!data) {
    return null
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>대시보드</h1>
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
        >
          새로고침
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ProgressGauge data={data.evidenceProgress} />
        </Col>
        <Col xs={24} lg={12}>
          <NonConformityStatus data={data.nonConformitySummary} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <ActivityList
            data={data.upcomingActivities}
            onChange={handleActivityPeriodChange}
          />
          {data.upcomingActivities.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
              예정된 활동이 없습니다
            </div>
          )}
        </Col>
        <Col xs={24} lg={12}>
          <ExpiringEvidences data={data.expiringEvidences} />
          {data.expiringEvidences.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
              만료 예정 증적이 없습니다
            </div>
          )}
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <PendingTasks data={data.pendingTasks} />
          {data.pendingTasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#8c8c8c' }}>
              미완료 업무가 없습니다
            </div>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
