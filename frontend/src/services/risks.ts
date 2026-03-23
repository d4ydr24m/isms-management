/**
 * 위험 관리 API 서비스
 * Phase 2: FR-601 ~ FR-607
 *
 * TDD Step 2: GREEN - API 서비스 구현
 */

import { apiClient, handleApiError } from './api'
import type {
  // 위협 관련
  Threat,
  ThreatList,
  ThreatCreate,
  ThreatUpdate,

  // 취약점 관련
  Vulnerability,
  VulnerabilityList,
  VulnerabilityCreate,
  VulnerabilityUpdate,
  VulnerabilityAssessment,
  VulnerabilityAssessmentCreate,
  VulnerabilityAssessmentList,

  // 위험 시나리오 관련
  RiskScenario,
  RiskScenarioList,
  RiskScenarioCreate,
  RiskScenarioUpdate,

  // 위험 평가 관련
  RiskAssessment,
  RiskAssessmentList,
  RiskAssessmentCreate,
  RiskAssessmentUpdate,
  RiskAssessmentBulkCreate,

  // DoA 관련
  DoAConfig,
  DoAConfigCreate,
  DoAHistory,

  // 위험 처리 계획 관련
  RiskTreatmentPlan,
  RiskTreatmentPlanList,
  RiskTreatmentPlanCreate,
  RiskTreatmentPlanUpdate,
  RiskTreatmentAction,
  RiskTreatmentActionCreate,
  RiskTreatmentProgress,

  // SOA 관련
  SOARecord,
  SOARecordUpdate,
  SOARecordList,
  SOAExportRequest,

  // 보고서 관련
  RiskDistribution,
  RiskMatrixData,
  ScenarioComparison,
  RiskReportSummary,
  ExecutiveSummary,

  // 위험-통제 연계
  RiskTreatmentControlLinkCreate,
  LinkedControlDetail,
  ControlEffectivenessAnalysis,
  RiskControlMatrixResponse,
  ResidualRiskTrendResponse,
} from '@/types/risk'

interface ListParams {
  page?: number
  size?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: unknown
}

// =============================================================================
// 위협 DB API (FR-601)
// =============================================================================

/**
 * 위협 목록 조회
 */
export async function getThreats(params?: ListParams): Promise<ThreatList> {
  try {
    const response = await apiClient.get<ThreatList>('/threats', { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위협 상세 조회
 */
export async function getThreat(id: number): Promise<Threat> {
  try {
    const response = await apiClient.get<Threat>(`/threats/${id}`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 커스텀 위협 생성
 */
export async function createThreat(data: ThreatCreate): Promise<Threat> {
  try {
    const response = await apiClient.post<Threat>('/threats', data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위협 수정
 */
export async function updateThreat(id: number, data: ThreatUpdate): Promise<Threat> {
  try {
    const response = await apiClient.put<Threat>(`/threats/${id}`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 커스텀 위협 삭제
 */
export async function deleteThreat(id: number): Promise<void> {
  try {
    await apiClient.delete(`/threats/${id}`)
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 자산 유형별 위협 조회
 */
export async function getThreatsByAssetType(typeId: number): Promise<ThreatList> {
  try {
    const response = await apiClient.get<ThreatList>(`/threats/by-asset-type/${typeId}`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 취약점 DB API (FR-602)
// =============================================================================

/**
 * 취약점 목록 조회
 */
export async function getVulnerabilities(params?: ListParams): Promise<VulnerabilityList> {
  try {
    const response = await apiClient.get<VulnerabilityList>('/vulnerabilities', { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 취약점 상세 조회
 */
export async function getVulnerability(id: number): Promise<Vulnerability> {
  try {
    const response = await apiClient.get<Vulnerability>(`/vulnerabilities/${id}`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 커스텀 취약점 생성
 */
export async function createVulnerability(data: VulnerabilityCreate): Promise<Vulnerability> {
  try {
    const response = await apiClient.post<Vulnerability>('/vulnerabilities', data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 취약점 수정
 */
export async function updateVulnerability(id: number, data: VulnerabilityUpdate): Promise<Vulnerability> {
  try {
    const response = await apiClient.put<Vulnerability>(`/vulnerabilities/${id}`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 커스텀 취약점 삭제
 */
export async function deleteVulnerability(id: number): Promise<void> {
  try {
    await apiClient.delete(`/vulnerabilities/${id}`)
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 취약점 점검 결과 등록
 */
export async function createVulnerabilityAssessment(data: VulnerabilityAssessmentCreate): Promise<VulnerabilityAssessment> {
  try {
    const response = await apiClient.post<VulnerabilityAssessment>('/vulnerabilities/assessments', data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 취약점 점검 결과 조회
 */
export async function getVulnerabilityAssessments(params?: ListParams): Promise<VulnerabilityAssessmentList> {
  try {
    const response = await apiClient.get<VulnerabilityAssessmentList>('/vulnerabilities/assessments', { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 위험 시나리오 API (FR-603)
// =============================================================================

/**
 * 위험 시나리오 목록 조회
 */
export async function getRiskScenarios(params?: ListParams): Promise<RiskScenarioList> {
  try {
    const response = await apiClient.get<RiskScenarioList>('/risks/scenarios', { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 시나리오 상세 조회
 */
export async function getRiskScenario(id: number): Promise<RiskScenario> {
  try {
    const response = await apiClient.get<RiskScenario>(`/risks/scenarios/${id}`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 시나리오 생성
 */
export async function createRiskScenario(data: RiskScenarioCreate): Promise<RiskScenario> {
  try {
    const response = await apiClient.post<RiskScenario>('/risks/scenarios', data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 시나리오 수정
 */
export async function updateRiskScenario(id: number, data: RiskScenarioUpdate): Promise<RiskScenario> {
  try {
    const response = await apiClient.put<RiskScenario>(`/risks/scenarios/${id}`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 시나리오 삭제
 */
export async function deleteRiskScenario(id: number): Promise<void> {
  try {
    await apiClient.delete(`/risks/scenarios/${id}`)
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 시나리오 비교
 */
export async function compareRiskScenarios(scenario1Id: number, scenario2Id: number): Promise<ScenarioComparison> {
  try {
    const response = await apiClient.get<ScenarioComparison>('/risks/scenarios/compare', {
      params: { scenario1Id, scenario2Id },
    })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 위험 평가 API (FR-603)
// =============================================================================

/**
 * 위험 평가 목록 조회 (시나리오별)
 */
export async function getRiskAssessments(scenarioId: number, params?: ListParams): Promise<RiskAssessmentList> {
  try {
    const response = await apiClient.get<RiskAssessmentList>(`/risks/scenarios/${scenarioId}/assessments`, { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 평가 상세 조회
 */
export async function getRiskAssessment(id: number): Promise<RiskAssessment> {
  try {
    const response = await apiClient.get<RiskAssessment>(`/risks/assessments/${id}`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 평가 생성
 */
export async function createRiskAssessment(scenarioId: number, data: RiskAssessmentCreate): Promise<RiskAssessment> {
  try {
    const response = await apiClient.post<RiskAssessment>(`/risks/scenarios/${scenarioId}/assessments`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 평가 대량 생성
 */
export async function bulkCreateRiskAssessments(scenarioId: number, data: RiskAssessmentBulkCreate): Promise<{ count: number }> {
  try {
    const response = await apiClient.post<{ count: number }>(`/risks/scenarios/${scenarioId}/assessments/bulk`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 평가 수정
 */
export async function updateRiskAssessment(id: number, data: RiskAssessmentUpdate): Promise<RiskAssessment> {
  try {
    const response = await apiClient.put<RiskAssessment>(`/risks/assessments/${id}`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 평가 삭제
 */
export async function deleteRiskAssessment(id: number): Promise<void> {
  try {
    await apiClient.delete(`/risks/assessments/${id}`)
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 시나리오 전체 위험도 재계산
 */
export async function calculateRiskScenario(scenarioId: number): Promise<{ message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>(`/risks/scenarios/${scenarioId}/calculate`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// DoA 관리 API (FR-604)
// =============================================================================

/**
 * 현재 DoA 설정 조회
 */
export async function getCurrentDoA(): Promise<DoAConfig> {
  try {
    const response = await apiClient.get<DoAConfig>('/risks/doa')
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * DoA 설정 변경
 */
export async function createDoAConfig(data: DoAConfigCreate): Promise<DoAConfig> {
  try {
    const response = await apiClient.post<DoAConfig>('/risks/doa', data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * DoA 변경 이력 조회
 */
export async function getDoAHistory(): Promise<DoAHistory[]> {
  try {
    const response = await apiClient.get<DoAHistory[]>('/risks/doa/history')
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * DoA 초과 위험 목록 조회
 */
export async function getRisksExceedingDoA(params?: ListParams): Promise<RiskAssessmentList> {
  try {
    const response = await apiClient.get<RiskAssessmentList>('/risks/exceeding-doa', { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 위험 처리 계획 API (FR-605)
// =============================================================================

/**
 * 위험 처리 계획 목록 조회
 */
export async function getRiskTreatmentPlans(params?: ListParams): Promise<RiskTreatmentPlanList> {
  try {
    const response = await apiClient.get<RiskTreatmentPlanList>('/risks/treatments', { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 처리 계획 상세 조회
 */
export async function getRiskTreatmentPlan(id: number): Promise<RiskTreatmentPlan> {
  try {
    const response = await apiClient.get<RiskTreatmentPlan>(`/risks/treatments/${id}`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 처리 계획 생성
 */
export async function createRiskTreatmentPlan(assessmentId: number, data: RiskTreatmentPlanCreate): Promise<RiskTreatmentPlan> {
  try {
    const response = await apiClient.post<RiskTreatmentPlan>(`/risks/assessments/${assessmentId}/treatments`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 처리 계획 수정
 */
export async function updateRiskTreatmentPlan(id: number, data: RiskTreatmentPlanUpdate): Promise<RiskTreatmentPlan> {
  try {
    const response = await apiClient.put<RiskTreatmentPlan>(`/risks/treatments/${id}`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 처리 조치 등록
 */
export async function createRiskTreatmentAction(planId: number, data: RiskTreatmentActionCreate): Promise<RiskTreatmentAction> {
  try {
    const response = await apiClient.post<RiskTreatmentAction>(`/risks/treatments/${planId}/actions`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 처리 진행률 조회
 */
export async function getRiskTreatmentProgress(): Promise<RiskTreatmentProgress> {
  try {
    const response = await apiClient.get<RiskTreatmentProgress>('/risks/treatments/progress')
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// SOA API (FR-606)
// =============================================================================

/**
 * SOA 레코드 목록 조회
 */
export async function getSOARecords(params?: ListParams): Promise<SOARecordList> {
  try {
    const response = await apiClient.get<SOARecordList>('/soa', { params })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * SOA 레코드 수정
 */
export async function updateSOARecord(controlId: number, data: SOARecordUpdate): Promise<SOARecord> {
  try {
    const response = await apiClient.put<SOARecord>(`/soa/${controlId}`, data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * SOA 자동 생성
 */
export async function generateSOA(): Promise<{ message: string; count: number }> {
  try {
    const response = await apiClient.post<{ message: string; count: number }>('/soa/generate')
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * SOA 내보내기
 */
export async function exportSOA(request: SOAExportRequest): Promise<{ downloadUrl: string }> {
  try {
    const response = await apiClient.get<{ downloadUrl: string }>('/soa/export', { params: request })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 위험 평가 보고서 API (FR-607)
// =============================================================================

/**
 * 위험 평가 보고서 조회
 */
export async function getRiskReport(scenarioId: number): Promise<RiskReportSummary> {
  try {
    const response = await apiClient.get<RiskReportSummary>(`/risks/scenarios/${scenarioId}/report`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 경영진 요약 조회
 */
export async function getExecutiveSummary(scenarioId: number): Promise<ExecutiveSummary> {
  try {
    const response = await apiClient.get<ExecutiveSummary>(`/risks/scenarios/${scenarioId}/executive-summary`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 매트릭스 데이터 조회
 */
export async function getRiskMatrixData(scenarioId: number): Promise<RiskMatrixData> {
  try {
    const response = await apiClient.get<RiskMatrixData>(`/risks/scenarios/${scenarioId}/matrix`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 분포 데이터 조회
 */
export async function getRiskDistribution(scenarioId: number): Promise<RiskDistribution> {
  try {
    const response = await apiClient.get<RiskDistribution>(`/risks/scenarios/${scenarioId}/risk-distribution`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험 평가 보고서 내보내기
 */
export async function exportRiskReport(scenarioId: number, format: 'excel' | 'word'): Promise<{ downloadUrl: string }> {
  try {
    const response = await apiClient.get<{ downloadUrl: string }>(`/risks/scenarios/${scenarioId}/report/export`, {
      params: { format },
    })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 위험-통제 연계 API (5.4)
// =============================================================================

/**
 * 위험 처리 계획과 통제항목 연결
 */
export async function linkControlsToTreatmentPlan(data: RiskTreatmentControlLinkCreate): Promise<{ count: number }> {
  try {
    const response = await apiClient.post<{ count: number }>('/risk-control-linkage/link', data)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 처리 계획에 연결된 통제항목 조회
 */
export async function getLinkedControls(treatmentPlanId: number): Promise<LinkedControlDetail[]> {
  try {
    const response = await apiClient.get<LinkedControlDetail[]>(`/risk-control-linkage/treatment/${treatmentPlanId}/controls`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 통제 효과성 분석
 */
export async function getControlEffectivenessAnalysis(controlItemId: number): Promise<ControlEffectivenessAnalysis> {
  try {
    const response = await apiClient.get<ControlEffectivenessAnalysis>(`/risk-control-linkage/control/${controlItemId}/effectiveness`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 위험-통제 매트릭스 조회
 */
export async function getRiskControlMatrix(scenarioId: number): Promise<RiskControlMatrixResponse> {
  try {
    const response = await apiClient.get<RiskControlMatrixResponse>('/risk-control-linkage/matrix', {
      params: { scenarioId },
    })
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

/**
 * 잔여 위험 추이 조회
 */
export async function getResidualRiskTrend(treatmentPlanId: number): Promise<ResidualRiskTrendResponse> {
  try {
    const response = await apiClient.get<ResidualRiskTrendResponse>(`/risk-control-linkage/treatment/${treatmentPlanId}/residual-trend`)
    return response.data
  } catch (error) {
    throw handleApiError(error)
  }
}

// =============================================================================
// 기본 exports
// =============================================================================

export default {
  // 위협
  getThreats,
  getThreat,
  createThreat,
  updateThreat,
  deleteThreat,
  getThreatsByAssetType,

  // 취약점
  getVulnerabilities,
  getVulnerability,
  createVulnerability,
  updateVulnerability,
  deleteVulnerability,
  createVulnerabilityAssessment,
  getVulnerabilityAssessments,

  // 위험 시나리오
  getRiskScenarios,
  getRiskScenario,
  createRiskScenario,
  updateRiskScenario,
  deleteRiskScenario,
  compareRiskScenarios,

  // 위험 평가
  getRiskAssessments,
  getRiskAssessment,
  createRiskAssessment,
  bulkCreateRiskAssessments,
  updateRiskAssessment,
  deleteRiskAssessment,
  calculateRiskScenario,

  // DoA
  getCurrentDoA,
  createDoAConfig,
  getDoAHistory,
  getRisksExceedingDoA,

  // 위험 처리
  getRiskTreatmentPlans,
  getRiskTreatmentPlan,
  createRiskTreatmentPlan,
  updateRiskTreatmentPlan,
  createRiskTreatmentAction,
  getRiskTreatmentProgress,

  // SOA
  getSOARecords,
  updateSOARecord,
  generateSOA,
  exportSOA,

  // 보고서
  getRiskReport,
  getExecutiveSummary,
  getRiskMatrixData,
  getRiskDistribution,
  exportRiskReport,

  // 위험-통제 연계
  linkControlsToTreatmentPlan,
  getLinkedControls,
  getControlEffectivenessAnalysis,
  getRiskControlMatrix,
  getResidualRiskTrend,
}
