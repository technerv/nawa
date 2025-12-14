import { useQuery } from '@tanstack/react-query'
import { myMemberships, listNeighborhoods, listNeighborhoodAlerts } from '../api/neighborhood'
import { formatDate } from '../lib/dateFormat'
import { formatLocation } from '../lib/locationFormat'

export default function MyNeighborhoodPage() {
  const memberships = useQuery({
    queryKey: ['my_memberships'],
    queryFn: async () => await myMemberships()
  })
  const neighborhoods = useQuery({
    queryKey: ['neighborhoods_all'],
    queryFn: async () => (await listNeighborhoods()).results
  })

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">My Neighborhood</h2>
        <p className="text-gray-100 text-sm">View your neighborhood memberships and recent incidents</p>
      </div>
      {!memberships.data || memberships.data.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <p className="text-gray-600">You have not joined any neighborhood yet.</p>
        </div>
      ) : (
        memberships.data.map((m) => {
          const nb = neighborhoods.data?.find((n) => n.id === m.neighborhood)
          return (
            <NeighborhoodCard key={m.id} id={m.neighborhood} name={nb?.name || `Neighborhood #${m.neighborhood}`} />
          )
        })
      )}
    </div>
  )
}

function NeighborhoodCard({ id, name }: { id: number; name: string }) {
  const alerts = useQuery({
    queryKey: ['neighborhood_alerts', id],
    queryFn: async () => await listNeighborhoodAlerts(id)
  })
  
  const getSeverityColor = (severity: string) => {
    const s = severity?.toLowerCase() || ''
    if (s === 'low') return 'text-emerald-700 bg-emerald-50'
    if (s === 'medium') return 'text-amber-700 bg-amber-50'
    if (s === 'high') return 'text-red-700 bg-red-50'
    if (s === 'critical') return 'text-violet-700 bg-violet-50'
    return 'text-gray-700 bg-gray-50'
  }
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      <div className="p-4 bg-gray-50 border-b">
        <h3 className="text-xl font-bold text-gray-800">{name}</h3>
      </div>
      {!alerts.data || alerts.data.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-600">No recent incidents in this neighborhood.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left table-bordered">
            <thead>
              <tr>
                <th>Crime</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Location</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {alerts.data.map((r: any) => (
                <tr key={r.id} className="transition-colors hover:bg-blue-50">
                  <td className="font-medium">{r.name_of_crime}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${getSeverityColor(r.severity)}`}>
                      {r.severity || '-'}
                    </span>
                  </td>
                  <td className="text-sm capitalize">{r.status || '-'}</td>
                  <td className="text-sm">{formatLocation(r.location_name, r.county, undefined, r.latitude, r.longitude)}</td>
                  <td className="text-sm text-gray-600">{formatDate(r.date_updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}