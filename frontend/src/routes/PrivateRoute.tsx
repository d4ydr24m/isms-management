import { ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoadingSpinner } from '@/components/common'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/services/api'

interface PrivateRouteProps {
  children: ReactNode
}

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { isAuthenticated, isLoading, setUser } = useAuthStore()
  const location = useLocation()
  const [verifying, setVerifying] = useState(true)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    // If not authenticated in store, no need to verify
    if (!isAuthenticated) {
      setVerifying(false)
      return
    }

    // Verify session is still valid by calling /auth/me
    const verify = async () => {
      try {
        await apiClient.get('/auth/me')
        setVerified(true)
      } catch {
        // Session expired — clear auth state
        setUser(null)
      } finally {
        setVerifying(false)
      }
    }
    verify()
  }, []) // Only on mount

  if (isLoading || verifying) {
    return <LoadingSpinner fullscreen />
  }

  if (!isAuthenticated || (!verified && !isAuthenticated)) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default PrivateRoute
