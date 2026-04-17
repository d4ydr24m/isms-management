import { useState, useEffect, useMemo, useCallback } from 'react'
import { App, Card, Table, Tag, Checkbox, Button, Space, Typography, Tooltip } from 'antd'
import { SaveOutlined, UndoOutlined } from '@ant-design/icons'
import { roleService } from '@/services/roles'
import type { RoleDetail, Permission } from '@/services/roles'
import { usePermissions } from '@/hooks'

const { Title, Text } = Typography

/**
 * Group permissions by category for the permission matrix display.
 */
function groupPermissions(permissions: Permission[]): Map<string, Permission[]> {
  const map = new Map<string, Permission[]>()
  for (const perm of permissions) {
    const group = map.get(perm.category) || []
    group.push(perm)
    map.set(perm.category, group)
  }
  return map
}

/**
 * Check if a role has a specific permission, accounting for wildcards.
 */
function roleHasPermission(rolePerms: string[], permCode: string): boolean {
  if (rolePerms.includes('all')) return true
  if (rolePerms.includes(permCode)) return true
  const [category] = permCode.split(':')
  if (rolePerms.includes(`${category}:*`)) return true
  return false
}

export default function RolePermissions() {
  const { message } = App.useApp()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission('role:update')
  const [roles, setRoles] = useState<RoleDetail[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  // Track edits: roleId -> set of permission codes
  const [editedPerms, setEditedPerms] = useState<Map<number, Set<string>>>(new Map())
  const [hasChanges, setHasChanges] = useState<Set<number>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesData, permsData] = await Promise.all([
        roleService.getRoles(),
        roleService.getAllPermissions(),
      ])
      setRoles(rolesData)
      setAllPermissions(permsData)
      // Initialize editedPerms from current role data
      const initial = new Map<number, Set<string>>()
      for (const role of rolesData) {
        initial.set(role.id, new Set(role.permissions))
      }
      setEditedPerms(initial)
      setHasChanges(new Set())
    } catch {
      message.error('역할 및 권한 데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    loadData()
  }, [loadData])

  const permissionGroups = useMemo(() => groupPermissions(allPermissions), [allPermissions])

  const handleToggle = (roleId: number, permCode: string, checked: boolean) => {
    setEditedPerms((prev) => {
      const next = new Map(prev)
      const perms = new Set(next.get(roleId) || [])

      if (checked) {
        perms.add(permCode)
      } else {
        perms.delete(permCode)
        // Also remove wildcard if unchecking individual permission
        const [cat] = permCode.split(':')
        perms.delete(`${cat}:*`)
      }

      next.set(roleId, perms)
      return next
    })
    setHasChanges((prev) => {
      const next = new Set(prev)
      next.add(roleId)
      return next
    })
  }

  const handleToggleWildcard = (roleId: number, categoryPerms: Permission[], checked: boolean) => {
    setEditedPerms((prev) => {
      const next = new Map(prev)
      const perms = new Set(next.get(roleId) || [])

      if (checked) {
        // Add wildcard
        const [cat] = categoryPerms[0].code.split(':')
        perms.add(`${cat}:*`)
        // Remove individual permissions (wildcard covers them)
        for (const p of categoryPerms) {
          perms.delete(p.code)
        }
      } else {
        // Remove wildcard and all individual permissions
        const [cat] = categoryPerms[0].code.split(':')
        perms.delete(`${cat}:*`)
        for (const p of categoryPerms) {
          perms.delete(p.code)
        }
      }

      next.set(roleId, perms)
      return next
    })
    setHasChanges((prev) => {
      const next = new Set(prev)
      next.add(roleId)
      return next
    })
  }

  const handleSave = async (roleId: number) => {
    const perms = editedPerms.get(roleId)
    if (!perms) return

    setSaving(roleId)
    try {
      const updated = await roleService.updateRolePermissions(roleId, Array.from(perms))
      message.success('권한이 저장되었습니다')
      // Update only the saved role in local state (preserve other pending edits)
      setRoles((prev) =>
        prev.map((r) =>
          r.id === roleId ? { ...r, permissions: updated.permissions } : r,
        ),
      )
      setHasChanges((prev) => {
        const next = new Set(prev)
        next.delete(roleId)
        return next
      })
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message
      message.error(detail || '권한 저장에 실패했습니다')
    } finally {
      setSaving(null)
    }
  }

  const handleReset = (roleId: number) => {
    const role = roles.find((r) => r.id === roleId)
    if (!role) return

    setEditedPerms((prev) => {
      const next = new Map(prev)
      next.set(roleId, new Set(role.permissions))
      return next
    })
    setHasChanges((prev) => {
      const next = new Set(prev)
      next.delete(roleId)
      return next
    })
  }

  // Sort roles: system roles first, then by id
  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => {
      if (a.isSystemRole !== b.isSystemRole) return a.isSystemRole ? -1 : 1
      return a.id - b.id
    }),
    [roles],
  )

  const isCiso = (role: RoleDetail) => role.name === 'CISO'

  // Build table columns
  const columns = useMemo(() => {
    const cols: any[] = [
      {
        title: '권한',
        dataIndex: 'label',
        key: 'label',
        fixed: 'left' as const,
        width: 200,
        render: (text: string, record: any) => {
          if (record.isCategory) {
            return <Text strong>{text}</Text>
          }
          if (record.isWildcard) {
            return (
              <Text type="secondary" style={{ paddingLeft: 16 }}>
                전체 ({text})
              </Text>
            )
          }
          return (
            <Tooltip title={record.description}>
              <Text style={{ paddingLeft: 16 }}>{text}</Text>
            </Tooltip>
          )
        },
      },
    ]

    for (const role of sortedRoles) {
      cols.push({
        title: (
          <div style={{ textAlign: 'center' }}>
            <div>{role.name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>
              {role.isSystemRole ? (
                <Tag color="blue" style={{ fontSize: 10 }}>시스템</Tag>
              ) : (
                <Tag style={{ fontSize: 10 }}>커스텀</Tag>
              )}
              <span>{role.userCount}명</span>
            </div>
          </div>
        ),
        key: `role-${role.id}`,
        width: 120,
        align: 'center' as const,
        render: (_: any, record: any) => {
          if (record.isCategory) return null

          const rolePerms = editedPerms.get(role.id) || new Set<string>()
          const rolePermsArr = Array.from(rolePerms)

          if (isCiso(role)) {
            // CISO always has all - show locked checkmark
            return (
              <Tooltip title="CISO는 전체 권한을 가집니다">
                <Checkbox checked disabled />
              </Tooltip>
            )
          }

          if (record.isWildcard) {
            const categoryPerms: Permission[] = record.categoryPerms
            const [cat] = categoryPerms[0].code.split(':')
            const hasWild = rolePermsArr.includes(`${cat}:*`)
            const allChecked = hasWild || categoryPerms.every((p) => roleHasPermission(rolePermsArr, p.code))
            const someChecked = !allChecked && categoryPerms.some((p) => roleHasPermission(rolePermsArr, p.code))

            return (
              <Checkbox
                checked={allChecked}
                indeterminate={someChecked}
                disabled={!canUpdate}
                onChange={(e) => handleToggleWildcard(role.id, categoryPerms, e.target.checked)}
              />
            )
          }

          const permCode: string = record.permCode
          const checked = roleHasPermission(rolePermsArr, permCode)

          return (
            <Checkbox
              checked={checked}
              disabled={!canUpdate}
              onChange={(e) => handleToggle(role.id, permCode, e.target.checked)}
            />
          )
        },
      })
    }

    return cols
  }, [sortedRoles, editedPerms])

  // Build table data rows
  const dataSource = useMemo(() => {
    const rows: any[] = []

    for (const [category, perms] of permissionGroups) {
      // Category header row
      rows.push({
        key: `cat-${category}`,
        label: category,
        isCategory: true,
      })

      // Wildcard row (전체) if category has more than 1 permission
      if (perms.length > 1) {
        rows.push({
          key: `wild-${category}`,
          label: category,
          isWildcard: true,
          categoryPerms: perms,
        })
      }

      // Individual permission rows
      for (const perm of perms) {
        rows.push({
          key: perm.code,
          label: perm.name,
          description: perm.description,
          permCode: perm.code,
        })
      }
    }

    return rows
  }, [permissionGroups])

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>역할별 권한 관리</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        각 역할의 권한을 설정합니다. CISO 역할은 전체 권한을 가지며 변경할 수 없습니다.
      </Text>

      {/* Save/Reset buttons for changed roles */}
      {hasChanges.size > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            {Array.from(hasChanges).map((roleId) => {
              const role = roles.find((r) => r.id === roleId)
              if (!role) return null
              return (
                <Space key={roleId}>
                  <Tag color="orange">{role.name}</Tag>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SaveOutlined />}
                    loading={saving === roleId}
                    onClick={() => handleSave(roleId)}
                  >
                    저장
                  </Button>
                  <Button
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={() => handleReset(roleId)}
                  >
                    되돌리기
                  </Button>
                </Space>
              )
            })}
          </Space>
        </Card>
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 200 + sortedRoles.length * 120 }}
          bordered
          rowClassName={(record) => (record.isCategory ? 'permission-category-row' : '')}
        />
      </Card>

      <style>{`
        .permission-category-row {
          background-color: #fafafa !important;
        }
        .permission-category-row td {
          font-weight: 600 !important;
        }
      `}</style>
    </div>
  )
}
