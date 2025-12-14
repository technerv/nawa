import { api } from './axios'

export interface UserWithRoles {
  id: number
  username: string
  email: string
  roles: string[]
  is_superuser: boolean
  is_staff: boolean
  whitelist?: {
    organization_name: string
    organization_type: string
    is_active: boolean
    has_ip_restrictions: boolean
    has_vpn_restrictions: boolean
  } | null
}

export async function listUsersWithRoles() {
  const res = await api.get<{ 
    results: UserWithRoles[]
    total?: number
    by_role?: Record<string, number>
  }>('/admin/users_roles/')
  return res.data
}

export interface CreateSecurityOrgUserPayload {
  username: string
  password: string
  email?: string
  role?: string
  organization_name: string
  organization_type: 'police' | 'county_command' | 'private_security' | 'emergency' | 'other'
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  allowed_ip_ranges?: string[]
  allowed_vpn_names?: string[]
  notes?: string
}

export async function createSecurityOrgUser(payload: CreateSecurityOrgUserPayload) {
  const res = await api.post<{
    access: string
    refresh: string
    user: {
      id: number
      username: string
      email: string
      roles: string[]
    }
  }>('/auth/register/', payload)
  return res.data
}
