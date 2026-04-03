/**
 * 취약점 점검 스크립트 TypeScript 타입 정의
 * Backend schemas/vuln_check.py와 매핑
 */

// =============================================================================
// 스크립트 타입
// =============================================================================

export type ScriptType = 'python' | 'shell' | 'powershell' | 'custom'

export interface VulnCheckScript {
  id: number
  name: string
  description: string | null
  scriptType: ScriptType
  fileName: string
  fileSize: number | null
  version: string
  categoryId: number | null
  categoryName: string | null
  targetAssetTypeId: number | null
  targetAssetTypeName: string | null
  isActive: boolean
  uploadedBy: number
  uploaderName: string | null
  scheduleCount: number
  executionCount: number
  createdAt: string
  updatedAt: string | null
}

export interface VulnCheckScriptCreate {
  name: string
  description?: string | null
  scriptType: ScriptType
  version?: string
  categoryId?: number | null
  targetAssetTypeId?: number | null
}

export interface VulnCheckScriptUpdate {
  name?: string
  description?: string | null
  scriptType?: ScriptType
  version?: string
  categoryId?: number | null
  targetAssetTypeId?: number | null
  isActive?: boolean
}

export interface VulnCheckScriptList {
  items: VulnCheckScript[]
  total: number
}

// =============================================================================
// 스케줄 타입
// =============================================================================

export interface VulnCheckSchedule {
  id: number
  scriptId: number
  scriptName: string | null
  name: string
  description: string | null
  cronExpression: string
  targetAssetIds: number[] | null
  isActive: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdBy: number
  creatorName: string | null
  createdAt: string
  updatedAt: string | null
}

export interface VulnCheckScheduleCreate {
  scriptId: number
  name: string
  description?: string | null
  cronExpression: string
  targetAssetIds?: number[] | null
}

export interface VulnCheckScheduleUpdate {
  name?: string
  description?: string | null
  cronExpression?: string
  targetAssetIds?: number[] | null
  isActive?: boolean
}

export interface VulnCheckScheduleList {
  items: VulnCheckSchedule[]
  total: number
}

// =============================================================================
// 실행 결과 타입
// =============================================================================

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface VulnCheckExecution {
  id: number
  scriptId: number
  scriptName: string | null
  scheduleId: number | null
  scheduleName: string | null
  assetId: number
  assetName: string | null
  assetCode: string | null
  status: ExecutionStatus
  startedAt: string | null
  completedAt: string | null
  resultSummary: string | null
  resultDetail: string | null
  vulnerabilitiesFound: number
  severityHigh: number
  severityMedium: number
  severityLow: number
  executedBy: number | null
  executorName: string | null
  errorMessage: string | null
  createdAt: string
}

export interface VulnCheckExecutionCreate {
  scriptId: number
  assetIds: number[]
}

export interface VulnCheckExecutionList {
  items: VulnCheckExecution[]
  total: number
  page: number
  size: number
  pages: number
}

// =============================================================================
// 통계 타입
// =============================================================================

export interface VulnCheckStats {
  totalScripts: number
  activeScripts: number
  totalSchedules: number
  activeSchedules: number
  totalExecutions: number
  recentExecutions: number
  totalVulnerabilitiesFound: number
  severityDistribution: {
    high: number
    medium: number
    low: number
  }
}
