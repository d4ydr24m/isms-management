// 통제항목 관련 타입
export interface ControlDomain {
  id: number
  name: string
  code: string
  description: string
  order: number
}

export interface ControlCategory {
  id: number
  domainId: number
  name: string
  code: string
  description: string
  order: number
}

export interface ControlItem {
  id: number
  categoryId: number
  category?: ControlCategory
  number: string
  title: string
  description: string
  isRequired: boolean
  evidenceCount: number
  hasEvidence: boolean
  createdAt: string
}

export interface ControlItemDetail extends ControlItem {
  evidences: EvidenceSummary[]
  relatedItems: ControlItem[]
}

export interface EvidenceSummary {
  id: number
  title: string
  status: EvidenceStatus
  version: number
  validUntil: string | null
  uploaderName: string
  createdAt: string
}

export type EvidenceStatus = 'draft' | 'active' | 'expired' | 'archived'

// 통제항목 진척률
export interface ControlProgress {
  totalControls: number
  controlsWithEvidence: number
  progressPercentage: number
  requiredControls: number
  requiredCompleted: number
  requiredProgressPercentage: number
  byDomain: DomainProgress[]
}

export interface DomainProgress {
  domainId: number
  domainName: string
  totalControls: number
  controlsWithEvidence: number
  progressPercentage: number
}
