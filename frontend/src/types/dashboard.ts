import { EvidenceStatus } from './control'
import { CorrectiveActionStatus, NonConformityType } from './audit'

// 대시보드 관련 타입
export interface DashboardSummary {
  evidenceProgress: EvidenceProgress
  upcomingActivities: UpcomingActivity[]
  expiringEvidences: ExpiringEvidence[]
  pendingTasks: PendingTask[]
  nonConformitySummary: NonConformitySummary
}

export interface EvidenceProgress {
  total: number
  active: number
  draft: number
  expired: number
  progressPercentage: number
  requiredTotal: number
  requiredActive: number
  requiredProgressPercentage: number
}

export interface UpcomingActivity {
  id: number
  title: string
  type: 'scheduled_task' | 'audit' | 'corrective_action'
  dueDate: string
  assignee: string | null
  status: string
  priority: 'high' | 'medium' | 'low'
}

export interface ExpiringEvidence {
  id: number
  title: string
  fileName: string
  validUntil: string
  daysUntilExpiry: number
  controlItems: string[]
}

export interface PendingTask {
  id: number
  title: string
  type: 'scheduled_task' | 'corrective_action' | 'evidence_upload'
  dueDate: string | null
  assignee: string | null
  priority: 'high' | 'medium' | 'low'
}

export interface NonConformitySummary {
  total: number
  byType: {
    critical: number
    major: number
    minor: number
    observation: number
  }
  byStatus: {
    pending: number
    inProgress: number
    completed: number
    verified: number
  }
  overdueCount: number
}
