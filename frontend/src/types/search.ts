// 검색 관련 타입

export type SearchCategory = 'all' | 'controls' | 'evidences' | 'users'

export interface SearchResult {
  id: number
  type: SearchCategory
  title: string
  description: string
  metadata?: Record<string, any>
  url: string
  highlight?: string
}

export interface SearchControlResult {
  id: number
  number: string
  title: string
  description: string
  categoryName: string
  evidenceCount: number
}

export interface SearchEvidenceResult {
  id: number
  title: string
  description: string
  status: string
  uploaderName: string
  controlItems: string[]
  createdAt: string
}

export interface SearchUserResult {
  id: number
  name: string
  email: string
  department: string
  roles: string[]
}

export interface SearchResponse {
  query: string
  totalCount: number
  controls: SearchControlResult[]
  evidences: SearchEvidenceResult[]
  users: SearchUserResult[]
}

export interface SearchParams {
  query: string
  category?: SearchCategory
  limit?: number
}
