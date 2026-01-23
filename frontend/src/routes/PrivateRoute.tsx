import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoadingSpinner } from '@/components/common'
import { useAuthStore } from '@/stores/authStore'

interface PrivateRouteProps {
  children: ReactNode
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner fullscreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default PrivateRoute
