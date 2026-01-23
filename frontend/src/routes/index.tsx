import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import PrivateRoute from './PrivateRoute'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import NotFoundPage from '@/pages/NotFoundPage'
import UserList from '@/pages/Users'
import UserDetail from '@/pages/Users/UserDetail'
import UserCreate from '@/pages/Users/UserCreate'
import AuditorAccounts from '@/pages/Users/AuditorAccounts'
// Evidence Management
import EvidenceListPage from '@/pages/Evidence'
import EvidenceDetail from '@/pages/Evidence/EvidenceDetail'
import EvidenceCreate from '@/pages/Evidence/EvidenceCreate'
// Audit Management
import AuditListPage from '@/pages/Audit'
import AuditDetail from '@/pages/Audit/AuditDetail'
import AuditCreate from '@/pages/Audit/AuditCreate'
import Checklist from '@/pages/Audit/Checklist'
import NonConformities from '@/pages/Audit/NonConformities'
import NonConformityDetail from '@/pages/Audit/NonConformityDetail'
// Search
import SearchResults from '@/pages/SearchResults'

const AppRouter = () => {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      {/* Root route - redirect based on authentication */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />

      {/* User Management routes */}
      <Route
        path="/users"
        element={
          <PrivateRoute>
            <UserList />
          </PrivateRoute>
        }
      />
      <Route
        path="/users/create"
        element={
          <PrivateRoute>
            <UserCreate />
          </PrivateRoute>
        }
      />
      <Route
        path="/users/:id"
        element={
          <PrivateRoute>
            <UserDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/users/auditor-accounts"
        element={
          <PrivateRoute>
            <AuditorAccounts />
          </PrivateRoute>
        }
      />

      {/* Evidence Management routes */}
      <Route
        path="/evidence"
        element={
          <PrivateRoute>
            <EvidenceListPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/evidence/create"
        element={
          <PrivateRoute>
            <EvidenceCreate />
          </PrivateRoute>
        }
      />
      <Route
        path="/evidence/:id"
        element={
          <PrivateRoute>
            <EvidenceDetail />
          </PrivateRoute>
        }
      />

      {/* Audit Management routes */}
      <Route
        path="/audits"
        element={
          <PrivateRoute>
            <AuditListPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/audits/create"
        element={
          <PrivateRoute>
            <AuditCreate />
          </PrivateRoute>
        }
      />
      <Route
        path="/audits/:id"
        element={
          <PrivateRoute>
            <AuditDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/audits/:auditId/checklist"
        element={
          <PrivateRoute>
            <Checklist />
          </PrivateRoute>
        }
      />
      <Route
        path="/audits/:auditId/non-conformities/create"
        element={
          <PrivateRoute>
            <NonConformityDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/non-conformities"
        element={
          <PrivateRoute>
            <NonConformities />
          </PrivateRoute>
        }
      />
      <Route
        path="/non-conformities/create"
        element={
          <PrivateRoute>
            <NonConformityDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/non-conformities/:id"
        element={
          <PrivateRoute>
            <NonConformityDetail />
          </PrivateRoute>
        }
      />

      {/* Search route */}
      <Route
        path="/search"
        element={
          <PrivateRoute>
            <SearchResults />
          </PrivateRoute>
        }
      />

      {/* 404 Not Found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRouter
