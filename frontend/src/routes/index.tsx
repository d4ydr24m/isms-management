import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import PrivateRoute from './PrivateRoute'
import LoginPage from '@/pages/Auth/LoginPage'
import MFAVerifyPage from '@/pages/Auth/MFAVerifyPage'
import DashboardPage from '@/pages/DashboardPage'
import NotFoundPage from '@/pages/NotFoundPage'
import UserList from '@/pages/Users'
import UserDetail from '@/pages/Users/UserDetail'
import UserCreate from '@/pages/Users/UserCreate'
import AuditorAccounts from '@/pages/Users/AuditorAccounts'
import AuditorAccountsPage from '@/pages/Audit/AuditorAccounts'
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
// Asset Management
import AssetListPage from '@/pages/Assets'
import AssetDetail from '@/pages/Assets/AssetDetail'
import AssetCreate from '@/pages/Assets/AssetCreate'
import AssetImport from '@/pages/Assets/AssetImport'
import AssetCategories from '@/pages/Assets/AssetCategories'
// Department Management
import DepartmentsPage from '@/pages/Departments'
// Personnel Management
import PersonnelPage from '@/pages/Personnel'
// ISMS Scope Management
import IsmsScopePage from '@/pages/IsmsScope'
// Audit Logs
import AuditLogsPage from '@/pages/AuditLogs'
// Controls Management
import ControlsPage from '@/pages/Controls'
import ControlDetail from '@/pages/Controls/ControlDetail'
// Roles Management
import RolePermissions from '@/pages/Roles'
// Settings
import SettingsPage from '@/pages/Settings'
// Risk Management
import RiskIndexPage from '@/pages/Risk'
import RiskScenarioDetail from '@/pages/Risk/RiskScenarioDetail'
import RiskAssessmentPage from '@/pages/Risk/RiskAssessment'
import ThreatDBPage from '@/pages/Risk/ThreatDB'
import VulnerabilityDBPage from '@/pages/Risk/VulnerabilityDB'
import DoASettingsPage from '@/pages/Risk/DoASettings'
import RiskTreatmentPage from '@/pages/Risk/RiskTreatment'
import SOAManagementPage from '@/pages/Risk/SOAManagement'
import RiskReportPage from '@/pages/Risk/RiskReport'
import VulnCheckScriptsPage from '@/pages/Risk/VulnCheckScripts'

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
      <Route
        path="/auth/mfa-verify"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <MFAVerifyPage />
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

      {/* Department Management route */}
      <Route
        path="/departments"
        element={
          <PrivateRoute>
            <DepartmentsPage />
          </PrivateRoute>
        }
      />

      {/* Personnel Management route */}
      <Route
        path="/personnel"
        element={
          <PrivateRoute>
            <PersonnelPage />
          </PrivateRoute>
        }
      />

      {/* Role Permission Management route */}
      <Route
        path="/roles"
        element={
          <PrivateRoute>
            <RolePermissions />
          </PrivateRoute>
        }
      />

      {/* Audit Logs route */}
      <Route
        path="/audit-logs"
        element={
          <PrivateRoute>
            <AuditLogsPage />
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
      <Route
        path="/evidence/:id/edit"
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
        path="/audits/:id/edit"
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

      {/* Auditor Accounts route */}
      <Route
        path="/auditor-accounts"
        element={
          <PrivateRoute>
            <AuditorAccountsPage />
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

      {/* Asset Management routes */}
      <Route
        path="/assets"
        element={
          <PrivateRoute>
            <AssetListPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/assets/create"
        element={
          <PrivateRoute>
            <AssetCreate />
          </PrivateRoute>
        }
      />
      <Route
        path="/assets/import"
        element={
          <PrivateRoute>
            <AssetImport />
          </PrivateRoute>
        }
      />
      <Route
        path="/assets/:id"
        element={
          <PrivateRoute>
            <AssetDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/assets/categories"
        element={
          <PrivateRoute>
            <AssetCategories />
          </PrivateRoute>
        }
      />
      <Route
        path="/assets/:id/edit"
        element={
          <PrivateRoute>
            <AssetCreate />
          </PrivateRoute>
        }
      />

      {/* ISMS Scope Management route */}
      <Route
        path="/isms-scope"
        element={
          <PrivateRoute>
            <IsmsScopePage />
          </PrivateRoute>
        }
      />

      {/* Controls Management routes */}
      <Route
        path="/controls"
        element={
          <PrivateRoute>
            <ControlsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/controls/:id"
        element={
          <PrivateRoute>
            <ControlDetail />
          </PrivateRoute>
        }
      />

      {/* Settings route */}
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <SettingsPage />
          </PrivateRoute>
        }
      />

      {/* Risk Management routes */}
      <Route
        path="/risk"
        element={
          <PrivateRoute>
            <RiskIndexPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/scenarios/:scenarioId"
        element={
          <PrivateRoute>
            <RiskScenarioDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/scenarios/:scenarioId/assessment"
        element={
          <PrivateRoute>
            <RiskAssessmentPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/doa"
        element={
          <PrivateRoute>
            <DoASettingsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/treatments"
        element={
          <PrivateRoute>
            <RiskTreatmentPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/soa"
        element={
          <PrivateRoute>
            <SOAManagementPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/report"
        element={
          <PrivateRoute>
            <RiskReportPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/threats"
        element={
          <PrivateRoute>
            <ThreatDBPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/vulnerabilities"
        element={
          <PrivateRoute>
            <VulnerabilityDBPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/risk/vuln-check"
        element={
          <PrivateRoute>
            <VulnCheckScriptsPage />
          </PrivateRoute>
        }
      />

      {/* 404 Not Found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRouter
