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
  parent_id: number | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string | null
  children?: ThreatCategory[]
}

export interface ThreatCategoryCreate {
  code: string
  name: string
  description?: string | null
  parent_id?: number | null
  sort_order?: number
}

// =============================================================================
// 위협 타입 (FR-601)
// =============================================================================

export interface Threat {
  id: number
  code: string
  name: string
  description: string | null
  category_id: number | null
  category_name: string | null
  threat_level: 1 | 2 | 3 // 1: 하, 2: 중, 3: 상
  is_custom: boolean
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface ThreatCreate {
  code: string
  name: string
  description?: string | null
  category_id?: number | null
  threat_level?: 1 | 2 | 3
}

export interface ThreatUpdate {
  name?: string
  description?: string | null
  category_id?: number | null
  threat_level?: 1 | 2 | 3
  is_active?: boolean
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
  parent_id: number | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface VulnerabilityCategoryCreate {
  code: string
  name: string
  description?: string | null
  parent_id?: number | null
  sort_order?: number
}

// =============================================================================
// 취약점 타입 (FR-602)
// =============================================================================

export interface Vulnerability {
  id: number
  code: string
  name: string
  description: string | null
  category_id: number | null
  category_name: string | null
  vulnerability_level: 1 | 2 | 3 // 1: 하, 2: 중, 3: 상
  is_custom: boolean
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface VulnerabilityCreate {
  code: string
  name: string
  description?: string | null
  category_id?: number | null
  vulnerability_level?: 1 | 2 | 3
}

export interface VulnerabilityUpdate {
  name?: string
  description?: string | null
  category_id?: number | null
  vulnerability_level?: 1 | 2 | 3
  is_active?: boolean
}

export interface VulnerabilityList {
  items: Vulnerability[]
  total: number
}

export type RemediationStatus = 'open' | 'in_progress' | 'closed' | 'accepted'

export interface VulnerabilityAssessment {
  id: number
  asset_id: number
  asset_name: string | null
  asset_code: string | null
  vulnerability_id: number
  vulnerability_name: string | null
  vulnerability_code: string | null
  is_vulnerable: boolean
  assessment_date: string
  assessed_by: number | null
  assessor_name: string | null
  findings: string | null
  remediation_status: RemediationStatus
  remediation_date: string | null
  remarks: string | null
  created_at: string
}

export interface VulnerabilityAssessmentCreate {
  asset_id: number
  vulnerability_id: number
  is_vulnerable?: boolean
  assessment_date: string
  findings?: string | null
  remediation_status?: RemediationStatus
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
  start_date: string
  end_date: string | null
  status: RiskScenarioStatus
  created_by: number
  creator_name: string | null
  completed_at: string | null
  created_at: string
  updated_at: string | null
  assessment_count: number
  high_risk_count: number
  exceeding_doa_count: number
}

export interface RiskScenarioCreate {
  name: string
  description?: string | null
  start_date: string
  end_date?: string | null
}

export interface RiskScenarioUpdate {
  name?: string
  description?: string | null
  start_date?: string
  end_date?: string | null
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
  scenario_id: number
  asset_id: number
  asset_name: string | null
  asset_code: string | null
  threat_id: number
  threat_name: string | null
  vulnerability_id: number
  vulnerability_name: string | null
  asset_value: 1 | 2 | 3 // 1: 하, 2: 중, 3: 상
  threat_level: 1 | 2 | 3
  vulnerability_level: 1 | 2 | 3
  risk_score: number | null
  risk_level: RiskLevel | null
  exceeds_doa: boolean
  evaluated_by: number | null
  evaluator_name: string | null
  evaluated_at: string | null
  remarks: string | null
  created_at: string
  updated_at: string | null
  has_treatment_plan: boolean
}

export interface RiskAssessmentCreate {
  asset_id: number
  threat_id: number
  vulnerability_id: number
  asset_value: 1 | 2 | 3
  threat_level: 1 | 2 | 3
  vulnerability_level: 1 | 2 | 3
  remarks?: string | null
}

export interface RiskAssessmentUpdate {
  asset_value?: 1 | 2 | 3
  threat_level?: 1 | 2 | 3
  vulnerability_level?: 1 | 2 | 3
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
  threshold_value: number // 1-27
  effective_date: string
  expiry_date: string | null
  remarks: string | null
  approved_by: number | null
  approver_name: string | null
  approval_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface DoAConfigCreate {
  threshold_value: number
  effective_date: string
  expiry_date?: string | null
  remarks?: string | null
}

export interface DoAHistory {
  id: number
  doa_config_id: number
  old_threshold: number | null
  new_threshold: number
  change_reason: string | null
  changed_by: number
  changer_name: string | null
  changed_at: string
}

// =============================================================================
// 위험 처리 계획 타입 (FR-605)
// =============================================================================

export type TreatmentStrategy = 'reduce' | 'avoid' | 'transfer' | 'accept'
export type TreatmentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface RiskTreatmentPlan {
  id: number
  risk_assessment_id: number
  risk_score: number | null
  risk_level: RiskLevel | null
  asset_name: string | null
  threat_name: string | null
  vulnerability_name: string | null
  strategy: TreatmentStrategy
  strategy_name: string | null // 한글 전략명
  description: string | null
  assignee_id: number | null
  assignee_name: string | null
  due_date: string | null
  budget: number | null
  status: TreatmentStatus
  completed_at: string | null
  created_at: string
  updated_at: string | null
  action_count: number
  latest_residual_risk: number | null
}

export interface RiskTreatmentPlanCreate {
  strategy: TreatmentStrategy
  description?: string | null
  assignee_id?: number | null
  due_date?: string | null
  budget?: number | null
}

export interface RiskTreatmentPlanUpdate {
  strategy?: TreatmentStrategy
  description?: string | null
  assignee_id?: number | null
  due_date?: string | null
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
  plan_id: number
  action_description: string
  result: string | null
  residual_risk_score: number | null
  completed_by: number | null
  completer_name: string | null
  completed_at: string | null
  evidence_file_path: string | null
  created_at: string
}

export interface RiskTreatmentActionCreate {
  action_description: string
  result?: string | null
  residual_risk_score?: number | null
  evidence_file_path?: string | null
}

export interface RiskTreatmentProgress {
  total: number
  completed: number
  in_progress: number
  planned: number
  cancelled: number
  completion_rate: number
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
  control_item_id: number
  control_code: string | null
  control_title: string | null
  control_description: string | null
  is_applicable: boolean
  exclusion_reason: string | null
  implementation_status: ImplementationStatus
  implementation_status_name: string | null // 한글명
  implementation_evidence: string | null
  related_assets: string | null
  related_risks: string | null
  remarks: string | null
  created_at: string
  updated_at: string | null
}

export interface SOARecordUpdate {
  is_applicable?: boolean
  exclusion_reason?: string | null
  implementation_status?: ImplementationStatus
  implementation_evidence?: string | null
  related_assets?: string | null
  related_risks?: string | null
  remarks?: string | null
}

export interface SOARecordList {
  items: SOARecord[]
  total: number
  applicable_count: number
  not_applicable_count: number
}

export type SOAExportFormat = 'excel' | 'word'
export type SOATemplateType = 'isms_p' | 'iso27001'

export interface SOAExportRequest {
  format: SOAExportFormat
  template_type: SOATemplateType
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

export interface RiskMatrixData {
  matrix: number[][]
  labels: {
    x: string[]
    y: string[]
  }
}

export interface ScenarioComparison {
  scenario1_id: number
  scenario1_name: string
  scenario2_id: number
  scenario2_name: string
  risk_count_diff: number
  high_risk_diff: number
  avg_risk_score_diff: number
}

export interface RiskReportSummary {
  scenario_id: number
  scenario_name: string
  assessment_period: string
  total_assets: number
  total_risks: number
  risk_distribution: RiskDistribution
  exceeding_doa_count: number
  treatment_progress: RiskTreatmentProgress
  top_risks: RiskAssessment[]
}

export interface ExecutiveSummary {
  report_date: string
  scenario_name: string
  key_findings: string[]
  risk_overview: Record<string, unknown>
  recommendations: string[]
  action_items: Array<Record<string, unknown>>
}

// =============================================================================
// 위험-통제 연계 타입 (5.4)
// =============================================================================

export type LinkType = 'primary' | 'secondary' | 'related'

export interface RiskTreatmentControlLink {
  id: number
  treatment_plan_id: number
  control_item_id: number
  link_type: LinkType
  effectiveness_rating: number | null // 0.0 ~ 1.0
  remarks: string | null
  created_by: number | null
  created_at: string
  updated_at: string | null
}

export interface RiskTreatmentControlLinkCreate {
  treatment_plan_id: number
  control_item_ids: number[]
  link_type?: LinkType
  effectiveness_rating?: number | null
  remarks?: string | null
}

export interface ControlItemBrief {
  id: number
  code: string
  title: string
}

export interface LinkedControlDetail {
  id: number
  control_item: ControlItemBrief
  link_type: LinkType
  effectiveness_rating: number | null
  created_at: string
  remarks: string | null
}

export interface ControlEffectivenessAnalysis {
  control_item_id: number
  linked_treatment_count: number
  average_effectiveness: number
  implementation_rate: number
  residual_risk_summary: Record<string, unknown>
}

export interface RiskControlCoverageAnalysis {
  total_risks: number
  controlled_risks: number
  coverage_percentage: number
}

export interface RiskControlMatrixResponse {
  matrix: Array<Record<string, unknown>>
  coverage_analysis: RiskControlCoverageAnalysis
  uncontrolled_risks: Array<Record<string, unknown>>
  control_summary: Record<string, unknown>
}

export interface ResidualRiskTrendResponse {
  treatment_plan_id: number
  initial_risk_score: number
  current_residual_score: number
  trend_data: Array<Record<string, unknown>>
  reduction_percentage: number
}

// =============================================================================
// 상수 정의
// =============================================================================

export const THREAT_LEVELS = [
  { value: 1, label: '하', color: '#52c41a' },
  { value: 2, label: '중', color: '#faad14' },
  { value: 3, label: '상', color: '#ff4d4f' },
] as const

export const VULNERABILITY_LEVELS = [
  { value: 1, label: '하', color: '#52c41a' },
  { value: 2, label: '중', color: '#faad14' },
  { value: 3, label: '상', color: '#ff4d4f' },
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
    if (assessment.risk_level === 'high') {
      distribution.high++
    } else if (assessment.risk_level === 'medium') {
      distribution.medium++
    } else if (assessment.risk_level === 'low') {
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
