import { useQuery } from '@tanstack/react-query'
import { listUsersWithRoles } from '../api/admin'

export default function AdminUsersPage() {
  const query = useQuery({
    queryKey: ['admin_users_roles'],
    queryFn: () => listUsersWithRoles()
  })
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">Users & Roles</h2>
        <p className="text-gray-100 text-sm">Manage user accounts and their roles</p>
      </div>
      {query.data && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <div className="mb-4">
            <div className="text-lg font-semibold text-gray-800 mb-3">Total users: <span className="text-primary">{query.data.total ?? query.data.results.length}</span></div>
            {query.data.by_role && (
              <div className="flex gap-3 flex-wrap">
                {Object.entries(query.data.by_role).map(([role, count]) => (
                  <span key={role} className="px-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-sm font-medium text-gray-700">
                    {role}: {String(count)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {query.isLoading && (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      )}
      {query.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Failed to load users.</p>
        </div>
      )}
      {query.data && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="text-lg font-bold text-gray-800">User List</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left table-bordered" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-blue-50">
                    <td className="font-mono text-sm">{u.id}</td>
                    <td className="font-medium">{u.username}</td>
                    <td>{u.email || '-'}</td>
                    <td>
                      {u.roles.length ? (
                        <div className="flex gap-2 flex-wrap">
                          {u.roles.map((r) => (
                            <span key={r} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      {[u.is_superuser ? 'superuser' : null, u.is_staff ? 'staff' : null].filter(Boolean).length > 0 ? (
                        <div className="flex gap-2">
                          {u.is_superuser && <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">superuser</span>}
                          {u.is_staff && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">staff</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
