import { useQuery } from '@tanstack/react-query'
import { myMemberships, listNeighborhoods, listNeighborhoodAlerts } from '../api/neighborhood'

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
    <div>
      <h2>My Neighborhood</h2>
      {!memberships.data || memberships.data.length === 0 ? (
        <p style={{ color: '#666' }}>You have not joined any neighborhood yet.</p>
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
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>{name}</h3>
      {!alerts.data || alerts.data.length === 0 ? (
        <p style={{ color: '#666' }}>No recent incidents in this neighborhood.</p>
      ) : (
        <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Crime</th>
              <th align="left">Severity</th>
              <th align="left">Status</th>
              <th align="left">Location</th>
              <th align="left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {alerts.data.map((r: any) => (
              <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                <td>{r.name_of_crime}</td>
                <td>{r.severity}</td>
                <td>{r.status}</td>
                <td>{r.location_name ?? r.county ?? '-'}</td>
                <td>{new Date(r.date_updated).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}