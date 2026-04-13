/**
 * 위험 매트릭스 (히트맵) 컴포넌트
 * 3×3 그리드로 위협등급(Y축) × 취약점등급(X축) 별 위험 건수를 시각화
 */
import { Card, Tooltip, Empty, Spin } from 'antd'
import type { RiskMatrixData, CellRiskLevel } from '@/types'

interface RiskMatrixProps {
  data: RiskMatrixData | null
  loading?: boolean
  doaThreshold?: number | null
  onCellClick?: (threatLevel: number, vulnLevel: number) => void
}

/**
 * 셀의 실제 위험등급에 따른 색상 결정
 * cell_risk_levels가 있으면 실제 저장된 risk_level 기반,
 * 없으면 기존 근사값 fallback
 */
const getCellColor = (
  count: number,
  cellRisk?: CellRiskLevel,
): string => {
  if (count === 0) return '#fafafa'

  if (cellRisk) {
    if (cellRisk.high > 0) return '#ff4d4f'
    if (cellRisk.medium > 0) return '#faad14'
    return '#52c41a'
  }

  return '#d9d9d9'
}

const getCellTextColor = (
  count: number,
  cellRisk?: CellRiskLevel,
): string => {
  if (count === 0) return '#d9d9d9'
  if (cellRisk && cellRisk.high > 0) return '#fff'
  return '#000'
}

const getRiskLabel = (
  cellRisk?: CellRiskLevel,
): string => {
  if (!cellRisk) return ''
  if (cellRisk.high > 0) return '고위험'
  if (cellRisk.medium > 0) return '중위험'
  return '저위험'
}

const AXIS_LABELS = ['하(1)', '중(2)', '상(3)']

const RiskMatrix = ({ data, loading = false, doaThreshold, onCellClick }: RiskMatrixProps) => {
  if (loading) {
    return (
      <Card title="위험 매트릭스">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      </Card>
    )
  }

  if (!data || !data.matrix || data.matrix.length === 0) {
    return (
      <Card title="위험 매트릭스">
        <Empty description="매트릭스 데이터가 없습니다" />
      </Card>
    )
  }

  const matrix = data.matrix
  const cellRiskLevels = data.cellRiskLevels
  const cellAssetValues = data.cellAssetValues
  const xLabels = data.labels?.x || AXIS_LABELS
  const yLabels = data.labels?.y || AXIS_LABELS

  // 총 건수 계산
  const totalCount = matrix.reduce(
    (sum, row) => sum + row.reduce((rSum, cell) => rSum + cell, 0),
    0
  )

  return (
    <Card
      title="위험 매트릭스"
      extra={
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          총 {totalCount}건
          {doaThreshold && ` | DoA: ${doaThreshold}`}
        </span>
      }
    >
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Y축 라벨 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
            gap: 4,
          }}
        >
          <div style={{ fontSize: 12, color: '#595959' }}>↑</div>
          <div
            style={{
              writingMode: 'vertical-rl',
              fontSize: 12,
              fontWeight: 'bold',
              color: '#595959',
            }}
          >
            위협등급
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {/* 매트릭스 그리드 (상→하 = 상(3)→하(1)) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `60px repeat(${xLabels.length}, 1fr)`,
              gridTemplateRows: `repeat(${yLabels.length}, 80px) 30px`,
              gap: 2,
            }}
          >
            {/* 행 (위협등급: 상→하) */}
            {[...yLabels].reverse().map((yLabel, reversedRowIdx) => {
              const rowIdx = yLabels.length - 1 - reversedRowIdx
              return [
                // Y축 라벨 셀
                <div
                  key={`y-${rowIdx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#595959',
                  }}
                >
                  {yLabel}
                </div>,
                // 데이터 셀
                ...xLabels.map((_, colIdx) => {
                  const count = matrix[rowIdx]?.[colIdx] ?? 0
                  const cellRisk = cellRiskLevels?.[rowIdx]?.[colIdx]
                  const assetValues = cellAssetValues?.[rowIdx]?.[colIdx]
                  const bgColor = getCellColor(count, cellRisk)
                  const textColor = getCellTextColor(count, cellRisk)
                  const riskLabel = getRiskLabel(cellRisk)

                  // 툴팁: 자산가치 요약 포함
                  let tooltipText = `위협 ${yLabels[rowIdx]} × 취약점 ${xLabels[colIdx]}: ${count}건`
                  if (riskLabel) tooltipText += ` (${riskLabel})`
                  if (assetValues && assetValues.length > 0) {
                    const avg = (assetValues.reduce((s, v) => s + v, 0) / assetValues.length).toFixed(1)
                    const min = Math.min(...assetValues)
                    const max = Math.max(...assetValues)
                    tooltipText += min === max
                      ? ` | 자산가치: ${min}`
                      : ` | 자산가치: ${min}~${max} (평균 ${avg})`
                  }

                  return (
                    <Tooltip
                      key={`cell-${rowIdx}-${colIdx}`}
                      title={tooltipText}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: bgColor,
                          borderRadius: 4,
                          cursor: onCellClick ? 'pointer' : 'default',
                          border: count > 0 ? 'none' : '1px solid #f0f0f0',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onClick={() => onCellClick?.(rowIdx + 1, colIdx + 1)}
                        onMouseEnter={(e) => {
                          if (onCellClick) {
                            e.currentTarget.style.transform = 'scale(1.05)'
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.boxShadow = 'none'
                        }}
                      >
                        <span
                          style={{
                            fontSize: 24,
                            fontWeight: 'bold',
                            color: count > 0 ? textColor : '#d9d9d9',
                          }}
                        >
                          {count}
                        </span>
                        {riskLabel && (
                          <span
                            style={{
                              fontSize: 10,
                              color: count > 0 ? textColor : '#d9d9d9',
                              opacity: 0.8,
                            }}
                          >
                            {riskLabel}
                          </span>
                        )}
                      </div>
                    </Tooltip>
                  )
                }),
              ]
            })}

            {/* X축 라벨 행 */}
            <div /> {/* 빈 셀 (좌측 상단) */}
            {xLabels.map((label, idx) => (
              <div
                key={`x-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: '#595959',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* X축 타이틀 */}
          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 'bold',
              color: '#595959',
              marginTop: 8,
            }}
          >
            취약점등급 →
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid #f0f0f0',
        }}
      >
        {[
          { color: '#52c41a', label: '저위험' },
          { color: '#faad14', label: '중위험' },
          { color: '#ff4d4f', label: '고위험' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                backgroundColor: item.color,
              }}
            />
            <span style={{ fontSize: 12, color: '#595959' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default RiskMatrix
