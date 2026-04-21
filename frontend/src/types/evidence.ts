import { EvidenceStatus } from './control'

// 증적 관련 타입
export interface Evidence {
  id: number
  title: string
  description: string
  filePath: string
  fileName: string
  fileSize: number
  fileHash: string
  mimeType: string
  version: number
  status: EvidenceStatus
  validFrom: string | null
  validUntil: string | null
  uploaderId: number
  uploaderName: string
  controlItems: ControlItemMapping[]
  source: 'library' | 'nc_finding'
  createdAt: string
  updatedAt: string
}

export interface ControlItemMapping {
  id: number
  code: string
  title: string
}

export interface EvidenceCreate {
  title: string
  description: string
  validFrom?: string
  validUntil?: string
  controlIds: number[]
  file: File
}

export interface EvidenceUpdate {
  title?: string
  description?: string
  status?: EvidenceStatus
  validFrom?: string
  validUntil?: string
  controlItemIds?: number[]
}

export interface EvidenceVersion {
  id: number
  evidenceId: number
  version: number
  filePath: string
  fileName: string
  fileSize: number
  fileHash: string
  uploaderId: number
  uploaderName: string
  changes: string
  createdAt: string
}

export interface EvidenceTemplate {
  id: number
  name: string
  description: string
  category: string
  filePath: string
  fileName: string
  fileSize: number
  isActive: boolean
  createdAt: string
}

export interface EvidenceListItem {
  id: number
  title: string
  fileName: string
  status: EvidenceStatus
  version: number
  validUntil: string | null
  uploaderName: string
  controlItemCount: number
  createdAt: string
}

// 증적 필터 파라미터
export interface EvidenceFilterParams {
  search?: string
  status?: EvidenceStatus
  controlItemId?: number
  uploaderId?: number
  validFrom?: string
  validUntil?: string
  expiringWithinDays?: number
  // 증적 출처 필터. 기본은 'library' (일반 증적 관리 페이지 전용).
  // 결함 증적은 'nc_finding', 모두 보려면 'all'.
  source?: 'library' | 'nc_finding' | 'all'
}
