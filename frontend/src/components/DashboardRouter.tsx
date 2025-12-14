import { Navigate } from 'react-router-dom'
import { hasAnyRole, ROLES } from '../lib/roles'
import SecurityDashboardPage from '../pages/SecurityDashboardPage'
import SuperAdminDashboardPage from '../pages/SuperAdminDashboardPage'
import DashboardPage from '../pages/DashboardPage'

/**
 * Routes users to the appropriate dashboard based on their role:
 * - SuperAdmin → SuperAdminDashboardPage
 * - SecurityOrgUser → SecurityDashboardPage
 * - Others → Default DashboardPage
 */
export default function DashboardRouter() {
  const isSuperAdmin = hasAnyRole([ROLES.SuperAdmin])
  const isSecurityOrg = hasAnyRole([ROLES.SecurityOrgUser])

  if (isSuperAdmin) {
    return <SuperAdminDashboardPage />
  }

  if (isSecurityOrg) {
    return <SecurityDashboardPage />
  }

  // Default dashboard for other roles (Admin, Dispatcher, etc.)
  return <DashboardPage />
}

