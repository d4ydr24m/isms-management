import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Alert } from 'antd'
import { LoadingSpinner } from '@/components/common'
import { useAuthStore } from '@/stores/authStore'

interface RoleRouteProps {
  children: ReactNode
  allowedRoles: string[]
}

const RoleRoute = ({ children, allowedRoles }: RoleRouteProps) => {
  const { isAuthenticated, user, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner fullscreen />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const hasRequiredRole = user.roles.some((role) => allowedRoles.includes(role))

  if (!hasRequiredRole) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Alert
          message="Access Denied"
          description="You do not have permission to access this page."
          type="error"
          showIcon
        />
      </div>
    )
  }

  return <>{children}</>
}

export default RoleRoute
