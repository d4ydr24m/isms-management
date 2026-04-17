import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function usePermissions() {
  const user = useAuthStore((state) => state.user)
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser)

  useEffect(() => {
    if (user && (!user.permissions || user.permissions.length === 0)) {
      fetchCurrentUser().catch(() => { /* ignore */ })
    }
  }, [user?.id])

  const permissions = user?.permissions || []

  const hasPermission = (perm: string): boolean => {
    if (permissions.includes('all')) return true
    const [category] = perm.split(':')
    if (permissions.includes(`${category}:*`)) return true
    return permissions.includes(perm)
  }

  return { permissions, hasPermission }
}
