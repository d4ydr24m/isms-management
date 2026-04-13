/**
 * 자산 통계 대시보드 위젯 컴포넌트
 * 유형별, 부서별, 중요도별 자산 분포 차트
 */
import { useState, useEffect, useCallback } from 'react'
import { App, Card, Row, Col, Statistic, Spin } from 'antd'
import {
  DesktopOutlined,
  SafetyOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { assetService } from '@/services/assets'
import type {
  AssetStats,
  AssetByTypeStats,
  AssetByDepartmentStats,
  AssetByImportanceStats,
  AssetLifecycleStats,
} from '@/types'

// 차트 색상
const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16']
const IMPORTANCE_COLORS = { 1: '#52c41a', 2: '#faad14', 3: '#f5222d' }
const STATUS_COLORS = {
  introduced: '#1890ff',
  operating: '#52c41a',
  changed: '#faad14',
  disposed: '#999',
}

interface AssetStatsWidgetsProps {
  showSummary?: boolean
  showTypeChart?: boolean
  showDepartmentChart?: boolean
  showImportanceChart?: boolean
  showLifecycleChart?: boolean
}

const AssetStatsWidgets = ({
  showSummary = true,
  showTypeChart = true,
  showDepartmentChart = true,
  showImportanceChart = true,
  showLifecycleChart = true,
}: AssetStatsWidgetsProps) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AssetStats | null>(null)
  const [byType, setByType] = useState<AssetByTypeStats[]>([])
  const [byDepartment, setByDepartment] = useState<AssetByDepartmentStats[]>([])
  const [byImportance, setByImportance] = useState<AssetByImportanceStats[]>([])
  const [lifecycle, setLifecycle] = useState<AssetLifecycleStats | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, typeRes, deptRes, impRes, lifecycleRes] = await Promise.all([
        assetService.getAssetStats(),
        assetService.getAssetsByType(),
        assetService.getAssetsByDepartment(),
        assetService.getAssetsByImportance(),
        assetService.getLifecycleStats(),
      ])
      setStats(statsRes)
      setByType(typeRes)
      setByDepartment(deptRes)
      setByImportance(impRes)
      setLifecycle(lifecycleRes)
    } catch {
      message.error('통계 데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  // 유형별 파이 차트 데이터
  const typeChartData = byType.map((item) => ({
    name: item.typeName,
    value: item.count,
  }))

  // 부서별 바 차트 데이터
  const departmentChartData = byDepartment.slice(0, 10).map((item) => ({
    name: item.departmentName.length > 8 ? item.departmentName.substring(0, 8) + '...' : item.departmentName,
    자산수: item.count,
  }))

  // 중요도별 도넛 차트 데이터
  const importanceChartData = byImportance.map((item) => ({
    name: item.label,
    value: item.count,
    color: IMPORTANCE_COLORS[item.importanceLevel as keyof typeof IMPORTANCE_COLORS],
  }))

  // 라이프사이클 차트 데이터
  const lifecycleChartData = lifecycle
    ? [
        { name: '도입', value: lifecycle.byStatus.introduced || 0, color: STATUS_COLORS.introduced },
        { name: '운영', value: lifecycle.byStatus.operating || 0, color: STATUS_COLORS.operating },
        { name: '변경', value: lifecycle.byStatus.changed || 0, color: STATUS_COLORS.changed },
        { name: '폐기', value: lifecycle.byStatus.disposed || 0, color: STATUS_COLORS.disposed },
      ]
    : []

  return (
    <div>
      {/* 요약 통계 */}
      {showSummary && stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="총 자산 수"
                value={stats.totalCount}
                prefix={<DesktopOutlined />}
                suffix="건"
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="운영 중"
                value={stats.activeCount}
                prefix={<SafetyOutlined />}
                suffix="건"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="이번 달 등록"
                value={stats.recentAdded}
                prefix={<RiseOutlined />}
                suffix="건"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="이번 달 폐기"
                value={stats.recentDisposed}
                prefix={<FallOutlined />}
                suffix="건"
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        {/* 유형별 분포 (파이 차트) */}
        {showTypeChart && (
          <Col xs={24} md={12}>
            <Card title="유형별 자산 분포">
              {typeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: Record<string, any>) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                    >
                      {typeChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                  데이터가 없습니다
                </div>
              )}
            </Card>
          </Col>
        )}

        {/* 부서별 자산 수 (바 차트) */}
        {showDepartmentChart && (
          <Col xs={24} md={12}>
            <Card title="부서별 자산 수">
              {departmentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="자산수" fill="#1890ff" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                  데이터가 없습니다
                </div>
              )}
            </Card>
          </Col>
        )}

        {/* 중요도별 분포 (도넛 차트) */}
        {showImportanceChart && (
          <Col xs={24} md={12}>
            <Card title="중요도별 자산 분포">
              {importanceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={importanceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: Record<string, any>) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                    >
                      {importanceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                  데이터가 없습니다
                </div>
              )}
            </Card>
          </Col>
        )}

        {/* 라이프사이클 현황 */}
        {showLifecycleChart && (
          <Col xs={24} md={12}>
            <Card title="라이프사이클 현황">
              {lifecycleChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={lifecycleChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" />
                    <Tooltip />
                    <Bar dataKey="value">
                      {lifecycleChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                  데이터가 없습니다
                </div>
              )}
            </Card>
          </Col>
        )}
      </Row>
    </div>
  )
}

export default AssetStatsWidgets
