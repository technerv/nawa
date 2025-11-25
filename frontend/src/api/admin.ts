import { api } from './axios'

export async function listUsersWithRoles() {
  const res = await api.get<{ results: { id: number; username: string; email: string; roles: string[]; is_superuser: boolean; is_staff: boolean }[]; total?: number; by_role?: Record<string, number> }>(
    '/admin/users_roles/'
  )
  return res.data
}
