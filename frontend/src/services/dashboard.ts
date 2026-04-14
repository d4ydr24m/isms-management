import { apiClient, handleApiError } from './api'

// Dashboard types (camelCase — auto-converted from backend snake_case)
export interface DomainProgress {
  domainId: number
  domainCode: string
  domainName: string
  totalControls: number
  controlsWithEvidence: number
  progressRate: number
}

export interface ProgressData {
  totalProgress: number
  totalControls: number
  controlsWithEvidence: number
  domainProgress: DomainProgress[]
}

export interface ActivityItem {
  id: number
  title: string
  description: string | null
  taskType: string
  frequency: string
  nextExecutionAt: string
  assigneeName: string | null
  controlItemCode: string | null
}

export interface ActivitiesData {
  today: ActivityItem[]
  thisWeek: ActivityItem[]
}

export interface ExpiringEvidenceItem {
  id: number
  title: string
  fileName: string
  validUntil: string
  daysRemaining: number
  status: string
  controlItemCodes: string[]
}

export interface ExpiringEvidencesData {
  evidences: ExpiringEvidenceItem[]
  count: number
}

export interface ExpiredEvidenceItem {
  id: number
  title: string
  fileName: string
  validUntil: string
  daysOverdue: number
  status: string
  controlItemCodes: string[]
}

export interface ExpiredEvidencesData {
  evidences: ExpiredEvidenceItem[]
  count: number
}

export interface ExpiringAssetItem {
  id: number
  assetCode: string
  name: string
  assetTypeName: string | null
  warrantyEndDate: string
  daysRemaining: number
  status: string
  location: string | null
}

export interface ExpiringAssetsData {
  assets: ExpiringAssetItem[]
  count: number
}

export interface EolAssetItem {
  id: number
  assetCode: string
  name: string
  assetTypeName: string | null
  osVersion: string | null
  serviceVersion: string | null
  eolDate: string
  daysRemaining: number
  status: string
  location: string | null
}

export interface EolAssetsData {
  assets: EolAssetItem[]
  count: number
}

export interface PendingTaskData {
  uncompletedCorrectiveActions: number
  controlsWithoutEvidence: number
  overdueTasks: number
  upcomingDeadlines: number
}

export interface NonConformitySummaryData {
  total: number
  byStatus: Record<string, number>
  bySeverity: Record<string, number>
  byType: Record<string, number>
}

export interface DashboardSummaryData {
  progress: ProgressData
  activities: ActivitiesData
  expiringEvidences: ExpiringEvidencesData
  expiredEvidences: ExpiredEvidencesData
  expiringAssets: ExpiringAssetsData
  eolAssets: EolAssetsData
  pendingTasks: PendingTaskData
  nonConformities: NonConformitySummaryData
  generatedAt: string
}

export const dashboardService = {
  async getSummary(): Promise<DashboardSummaryData> {
    try {
      const response = await apiClient.get<DashboardSummaryData>('/dashboard/summary')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getProgress(): Promise<ProgressData> {
    try {
      const response = await apiClient.get<ProgressData>('/dashboard/progress')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getActivities(): Promise<ActivitiesData> {
    try {
      const response = await apiClient.get<ActivitiesData>('/dashboard/activities')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getExpiringEvidences(days?: number): Promise<ExpiringEvidencesData> {
    try {
      const response = await apiClient.get<ExpiringEvidencesData>('/dashboard/expiring-evidences', {
        params: { days },
      })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getEolAssets(days?: number): Promise<EolAssetsData> {
    try {
      const response = await apiClient.get<EolAssetsData>('/dashboard/eol-assets', {
        params: { days },
      })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getExpiringAssets(days?: number): Promise<ExpiringAssetsData> {
    try {
      const response = await apiClient.get<ExpiringAssetsData>('/dashboard/expiring-assets', {
        params: { days },
      })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getPendingTasks(): Promise<PendingTaskData> {
    try {
      const response = await apiClient.get<PendingTaskData>('/dashboard/pending-tasks')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getNonConformitySummary(): Promise<NonConformitySummaryData> {
    try {
      const response = await apiClient.get<NonConformitySummaryData>('/dashboard/nonconformities')
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },
}
