/**
 * 정보자산 관리 관련 TypeScript 타입 정의
 * Phase 2: FR-501 ~ FR-505
 */

// =============================================================================
// 자산 상태 및 열거형
// =============================================================================

/** 자산 상태 */
export type AssetStatus = 'introduced' | 'operating' | 'changed' | 'disposed'

/** 자산 담당자 역할 */
export type AssetAssignmentRole = 'owner' | 'manager' | 'user'

/** 자산 변경 유형 */
export type AssetChangeType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'valuation_changed'
  | 'assignment_changed'
  | 'disposed'

// =============================================================================
// 자산 유형 (FR-501)
// =============================================================================

/** 자산 유형 기본 */
export interface AssetTypeBase {
  code: string
  name: string
  description?: string
  icon?: string
  sortOrder: number
}

/** 자산 유형 생성 요청 */
export interface AssetTypeCreate extends AssetTypeBase {}

/** 자산 유형 수정 요청 */
export interface AssetTypeUpdate {
  name?: string
  description?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}

/** 자산 유형 응답 */
export interface AssetType extends AssetTypeBase {
  id: number
  isCustom: boolean
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

/** 자산 유형 목록 응답 */
export interface AssetTypeList {
  items: AssetType[]
  total: number
}

// =============================================================================
// 자산 분류 (FR-501)
// =============================================================================

/** 자산 분류 기본 */
export interface AssetCategoryBase {
  code: string
  name: string
  description?: string
  level: 1 | 2 | 3
  parentId?: number
  sortOrder: number
}

/** 자산 분류 생성 요청 */
export interface AssetCategoryCreate extends AssetCategoryBase {}

/** 자산 분류 수정 요청 */
export interface AssetCategoryUpdate {
  name?: string
  description?: string
  sortOrder?: number
  isActive?: boolean
}

/** 자산 분류 응답 (트리 구조) */
export interface AssetCategory extends AssetCategoryBase {
  id: number
  isActive: boolean
  createdAt: string
  updatedAt?: string
  children: AssetCategory[]
}

/** 자산 분류 목록 응답 */
export interface AssetCategoryList {
  items: AssetCategory[]
  total: number
}

// =============================================================================
// 자산 (FR-502)
// =============================================================================

/** 자산 사양 (JSON) */
export interface AssetSpecifications {
  cpu?: string
  memory?: string
  storage?: string
  network?: string
  [key: string]: string | number | boolean | undefined
}

/** 자산 기본 */
export interface AssetBase {
  name: string
  description?: string
  assetTypeId: number
  categoryIds?: number[]
  location?: string
  departmentId?: number
  ownerId?: number
  personnelOwnerId?: number
  ipAddress?: string
  macAddress?: string
  hostname?: string
  osVersion?: string
  serialNumber?: string
  manufacturer?: string
  model?: string
  specifications?: AssetSpecifications
  acquisitionDate?: string
  acquisitionCost?: number
  warrantyEndDate?: string
}

/** 자산 생성 요청 */
export interface AssetCreate extends AssetBase {}

/** 자산 수정 요청 */
export interface AssetUpdate {
  name?: string
  description?: string
  categoryIds?: number[]
  location?: string
  departmentId?: number
  ownerId?: number
  personnelOwnerId?: number
  ipAddress?: string
  macAddress?: string
  hostname?: string
  osVersion?: string
  serialNumber?: string
  manufacturer?: string
  model?: string
  specifications?: AssetSpecifications
  acquisitionDate?: string
  acquisitionCost?: number
  warrantyEndDate?: string
  status?: AssetStatus
}

/** 자산 응답 */
export interface Asset extends AssetBase {
  id: number
  assetCode: string
  assetTypeName?: string
  assetTypeCode?: string
  categoryIds?: number[]
  categoryNames?: string[]
  departmentName?: string
  ownerName?: string
  personnelOwnerName?: string
  disposalDate?: string
  status: AssetStatus
  isActive: boolean
  createdAt: string
  updatedAt?: string
  // 최신 가치 평가 정보
  importanceLevel?: number
  confidentiality?: number
  integrity?: number
  availability?: number
}

/** 자산 목록 응답 */
export interface AssetList {
  items: Asset[]
  total: number
  page: number
  size: number
  pages: number
}

/** 자산 목록 아이템 (간소화) */
export interface AssetListItem {
  id: number
  assetCode: string
  name: string
  assetTypeName: string
  assetTypeCode: string
  location?: string
  departmentName?: string
  ownerName?: string
  personnelOwnerName?: string
  status: AssetStatus
  importanceLevel?: number
  createdAt: string
}

// =============================================================================
// 자산 가치 평가 (FR-503)
// =============================================================================

/** 자산 가치 평가 생성 요청 */
export interface AssetValuationCreate {
  confidentiality: 1 | 2 | 3
  integrity: 1 | 2 | 3
  availability: 1 | 2 | 3
  evaluationReason?: string
}

/** 자산 가치 평가 응답 */
export interface AssetValuation {
  id: number
  assetId: number
  confidentiality: number
  integrity: number
  availability: number
  importanceLevel?: number
  evaluationReason?: string
  evaluatedBy?: number
  evaluatorName?: string
  evaluatedAt?: string
  createdAt: string
}

/** 자산 가치 평가 이력 */
export interface AssetValuationHistory {
  items: AssetValuation[]
}

// =============================================================================
// 자산 이력 (FR-504)
// =============================================================================

/** 자산 변경 이력 응답 */
export interface AssetHistory {
  id: number
  assetId: number
  changeType: AssetChangeType
  fieldName?: string
  oldValue?: string
  newValue?: string
  changedBy?: number
  changerName?: string
  changedAt: string
  remarks?: string
}

/** 자산 폐기 요청 */
export interface AssetDisposalCreate {
  disposalDate: string
  disposalReason?: string
  disposalMethod?: string
  dataDeletionConfirmed: boolean
  dataDeletionMethod?: string
  dataDeletionEvidenceId?: number
  remarks?: string
}

/** 자산 폐기 응답 */
export interface AssetDisposal {
  id: number
  assetId: number
  disposalDate: string
  disposalReason?: string
  disposalMethod?: string
  dataDeletionConfirmed: boolean
  dataDeletionMethod?: string
  dataDeletionEvidenceId?: number
  approvedBy?: number
  approverName?: string
  approvedAt?: string
  remarks?: string
  createdAt: string
}

/** 자산 생명주기 통계 */
export interface AssetLifecycleStats {
  byStatus: Record<AssetStatus, number>
  total: number
  introducedThisMonth: number
  disposedThisMonth: number
}

// =============================================================================
// 자산 담당자 (FR-505)
// =============================================================================

/** 자산 담당자 할당 생성 요청 */
export interface AssetAssignmentCreate {
  userId: number
  role: AssetAssignmentRole
  remarks?: string
}

/** 자산 담당자 할당 수정 요청 */
export interface AssetAssignmentUpdate {
  role?: AssetAssignmentRole
  remarks?: string
  isActive?: boolean
}

/** 자산 담당자 할당 응답 */
export interface AssetAssignment {
  id: number
  assetId: number
  userId: number
  userName?: string
  userEmail?: string
  role: AssetAssignmentRole
  assignedAt: string
  assignedBy?: number
  assignerName?: string
  isActive: boolean
  remarks?: string
}

/** 자산 인수인계 체크리스트 항목 */
export interface AssetHandoverChecklistItem {
  item: string
  completed: boolean
  completedAt?: string
  remarks?: string
}

/** 자산 인수인계 응답 */
export interface AssetHandover {
  id: number
  assetId: number
  fromUserId: number
  fromUserName?: string
  toUserId: number
  toUserName?: string
  handoverDate: string
  checklistItems?: Record<string, AssetHandoverChecklistItem>
  checklistCompleted: boolean
  remarks?: string
  approvedBy?: number
  approverName?: string
  approvedAt?: string
  createdAt: string
}

// =============================================================================
// 엑셀 임포트 (FR-502)
// =============================================================================

/** 자산 임포트 행 */
export interface AssetImportRow {
  name: string
  assetTypeCode: string
  categoryCode?: string
  location?: string
  departmentCode?: string
  ipAddress?: string
  hostname?: string
  serialNumber?: string
  manufacturer?: string
  model?: string
}

/** 자산 임포트 결과 */
export interface AssetImportResult {
  total: number
  success: number
  failed: number
  errors: Array<{
    row: number
    field?: string
    message: string
  }>
}

/** 자산 임포트 미리보기 */
export interface AssetImportPreview {
  rows: AssetImportRow[]
  validCount: number
  invalidCount: number
  errors: Array<{
    row: number
    field?: string
    message: string
  }>
}

// =============================================================================
// 자산 통계
// =============================================================================

/** 자산 전체 통계 */
export interface AssetStats {
  totalCount: number
  activeCount: number
  byStatus: Record<AssetStatus, number>
  byImportance: Record<number, number>
  recentAdded: number
  recentDisposed: number
}

/** 유형별 자산 통계 */
export interface AssetByTypeStats {
  typeId: number
  typeCode: string
  typeName: string
  count: number
  activeCount: number
}

/** 부서별 자산 통계 */
export interface AssetByDepartmentStats {
  departmentId: number
  departmentName: string
  count: number
  byImportance: Record<number, number>
}

/** 중요도별 자산 통계 */
export interface AssetByImportanceStats {
  importanceLevel: number
  label: string
  count: number
  percentage: number
}

// =============================================================================
// 필터 파라미터
// =============================================================================

/** 자산 필터 파라미터 */
export interface AssetFilterParams {
  search?: string
  assetTypeId?: number
  categoryId?: number
  departmentId?: number
  ownerId?: number
  status?: AssetStatus
  importanceLevel?: number
  isActive?: boolean
}
