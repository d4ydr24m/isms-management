// 감사 관련 타입
export type AuditStatus = 'planning' | 'in_progress' | 'completed' | 'cancelled'
export type ChecklistResultType = 'conformity' | 'non_conformity' | 'observation' | 'not_applicable'
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
  controlDomains: string | null
  leadAuditorId: number
  leadAuditorName: string | null
  teamMembers: string | null
  checklistCount: number
  completedChecklistCount: number
  nonConformityCount: number
  overallResult: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditPlanCreate {
  title: string
  description: string
  auditType: string
  startDate: string
  endDate: string
  scope: string
  auditorIds: number[]
  controlItemIds: number[]
}

export interface AuditPlanUpdate {
  title?: string
  description?: string
  auditType?: string
  status?: AuditStatus
  startDate?: string
  endDate?: string
  scope?: string
}

export interface AuditChecklistResult {
  id: number
  checklistId: number
  result: string
  finding: string | null
  evidenceReference: string | null
  auditorId: number
  auditorName: string | null
  checkedAt: string
}

export interface AuditChecklist {
  id: number
  auditPlanId: number
  controlItemId: number
  controlItemCode: string | null
  controlItemTitle: string | null
  question: string
  sortOrder: number
  latestResult: AuditChecklistResult | null
  createdAt: string
}

export interface ChecklistResultCreate {
  result: ChecklistResultType
  finding?: string
  evidenceReference?: string
}

export interface NonConformity {
  id: number
  auditPlanId: number
  auditPlanTitle: string | null
  controlItemId: number
  controlItemCode: string | null
  controlItemTitle: string | null
  ncType: string
  severity: string
  title: string
  description: string
  requirement: string
  responsiblePersonIds: number[]
  responsiblePersonNames: string[]
  responsiblePersonName: string | null
  departmentId: number | null
  departmentName: string | null
  status: string
  detectedAt: string
  dueDate: string
  closedAt: string | null
  correctiveActionCount: number
  createdAt: string
  updatedAt: string | null
}

export interface NonConformityCreate {
  auditPlanId: number
  controlItemId: number
  ncType: NonConformityType
  severity: string
  title: string
  description: string
  requirement: string
  responsiblePersonIds: number[]
  dueDate: string
  detectedAt?: string
}

export interface NonConformityUpdate {
  title?: string
  controlItemId?: number
  ncType?: string
  severity?: string
  description?: string
  requirement?: string
  responsiblePersonIds?: number[]
  departmentId?: number
  status?: string
  dueDate?: string
}

export interface CorrectiveAction {
  id: number
  nonConformityId: number
  actionPlan: string
  rootCause: string | null
  preventiveMeasures: string | null
  responsiblePersonIds: number[]
  responsiblePersonNames: string[]
  responsiblePersonName: string | null
  plannedCompletionDate: string
  actualCompletionDate: string | null
  resultDescription: string | null
  resultEvidenceId: number | null
  verifiedBy: number | null
  verifierName: string | null
  verifiedAt: string | null
  verificationResult: string | null
  verificationComment: string | null
  status: CorrectiveActionStatus
  createdAt: string
  updatedAt: string | null
}

export interface CorrectiveActionCreate {
  actionPlan: string
  rootCause?: string
  preventiveMeasures?: string
  responsiblePersonIds: number[]
  plannedCompletionDate: string
}

export interface CorrectiveActionUpdate {
  actionPlan?: string
  rootCause?: string
  preventiveMeasures?: string
  responsiblePersonIds?: number[]
  plannedCompletionDate?: string
  actualCompletionDate?: string
  resultDescription?: string
  status?: CorrectiveActionStatus
}

export interface CorrectiveActionVerify {
  verificationResult: string
  verificationComment?: string
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

// 부적합 - 증적 매핑
export type NcEvidenceRole = 'before' | 'after' | 'support' | 'reference'

export interface NcEvidenceItem {
  mappingId: number
  evidenceId: number
  title: string
  fileName: string
  fileSize: number
  mimeType: string | null
  mappingNote: string | null
  role: NcEvidenceRole
  mappedBy: number | null
  mappedAt: string
  uploaderName: string | null
}

export interface NcEvidenceList {
  items: NcEvidenceItem[]
  total: number
}

export interface NcEvidenceAttachRequest {
  evidenceIds: number[]
  mappingNote?: string | null
  role?: NcEvidenceRole
}

export interface NcEvidenceNoteUpdate {
  mappingNote: string | null
}

export interface NcEvidenceRoleUpdate {
  role: NcEvidenceRole
}

// 결함 증적 관리 페이지 (감사 관리 > 결함 증적 관리) 전용
export interface NcEvidenceRow extends NcEvidenceItem {
  nonConformityId: number
  nonConformityTitle: string | null
}

export interface NcEvidenceListPage {
  items: NcEvidenceRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface NcEvidenceListParams {
  page?: number
  pageSize?: number
  nonConformityId?: number
  search?: string
}
