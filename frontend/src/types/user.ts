// 사용자 관련 타입
export interface User {
  id: number
  email: string
  name: string
  departmentId: number | null
  department?: Department
  roles: Role[]
  isActive: boolean
  isMfaEnabled: boolean
  ipWhitelistEnabled: boolean
  allowedIps: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  lastLoginIp: string | null
}

export interface Department {
  id: number
  name: string
  code: string
  parentId: number | null
  managerId: number | null
  isActive: boolean
  children?: Department[]
  createdAt: string
}

export interface Role {
  id: number
  name: string
  description: string
  permissions: string[]
}

// 사용자 생성 요청
export interface UserCreate {
  email: string
  password: string
  name: string
  departmentId?: number
  roleIds: number[]
}

// 사용자 수정 요청
export interface UserUpdate {
  name?: string
  departmentId?: number
  isActive?: boolean
  roleIds?: number[]
  ipWhitelistEnabled?: boolean
  allowedIps?: string
}

// 사용자 목록 응답
export interface UserListItem {
  id: number
  email: string
  name: string
  department: string | null
  departmentName: string | null
  roles: Role[]
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

// 부서 생성 요청
export interface DepartmentCreate {
  name: string
  code: string
  parentId?: number
  managerId?: number
}

// 부서 수정 요청
export interface DepartmentUpdate {
  name?: string
  code?: string
  parentId?: number
  managerId?: number
  isActive?: boolean
}
