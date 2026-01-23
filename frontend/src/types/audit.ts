// 감사 관련 타입
export type AuditStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type ChecklistResultType = 'conforming' | 'non_conforming' | 'observation' | 'not_applicable'
export type NonConformityType = 'critical' | 'major' | 'minor' | 'observation'
export type CorrectiveActionStatus = 'pending' | 'in_progress' | 'completed' | 'verified' | 'rejected'

export interface AuditPlan {
  id: number
  title: string
  description: string
  auditType: string
  status: AuditStatus
  startDate: string
  endDate: string
  scope: string
  auditorIds: number[]
  auditors: AuditorInfo[]
  checklistCount: number
  nonConformityCount: number
  createdBy: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface AuditorInfo {
  id: number
  name: string
  email: string
  department: string | null
}

export interface AuditPlanCreate {
  title: string
  description: string
  auditType: string
  startDate: string
  endDate: string
  scope: string
  auditorIds: number[]
}

export interface AuditPlanUpdate {
  title?: string
  description?: string
  status?: AuditStatus
  startDate?: string
  endDate?: string
  scope?: string
  auditorIds?: number[]
}

export interface AuditChecklist {
  id: number
  auditId: number
  controlItemId: number
  controlItem: {
    number: string
    title: string
    description: string
  }
  order: number
  result: ChecklistResultType | null
  findings: string | null
  evidenceIds: number[]
  evidences: ChecklistEvidence[]
  auditorId: number | null
  auditorName: string | null
  checkedAt: string | null
  createdAt: string
}

export interface ChecklistEvidence {
  id: number
  title: string
  fileName: string
  version: number
}

export interface ChecklistResultCreate {
  result: ChecklistResultType
  findings?: string
  evidenceIds?: number[]
}

export interface NonConformity {
  id: number
  auditId: number
  auditTitle: string
  controlItemId: number
  controlItem: {
    number: string
    title: string
  }
  type: NonConformityType
  title: string
  description: string
  evidence: string
  rootCause: string | null
  assigneeId: number | null
  assigneeName: string | null
  status: CorrectiveActionStatus
  dueDate: string | null
  createdBy: number
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface NonConformityCreate {
  auditId: number
  controlItemId: number
  type: NonConformityType
  title: string
  description: string
  evidence: string
  assigneeId?: number
  dueDate?: string
}

export interface NonConformityUpdate {
  type?: NonConformityType
  title?: string
  description?: string
  evidence?: string
  rootCause?: string
  assigneeId?: number
  dueDate?: string
  status?: CorrectiveActionStatus
}

export interface CorrectiveAction {
  id: number
  nonConformityId: number
  action: string
  implementationPlan: string
  responsibleId: number
  responsibleName: string
  dueDate: string
  status: CorrectiveActionStatus
  completedAt: string | null
  result: string | null
  verifiedBy: number | null
  verifiedByName: string | null
  verifiedAt: string | null
  verificationNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface CorrectiveActionCreate {
  action: string
  implementationPlan: string
  responsibleId: number
  dueDate: string
}

export interface CorrectiveActionUpdate {
  action?: string
  implementationPlan?: string
  responsibleId?: number
  dueDate?: string
  status?: CorrectiveActionStatus
  result?: string
}

export interface CorrectiveActionVerify {
  verificationNotes: string
  approved: boolean
}

// 심사원 계정
export interface AuditorAccount {
  id: number
  username: string
  email: string
  name: string
  organization: string
  validFrom: string
  validUntil: string
  scope: string[]
  canDownload: boolean
  isActive: boolean
  createdBy: number
  createdByName: string
  createdAt: string
}

export interface AuditorAccountCreate {
  email: string
  name: string
  organization: string
  validFrom: string
  validUntil: string
  scope: string[]
  canDownload: boolean
}

export interface AuditorAccountUpdate {
  name?: string
  validFrom?: string
  validUntil?: string
  scope?: string[]
  canDownload?: boolean
  isActive?: boolean
}
