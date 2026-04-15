import { useState, useEffect, useCallback } from 'react'
import {
  App,
  Card,
  Row,
  Col,
  Select,
  Statistic,
  Table,
  Tag,
  Space,
  Typography,
  Spin,
  Empty,
  Button,
  Tooltip,
  Progress,
  Descriptions,
  List,
} from 'antd'
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  FileTextOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  DashboardOutlined,
  RiseOutlined,
  FallOutlined,
  AimOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  getRiskScenarios,
  getRiskReport,
  getExecutiveSummary,
  getRiskMatrixData,
  getRiskDistribution,
  exportRiskReport,
} from '@/services/risks'
import type {
  RiskScenario,
  RiskReportSummary,
  ExecutiveSummary,
  RiskMatrixData,
  RiskDistribution,
  RiskAssessment,
  RiskLevel,
} from '@/types/risk'
import { RISK_LEVELS } from '@/types/risk'
import RiskMatrix from './components/RiskMatrix'
import RiskDistributionChart from './components/RiskDistributionChart'

const { Title, Text } = Typography

const RiskReportPage = () => {
  const { message } = App.useApp()
  const [scenarios, setScenarios] = useState<RiskScenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)

  // 보고서 데이터
  const [report, setReport] = useState<RiskReportSummary | null>(null)
  const [executive, setExecutive] = useState<ExecutiveSummary | null>(null)
  const [matrixData, setMatrixData] = useState<RiskMatrixData | null>(null)
  const [distribution, setDistribution] = useState<RiskDistribution | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // 시나리오 목록 조회
  useEffect(() => {
    const fetchScenarios = async () => {
      setScenarioLoading(true)
      try {
        const result = await getRiskScenarios({ size: 100 })
        setScenarios(result.items)
        // 첫 번째 완료 시나리오 또는 첫 번째 시나리오 선택
        const completed = result.items.find(s => s.status === 'completed')
        const first = completed || result.items[0]
        if (first) {
          setSelectedScenarioId(first.id)
        }
      } catch {
        message.error('시나리오 목록을 불러오는데 실패했습니다.')
      } finally {
        setScenarioLoading(false)
      }
    }
    fetchScenarios()
  }, [])

  // 보고서 데이터 조회
  const fetchReportData = useCallback(async (scenarioId: number) => {
    setReportLoading(true)
    try {
      const [reportData, executiveData, matrix, dist] = await Promise.allSettled([
        getRiskReport(scenarioId),
        getExecutiveSummary(scenarioId),
        getRiskMatrixData(scenarioId),
        getRiskDistribution(scenarioId),
      ])
      setReport(reportData.status === 'fulfilled' ? reportData.value : null)
      setExecutive(executiveData.status === 'fulfilled' ? executiveData.value : null)
      setMatrixData(matrix.status === 'fulfilled' ? matrix.value : null)
      setDistribution(dist.status === 'fulfilled' ? dist.value : null)
    } catch {
      message.error('보고서 데이터를 불러오는데 실패했습니다.')
    } finally {
      setReportLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedScenarioId) {
      fetchReportData(selectedScenarioId)
    }
  }, [selectedScenarioId, fetchReportData])

  // 보고서 내보내기
  const handleExport = async (format: 'excel' | 'word') => {
    if (!selectedScenarioId) return
    setExporting(true)
    try {
      await exportRiskReport(selectedScenarioId, format)
      message.success('보고서 내보내기가 완료되었습니다.')
    } catch {
      message.error('보고서 내보내기에 실패했습니다.')
    } finally {
      setExporting(false)
    }
  }

  // 위험 등급 색상
  const getRiskLevelConfig = (level: RiskLevel | null) => {
    const found = RISK_LEVELS.find(r => r.value === level)
    return found || { label: '-', color: '#d9d9d9' }
  }

  // Top 위험 테이블 컬럼
  const topRiskColumns: ColumnsType<RiskAssessment> = [
    {
      title: '#',
      key: 'index',
      width: 40,
      align: 'center',
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '자산',
      key: 'asset',
      width: 150,
      render: (_, record) => (
        <div>
          <div>{record.assetName}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.assetCode}</Text>
        </div>
      ),
    },
    {
      title: '위협',
      dataIndex: 'threatName',
      key: 'threatName',
      width: 130,
      ellipsis: true,
    },
    {
      title: '취약점',
      dataIndex: 'vulnerabilityName',
      key: 'vulnerabilityName',
      width: 130,
      ellipsis: true,
    },
    {
      title: '위험점수',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 90,
      align: 'center',
      sorter: (a, b) => (b.riskScore || 0) - (a.riskScore || 0),
      render: (score: number | null, record) => {
        const config = getRiskLevelConfig(record.riskLevel)
        return (
          <Tag color={config.color} style={{ fontWeight: 700, fontSize: 14 }}>
            {score ?? '-'}
          </Tag>
        )
      },
    },
    {
      title: '위험등급',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 80,
      align: 'center',
      render: (level: RiskLevel | null) => {
        const config = getRiskLevelConfig(level)
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: 'DoA 초과',
      dataIndex: 'exceedsDoa',
      key: 'exceedsDoa',
      width: 80,
      align: 'center',
      render: (val: boolean) =>
        val ? (
          <Tag icon={<ExclamationCircleOutlined />} color="error">초과</Tag>
        ) : (
          <Tag color="default">이내</Tag>
        ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* 헤더 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 8 }} />
            위험 보고서
          </Title>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="시나리오 선택"
              value={selectedScenarioId}
              onChange={setSelectedScenarioId}
              loading={scenarioLoading}
              style={{ width: 300 }}
              options={scenarios.map(s => ({
                value: s.id,
                label: (
                  <Space>
                    <span>{s.name}</span>
                    <Tag color={s.status === 'completed' ? 'success' : s.status === 'in_progress' ? 'processing' : 'default'} style={{ fontSize: 11 }}>
                      {s.status === 'completed' ? '완료' : s.status === 'in_progress' ? '진행중' : s.status === 'draft' ? '초안' : '취소'}
                    </Tag>
                  </Space>
                ),
              }))}
            />
            <Tooltip title="Excel 내보내기">
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => handleExport('excel')}
                loading={exporting}
                disabled={!selectedScenarioId}
              >
                Excel
              </Button>
            </Tooltip>
            <Tooltip title="Word 내보내기">
              <Button
                icon={<FileWordOutlined />}
                onClick={() => handleExport('word')}
                loading={exporting}
                disabled={!selectedScenarioId}
              >
                Word
              </Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {!selectedScenarioId ? (
        <Card>
          <Empty description="시나리오를 선택해주세요" />
        </Card>
      ) : reportLoading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">보고서 데이터를 불러오는 중...</Text>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* 시나리오 정보 & 핵심 지표 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title={
                    <Space>
                      <DashboardOutlined />
                      <span>총 위험 건수</span>
                    </Space>
                  }
                  value={report?.totalRisks || 0}
                  suffix="건"
                  valueStyle={{ color: '#1890ff', fontSize: 28 }}
                />
                {report && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    평가 대상 자산: {report.totalAssets}건
                  </Text>
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title={
                    <Space>
                      <AlertOutlined />
                      <span>고위험</span>
                    </Space>
                  }
                  value={report?.riskDistribution.high || 0}
                  suffix="건"
                  valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
                  prefix={<WarningOutlined />}
                />
                {report && report.totalRisks > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    전체 대비 {((report.riskDistribution.high / report.totalRisks) * 100).toFixed(1)}%
                  </Text>
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title={
                    <Space>
                      <ExclamationCircleOutlined />
                      <span>DoA 초과</span>
                    </Space>
                  }
                  value={report?.exceedingDoaCount || 0}
                  suffix="건"
                  valueStyle={{ color: '#fa8c16', fontSize: 28 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  즉각적인 조치 필요
                </Text>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title={
                    <Space>
                      <SafetyCertificateOutlined />
                      <span>처리 완료율</span>
                    </Space>
                  }
                  value={report?.treatmentProgress.completionRate || 0}
                  suffix="%"
                  valueStyle={{
                    color: (report?.treatmentProgress.completionRate || 0) >= 80 ? '#52c41a' : '#fa8c16',
                    fontSize: 28,
                  }}
                />
                {report && (
                  <Progress
                    percent={report.treatmentProgress.completionRate}
                    size="small"
                    showInfo={false}
                    strokeColor={(report.treatmentProgress.completionRate || 0) >= 80 ? '#52c41a' : '#fa8c16'}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* 위험 등급 분포 바 */}
          {report && report.totalRisks > 0 && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row align="middle" gutter={8}>
                <Col flex="100px">
                  <Text type="secondary" style={{ fontSize: 12 }}>위험등급 분포</Text>
                </Col>
                <Col flex="auto">
                  <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden' }}>
                    {RISK_LEVELS.map(level => {
                      const count = report.riskDistribution[level.value as keyof RiskDistribution] as number
                      const pct = report.totalRisks > 0 ? (count / report.totalRisks) * 100 : 0
                      if (pct === 0) return null
                      return (
                        <Tooltip key={level.value} title={`${level.label}: ${count}건 (${pct.toFixed(1)}%)`}>
                          <div
                            style={{
                              width: `${pct}%`,
                              backgroundColor: level.color,
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {pct > 10 ? `${level.label} ${count}건` : ''}
                          </div>
                        </Tooltip>
                      )
                    })}
                  </div>
                </Col>
                <Col flex="200px">
                  <Space size={16}>
                    {RISK_LEVELS.map(level => (
                      <span key={level.value} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: level.color,
                          marginRight: 4,
                        }} />
                        {level.label}
                      </span>
                    ))}
                  </Space>
                </Col>
              </Row>
            </Card>
          )}

          {/* 위험 매트릭스 & 분포 차트 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <RiskMatrix
                data={matrixData}
                loading={reportLoading}
                doaThreshold={undefined}
                onCellClick={() => {}}
              />
            </Col>
            <Col span={12}>
              <RiskDistributionChart
                data={distribution}
                loading={reportLoading}
                doaExceedingCount={report?.exceedingDoaCount}
              />
            </Col>
          </Row>

          {/* 처리 현황 & 경영진 요약 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {/* 처리 현황 */}
            <Col span={10}>
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined />
                    <span>위험 처리 현황</span>
                  </Space>
                }
                size="small"
              >
                {report ? (
                  <>
                    <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                      <Col span={12}>
                        <Statistic
                          title="전체"
                          value={report.treatmentProgress.total}
                          suffix="건"
                          valueStyle={{ fontSize: 20 }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="완료"
                          value={report.treatmentProgress.completed}
                          suffix="건"
                          valueStyle={{ fontSize: 20, color: '#52c41a' }}
                          prefix={<CheckCircleOutlined />}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="진행중"
                          value={report.treatmentProgress.inProgress}
                          suffix="건"
                          valueStyle={{ fontSize: 16, color: '#1890ff' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="계획됨"
                          value={report.treatmentProgress.planned}
                          suffix="건"
                          valueStyle={{ fontSize: 16 }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="취소"
                          value={report.treatmentProgress.cancelled}
                          suffix="건"
                          valueStyle={{ fontSize: 16, color: '#8c8c8c' }}
                        />
                      </Col>
                    </Row>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                        완료율
                      </Text>
                      <Progress
                        percent={report.treatmentProgress.completionRate}
                        strokeColor={{
                          '0%': '#ff4d4f',
                          '50%': '#faad14',
                          '100%': '#52c41a',
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <Empty description="데이터 없음" />
                )}
              </Card>
            </Col>

            {/* 경영진 요약 */}
            <Col span={14}>
              <Card
                title={
                  <Space>
                    <FileTextOutlined />
                    <span>경영진 요약</span>
                  </Space>
                }
                size="small"
                extra={
                  executive && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {executive.reportDate}
                    </Text>
                  )
                }
              >
                {executive ? (
                  <div>
                    {/* 주요 발견사항 */}
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 13 }}>
                        <AimOutlined style={{ marginRight: 4 }} />
                        주요 발견사항
                      </Text>
                      <List
                        size="small"
                        dataSource={executive.keyFindings}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '4px 0', borderBottom: 'none' }}>
                            <Text style={{ fontSize: 13 }}>
                              <RiseOutlined style={{ color: '#fa8c16', marginRight: 6 }} />
                              {item}
                            </Text>
                          </List.Item>
                        )}
                        style={{ marginTop: 4 }}
                      />
                    </div>

                    {/* 권고사항 */}
                    <div>
                      <Text strong style={{ fontSize: 13 }}>
                        <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                        권고사항
                      </Text>
                      <List
                        size="small"
                        dataSource={executive.recommendations}
                        renderItem={(item) => (
                          <List.Item style={{ padding: '4px 0', borderBottom: 'none' }}>
                            <Text style={{ fontSize: 13 }}>
                              <FallOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                              {item}
                            </Text>
                          </List.Item>
                        )}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                  </div>
                ) : (
                  <Empty description="경영진 요약 없음" />
                )}
              </Card>
            </Col>
          </Row>

          {/* 시나리오 정보 */}
          {report && (
            <Card
              size="small"
              style={{ marginBottom: 16 }}
              title={
                <Space>
                  <FileTextOutlined />
                  <span>시나리오 정보</span>
                </Space>
              }
            >
              <Descriptions size="small" bordered column={4}>
                <Descriptions.Item label="시나리오명">{report.scenarioName}</Descriptions.Item>
                <Descriptions.Item label="평가 기간">{report.assessmentPeriod}</Descriptions.Item>
                <Descriptions.Item label="평가 대상 자산">{report.totalAssets}건</Descriptions.Item>
                <Descriptions.Item label="총 위험 건수">{report.totalRisks}건</Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {/* Top 위험 목록 */}
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                <span>주요 위험 목록 (Top Risks)</span>
              </Space>
            }
            size="small"
          >
            <Table
              columns={topRiskColumns}
              dataSource={report?.topRisks || []}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="위험 평가 데이터 없음" /> }}
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default RiskReportPage
