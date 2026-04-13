/**
 * 위험 관리 TypeScript 타입 정의
 * Phase 2: FR-601 ~ FR-607
 *
 * Backend schemas/risk.py와 1:1 매핑
 */

// =============================================================================
// 위협 분류 타입
// =============================================================================

export interface ThreatCategory {
  id: number
  code: string
  name: string
  description: string | null
  parentId: number | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  children?: ThreatCategory[]
}

export interface ThreatCategoryCreate {
  code: string
  name: string
  description?: string | null
  parentId?: number | null
  sortOrder?: number
}

// =============================================================================
// 위협 타입 (FR-601)
// =============================================================================

export interface Threat {
  id: number
  code: string
  name: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  threatLevel: 1 | 2 | 3 // 1: 하, 2: 중, 3: 상
  isCustom: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface ThreatCreate {
  code: string
  name: string
  description?: string | null
  categoryId?: number | null
  threatLevel?: 1 | 2 | 3
}

export interface ThreatUpdate {
  name?: string
  description?: string | null
  categoryId?: number | null
  threatLevel?: 1 | 2 | 3
  isActive?: boolean
}

export interface ThreatList {
  items: Threat[]
  total: number
}

// =============================================================================
// 취약점 분류 타입
// =============================================================================

export interface VulnerabilityCategory {
  id: number
  code: string
  name: string
  description: string | null
  parentId: number | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface VulnerabilityCategoryCreate {
  code: string
  name: string
  description?: string | null
  parentId?: number | null
  sortOrder?: number
}

// =============================================================================
// 취약점 타입 (FR-602)
// =============================================================================

export interface Vulnerability {
  id: number
  code: string
  name: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  vulnerabilityLevel: 1 | 2 | 3 // 1: 하, 2: 중, 3: 상
  isCustom: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface VulnerabilityCreate {
  code: string
  name: string
  description?: string | null
  categoryId?: number | null
  vulnerabilityLevel?: 1 | 2 | 3
}

export interface VulnerabilityUpdate {
  name?: string
  description?: string | null
  categoryId?: number | null
  vulnerabilityLevel?: 1 | 2 | 3
  isActive?: boolean
}

export interface VulnerabilityList {
  items: Vulnerability[]
  total: number
}

export type RemediationStatus = 'open' | 'in_progress' | 'closed' | 'accepted'

export interface VulnerabilityAssessment {
  id: number
  assetId: number
  assetName: string | null
  assetCode: string | null
  vulnerabilityId: number
  vulnerabilityName: string | null
  vulnerabilityCode: string | null
  isVulnerable: boolean
  assessmentDate: string
  assessedBy: number | null
  assessorName: string | null
  findings: string | null
  remediationStatus: RemediationStatus
  remediationDate: string | null
  remarks: string | null
  createdAt: string
}

export interface VulnerabilityAssessmentCreate {
  assetId: number
  vulnerabilityId: number
  isVulnerable?: boolean
  assessmentDate: string
  findings?: string | null
  remediationStatus?: RemediationStatus
  remarks?: string | null
}

export interface VulnerabilityAssessmentList {
  items: VulnerabilityAssessment[]
  total: number
  page: number
  size: number
  pages: number
}

// =============================================================================
// 위험 시나리오 타입 (FR-603)
// =============================================================================

export type RiskScenarioStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled'

export interface RiskScenario {
  id: number
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  status: RiskScenarioStatus
  createdBy: number
  creatorName: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string | null
  assessmentCount: number
  highRiskCount: number
  exceedingDoaCount: number
}

export interface RiskScenarioCreate {
  name: string
  description?: string | null
  startDate: string
  endDate?: string | null
}

export interface RiskScenarioUpdate {
  name?: string
  description?: string | null
  startDate?: string
  endDate?: string | null
  status?: RiskScenarioStatus
}

export interface RiskScenarioList {
  items: RiskScenario[]
  total: number
  page: number
  size: number
  pages: number
}

// =============================================================================
// 위험 평가 타입 (FR-603)
// =============================================================================

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskAssessment {
  id: number
  scenarioId: number
  assetId: number
  assetName: string | null
  assetCode: string | null
  threatId: number
  threatName: string | null
  vulnerabilityId: number
  vulnerabilityName: string | null
  assetValue: 1 | 2 | 3 // 1: 하, 2: 중, 3: 상
  threatLevel: 1 | 2 | 3
  vulnerabilityLevel: 1 | 2 | 3
  riskScore: number | null
  riskLevel: RiskLevel | null
  exceedsDoa: boolean
  evaluatedBy: number | null
  evaluatorName: string | null
  evaluatedAt: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string | null
  hasTreatmentPlan: boolean
}

export interface RiskAssessmentCreate {
  assetId: number
  threatId: number
  vulnerabilityId: number
  assetValue: 1 | 2 | 3
  threatLevel: 1 | 2 | 3
  vulnerabilityLevel: 1 | 2 | 3
  remarks?: string | null
}

export interface RiskAssessmentUpdate {
  assetId?: number
  threatId?: number
  vulnerabilityId?: number
  assetValue?: 1 | 2 | 3
  threatLevel?: 1 | 2 | 3
  vulnerabilityLevel?: 1 | 2 | 3
  remarks?: string | null
}

export interface RiskAssessmentList {
  items: RiskAssessment[]
  total: number
  page: number
  size: number
  pages: number
}

export interface RiskAssessmentBulkCreate {
  assessments: RiskAssessmentCreate[]
}

// =============================================================================
// DoA 관리 타입 (FR-604)
// =============================================================================

export interface DoAConfig {
  id: number
  thresholdValue: number // 1-27
  effectiveDate: string
  expiryDate: string | null
  remarks: string | null
  approvedBy: number | null
  approverName: string | null
  approvalDate: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface DoAConfigCreate {
  thresholdValue: number
  effectiveDate: string
  expiryDate?: string | null
  remarks?: string | null
}

export interface DoAHistory {
  id: number
  doaConfigId: number
  oldThreshold: number | null
  newThreshold: number
  changeReason: string | null
  changedBy: number
  changerName: string | null
  changedAt: string
}

// =============================================================================
// 위험 처리 계획 타입 (FR-605)
// =============================================================================

export type TreatmentStrategy = 'reduce' | 'avoid' | 'transfer' | 'accept'
export type TreatmentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface RiskTreatmentPlan {
  id: number
  riskAssessmentId: number
  riskScore: number | null
  riskLevel: RiskLevel | null
  assetName: string | null
  threatName: string | null
  vulnerabilityName: string | null
  strategy: TreatmentStrategy
  strategyName: string | null // 한글 전략명
  description: string | null
  assigneeId: number | null
  assigneeName: string | null
  dueDate: string | null
  budget: number | null
  status: TreatmentStatus
  completedAt: string | null
  createdAt: string
  updatedAt: string | null
  actionCount: number
  latestResidualRisk: number | null
}

export interface RiskTreatmentPlanCreate {
  strategy: TreatmentStrategy
  description?: string | null
  assigneeId?: number | null
  dueDate?: string | null
  budget?: number | null
}

export interface RiskTreatmentPlanUpdate {
  strategy?: TreatmentStrategy
  description?: string | null
  assigneeId?: number | null
  dueDate?: string | null
  budget?: number | null
  status?: TreatmentStatus
}

export interface RiskTreatmentPlanList {
  items: RiskTreatmentPlan[]
  total: number
  page: number
  size: number
  pages: number
}

export interface RiskTreatmentAction {
  id: number
  planId: number
  actionDescription: string
  result: string | null
  residualRiskScore: number | null
  completedBy: number | null
  completerName: string | null
  completedAt: string | null
  evidenceFilePath: string | null
  createdAt: string
}

export interface RiskTreatmentActionCreate {
  actionDescription: string
  result?: string | null
  residualRiskScore?: number | null
  evidenceFilePath?: string | null
}

export interface RiskTreatmentProgress {
  total: number
  completed: number
  inProgress: number
  planned: number
  cancelled: number
  completionRate: number
}

// =============================================================================
// SOA 관리 타입 (FR-606)
// =============================================================================

export type ImplementationStatus =
  | 'fully_implemented'
  | 'partially_implemented'
  | 'planned'
  | 'not_implemented'
  | 'not_applicable'

export interface SOARecord {
  id: number
  controlItemId: number
  controlCode: string | null
  controlTitle: string | null
  controlDescription: string | null
  isApplicable: boolean
  exclusionReason: string | null
  implementationStatus: ImplementationStatus
  implementationStatusName: string | null // 한글명
  implementationEvidence: string | null
  relatedAssets: string | null
  relatedRisks: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string | null
}

export interface SOARecordUpdate {
  isApplicable?: boolean
  exclusionReason?: string | null
  implementationStatus?: ImplementationStatus
  implementationEvidence?: string | null
  relatedAssets?: string | null
  relatedRisks?: string | null
  remarks?: string | null
}

export interface SOARecordList {
  items: SOARecord[]
  total: number
  applicableCount: number
  notApplicableCount: number
}

export type SOAExportFormat = 'excel' | 'word'
export type SOATemplateType = 'isms_p' | 'iso27001'

export interface SOAExportRequest {
  format: SOAExportFormat
  templateType: SOATemplateType
}

// =============================================================================
// 위험 보고서 타입 (FR-607)
// =============================================================================

export interface RiskDistribution {
  high: number
  medium: number
  low: number
  total: number
}

export interface CellRiskLevel {
  high: number
  medium: number
  low: number
}

export interface RiskMatrixData {
  matrix: number[][]
  cellRiskLevels?: CellRiskLevel[][]
  cellAssetValues?: number[][][]
  labels: {
    x: string[]
    y: string[]
  }
}

export interface ScenarioComparison {
  scenario1Id: number
  scenario1Name: string
  scenario2Id: number
  scenario2Name: string
  riskCountDiff: number
  highRiskDiff: number
  avgRiskScoreDiff: number
}

export interface RiskReportSummary {
  scenarioId: number
  scenarioName: string
  assessmentPeriod: string
  totalAssets: number
  totalRisks: number
  riskDistribution: RiskDistribution
  exceedingDoaCount: number
  treatmentProgress: RiskTreatmentProgress
  topRisks: RiskAssessment[]
}

export interface ExecutiveSummary {
  reportDate: string
  scenarioName: string
  keyFindings: string[]
  riskOverview: Record<string, unknown>
  recommendations: string[]
  actionItems: Array<Record<string, unknown>>
}

// =============================================================================
// 위험-통제 연계 타입 (5.4)
// =============================================================================

export type LinkType = 'primary' | 'secondary' | 'related'

export interface RiskTreatmentControlLink {
  id: number
  treatmentPlanId: number
  controlItemId: number
  linkType: LinkType
  effectivenessRating: number | null // 0.0 ~ 1.0
  remarks: string | null
  createdBy: number | null
  createdAt: string
  updatedAt: string | null
}

export interface RiskTreatmentControlLinkCreate {
  treatmentPlanId: number
  controlItemIds: number[]
  linkType?: LinkType
  effectivenessRating?: number | null
  remarks?: string | null
}

export interface ControlItemBrief {
  id: number
  code: string
  title: string
}

export interface LinkedControlDetail {
  id: number
  controlItem: ControlItemBrief
  linkType: LinkType
  effectivenessRating: number | null
  createdAt: string
  remarks: string | null
}

export interface ControlEffectivenessAnalysis {
  controlItemId: number
  linkedTreatmentCount: number
  averageEffectiveness: number
  implementationRate: number
  residualRiskSummary: Record<string, unknown>
}

export interface RiskControlCoverageAnalysis {
  totalRisks: number
  controlledRisks: number
  coveragePercentage: number
}

export interface RiskControlMatrixResponse {
  matrix: Array<Record<string, unknown>>
  coverageAnalysis: RiskControlCoverageAnalysis
  uncontrolledRisks: Array<Record<string, unknown>>
  controlSummary: Record<string, unknown>
}

export interface ResidualRiskTrendResponse {
  treatmentPlanId: number
  initialRiskScore: number
  currentResidualScore: number
  trendData: Array<Record<string, unknown>>
  reductionPercentage: number
}

// =============================================================================
// 상수 정의
// =============================================================================

export const THREAT_LEVELS = [
  { value: 1, label: '매우 낮음', color: '#b7eb8f' },
  { value: 2, label: '낮음', color: '#52c41a' },
  { value: 3, label: '보통', color: '#faad14' },
  { value: 4, label: '높음', color: '#ff7a45' },
  { value: 5, label: '매우 높음', color: '#ff4d4f' },
] as const

export const VULNERABILITY_LEVELS = [
  { value: 1, label: '매우 낮음', color: '#b7eb8f' },
  { value: 2, label: '낮음', color: '#52c41a' },
  { value: 3, label: '보통', color: '#faad14' },
  { value: 4, label: '높음', color: '#ff7a45' },
  { value: 5, label: '매우 높음', color: '#ff4d4f' },
] as const

export const RISK_LEVELS = [
  { value: 'low', label: '낮음', color: '#52c41a', min: 1, max: 8 },
  { value: 'medium', label: '중간', color: '#faad14', min: 9, max: 17 },
  { value: 'high', label: '높음', color: '#ff4d4f', min: 18, max: 27 },
] as const

export const REMEDIATION_STATUSES = [
  { value: 'open', label: '미조치', color: '#ff4d4f' },
  { value: 'in_progress', label: '조치 중', color: '#faad14' },
  { value: 'closed', label: '조치 완료', color: '#52c41a' },
  { value: 'accepted', label: '수용', color: '#1890ff' },
] as const

export const RISK_SCENARIO_STATUSES = [
  { value: 'draft', label: '작성 중', color: '#d9d9d9' },
  { value: 'in_progress', label: '진행 중', color: '#1890ff' },
  { value: 'completed', label: '완료', color: '#52c41a' },
  { value: 'cancelled', label: '취소', color: '#8c8c8c' },
] as const

export const TREATMENT_STRATEGIES = [
  { value: 'reduce', label: '위험 감소', icon: 'ArrowDownOutlined', description: '보안 통제 구현으로 위험 감소' },
  { value: 'avoid', label: '위험 회피', icon: 'StopOutlined', description: '위험 활동 중단 또는 회피' },
  { value: 'transfer', label: '위험 전가', icon: 'SwapOutlined', description: '보험 또는 아웃소싱으로 위험 전가' },
  { value: 'accept', label: '위험 수용', icon: 'CheckCircleOutlined', description: '위험을 인지하고 수용' },
] as const

export const TREATMENT_STATUSES = [
  { value: 'planned', label: '계획됨', color: '#d9d9d9' },
  { value: 'in_progress', label: '진행 중', color: '#1890ff' },
  { value: 'completed', label: '완료', color: '#52c41a' },
  { value: 'cancelled', label: '취소', color: '#8c8c8c' },
] as const

export const IMPLEMENTATION_STATUSES = [
  { value: 'fully_implemented', label: '완전 구현', color: '#52c41a' },
  { value: 'partially_implemented', label: '부분 구현', color: '#faad14' },
  { value: 'planned', label: '계획됨', color: '#1890ff' },
  { value: 'not_implemented', label: '미구현', color: '#ff4d4f' },
  { value: 'not_applicable', label: '적용 제외', color: '#8c8c8c' },
] as const

export const SOA_EXPORT_FORMATS = [
  { value: 'excel', label: 'Excel (.xlsx)', icon: 'FileExcelOutlined' },
  { value: 'word', label: 'Word (.docx)', icon: 'FileWordOutlined' },
] as const

export const SOA_TEMPLATE_TYPES = [
  { value: 'isms_p', label: 'ISMS-P (정보보호 및 개인정보보호)', description: 'KISA 인증 표준 양식' },
  { value: 'iso27001', label: 'ISO 27001', description: '국제 표준 양식' },
] as const

// =============================================================================
// 헬퍼 함수
// =============================================================================

/**
 * 위협 등급 레이블 조회
 */
export function getThreatLevelLabel(level: number): string {
  const found = THREAT_LEVELS.find(item => item.value === level)
  return found ? found.label : '알 수 없음'
}

/**
 * 취약점 등급 레이블 조회
 */
export function getVulnerabilityLevelLabel(level: number): string {
  const found = VULNERABILITY_LEVELS.find(item => item.value === level)
  return found ? found.label : '알 수 없음'
}

/**
 * 위험 등급 레이블 조회
 */
export function getRiskLevelLabel(level: RiskLevel | null): string {
  if (!level) return '알 수 없음'
  const found = RISK_LEVELS.find(item => item.value === level)
  return found ? found.label : '알 수 없음'
}

/**
 * 조치 상태 레이블 조회
 */
export function getRemediationStatusLabel(status: RemediationStatus): string {
  const found = REMEDIATION_STATUSES.find(item => item.value === status)
  return found ? found.label : '알 수 없음'
}

/**
 * 처리 전략 레이블 조회
 */
export function getTreatmentStrategyLabel(strategy: string): string {
  const found = TREATMENT_STRATEGIES.find(item => item.value === strategy)
  return found ? found.label : '알 수 없음'
}

/**
 * 처리 상태 레이블 조회
 */
export function getTreatmentStatusLabel(status: TreatmentStatus): string {
  const found = TREATMENT_STATUSES.find(item => item.value === status)
  return found ? found.label : '알 수 없음'
}

/**
 * 구현 상태 레이블 조회
 */
export function getImplementationStatusLabel(status: ImplementationStatus): string {
  const found = IMPLEMENTATION_STATUSES.find(item => item.value === status)
  return found ? found.label : '알 수 없음'
}

/**
 * 위험도(DoR) 계산
 * DoR = 자산가치 × 위협등급 × 취약점등급
 */
export function calculateRiskScore(assetValue: number, threatLevel: number, vulnerabilityLevel: number): number {
  return assetValue * threatLevel * vulnerabilityLevel
}

/**
 * 위험 등급 분류
 * 1-8: 낮음, 9-17: 중간, 18-27: 높음
 */
export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 18) return 'high'
  if (score >= 9) return 'medium'
  return 'low'
}

/**
 * 고위험 여부 판단
 */
export function isHighRisk(score: number): boolean {
  return score >= 18
}

/**
 * 위험 점수 포맷팅
 */
export function formatRiskScore(score: number): string {
  const level = classifyRiskLevel(score)
  const label = getRiskLevelLabel(level)
  return `${score} (${label})`
}

/**
 * DoA 초과 여부 판단
 */
export function exceedsDoA(riskScore: number, doaThreshold: number): boolean {
  return riskScore > doaThreshold
}

/**
 * 위험 분포 계산
 */
export function calculateRiskDistribution(assessments: RiskAssessment[]): RiskDistribution {
  const distribution = {
    high: 0,
    medium: 0,
    low: 0,
    total: assessments.length,
  }

  assessments.forEach(assessment => {
    if (assessment.riskLevel === 'high') {
      distribution.high++
    } else if (assessment.riskLevel === 'medium') {
      distribution.medium++
    } else if (assessment.riskLevel === 'low') {
      distribution.low++
    }
  })

  return distribution
}

/**
 * 진행률 계산
 */
export function calculateCompletionRate(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100) / 100
}
