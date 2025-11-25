import { useQuery } from '@tanstack/react-query'
import { listUsersWithRoles } from '../api/admin'

export default function AdminUsersPage() {
  const query = useQuery({
    queryKey: ['admin_users_roles'],
    queryFn: () => listUsersWithRoles()
  })
  return (
    <div>
      <h2>Users & Roles</h2>
      {query.data && (
        <div style={{ marginBottom: 12, color: '#444' }}>
          <div>Total users: {query.data.total ?? query.data.results.length}</div>
          {query.data.by_role && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(query.data.by_role).map(([role, count]) => (
                <span key={role} style={{ fontSize: 12, background: '#f7f7f7', border: '1px solid #eee', borderRadius: 999, padding: '2px 8px' }}>
                  {role}: {String(count)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {query.isLoading && <p>Loading...</p>}
      {query.isError && <p style={{ color: 'crimson' }}>Failed to load users.</p>}
      {query.data && (
        <div style={{ overflowX: 'auto' }}>
          <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th align="left">ID</th>
                <th align="left">Username</th>
                <th align="left">Email</th>
                <th align="left">Roles</th>
                <th align="left">Flags</th>
              </tr>
            </thead>
            <tbody>
              {query.data.results.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid #eee' }}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email || '-'}</td>
                  <td>{u.roles.length ? u.roles.join(', ') : '-'}</td>
                  <td>{[u.is_superuser ? 'superuser' : null, u.is_staff ? 'staff' : null].filter(Boolean).join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
