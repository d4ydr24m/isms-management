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

// 증적출처 연결
export interface ControlEvidenceLink {
  id: number
  controlItemId: number
  sourceType: string
  sourceId: number | null
  sourceLabel: string
  sourceUrl: string
  description: string | null
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface ControlEvidenceLinkCreate {
  controlItemId: number
  sourceType: string
  sourceId?: number | null
  sourceLabel: string
  sourceUrl: string
  description?: string
}

export interface ControlEvidenceLinkUpdate {
  sourceLabel?: string
  description?: string
}

export interface EvidenceLinkSource {
  type: string
  label: string
  url: string
  icon: string
}

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
