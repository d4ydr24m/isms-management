// 통제항목 관련 타입

export interface ControlItemSimple {
  id: number
  code: string
  title: string
  isRequired: boolean
}

export interface ControlCategoryInDomain {
  id: number
  domainId: number
  code: string
  name: string
  description: string | null
  sortOrder: number
  controlItems: ControlItemSimple[]
}

export interface ControlDomain {
  id: number
  code: string
  name: string
  description: string | null
  sortOrder: number
  categories: ControlCategoryInDomain[]
}

export interface ControlCategory {
  id: number
  domainId: number
  name: string
  code: string
  description: string | null
  sortOrder: number
}

export interface ControlItem {
  id: number
  categoryId: number
  code: string
  title: string
  description: string
  objective: string | null
  requirements: string | null
  isRequired: boolean
  isPersonalInfo: boolean
  sortOrder: number
  tags: string | null
  evidenceCount: number
}

export interface ControlItemDetail extends ControlItem {
  evidences?: EvidenceSummary[]
}

export interface EvidenceSummary {
  id: number
  title: string
  status: EvidenceStatus
  version: string
  validUntil: string | null
  uploaderName: string
  createdAt: string
}

export type EvidenceStatus = 'draft' | 'active' | 'expired' | 'archived'

// 통제항목 진척률
export interface ControlProgress {
  totalControls: number
  controlsWithEvidence: number
  coverageRate: number
  byDomain: DomainProgress[]
}

export interface DomainProgress {
  domainId: number
  domainName: string
  total: number
  withEvidence: number
  coverageRate: number
}
