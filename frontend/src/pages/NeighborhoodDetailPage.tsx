import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getNeighborhood, listNeighborhoodAlerts, joinNeighborhood, leaveNeighborhood, updateNeighborhoodPolygon } from '../api/neighborhood'
import { showToast } from '../lib/toast'
import { MapContainer, TileLayer, Polygon } from 'react-leaflet'
import { useState } from 'react'

export default function NeighborhoodDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const [polygonText, setPolygonText] = useState('')
  const [saving, setSaving] = useState(false)
  const nb = useQuery({
    queryKey: ['neighborhood', id],
    queryFn: async () => await getNeighborhood(id),
    enabled: Number.isFinite(id)
  })
  const alerts = useQuery({
    queryKey: ['neighborhood_alerts', id],
    queryFn: async () => await listNeighborhoodAlerts(id),
    enabled: Number.isFinite(id)
  })
  async function follow() {
    try {
      await joinNeighborhood(id)
      showToast('Following neighborhood alerts', 'success')
    } catch {}
  }
  async function unfollow() {
    try {
      await leaveNeighborhood(id)
      showToast('Unfollowed neighborhood alerts', 'success')
    } catch {}
  }

  const center: [number, number] = [-1.286389, 36.817223]
  const coords = (nb.data as any)?.polygon?.coordinates?.[0]
  const latlngs = coords?.map((c: any) => [c[1], c[0]])

  return (
    <div>
      <h2>{nb.data?.name ?? 'Neighborhood'}</h2>
      <div style={{ height: 360, width: '100%', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden' }}>
        <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          {latlngs && <Polygon positions={latlngs as any} pathOptions={{ color: '#2b6cb0', weight: 2, fillOpacity: 0.1 }} />}
        </MapContainer>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button onClick={follow}>Follow neighborhood</button>
        <button onClick={unfollow}>Unfollow</button>
      </div>
      <div className="card" style={{ marginTop: 12, padding: 8 }}>
        <strong>Polygon (GeoJSON)</strong>
        <small style={{ display: 'block', color: '#666' }}>Paste a Polygon GeoJSON with coordinates as [lon, lat].</small>
        <textarea rows={6} style={{ width: '100%' }} placeholder={`{ "type": "Polygon", "coordinates": [[ [lon,lat], ... ]] }`} value={polygonText} onChange={(e) => setPolygonText(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button disabled={saving} onClick={async () => {
            setSaving(true)
            try {
              const obj = JSON.parse(polygonText)
              await updateNeighborhoodPolygon(id, obj)
              showToast('Polygon saved', 'success')
              nb.refetch()
            } catch (e: any) {
              showToast(e?.message || 'Failed to save polygon', 'error')
            } finally {
              setSaving(false)
            }
          }}>Save Polygon</button>
          <button type="button" onClick={() => setPolygonText(JSON.stringify((nb.data as any)?.polygon ?? {}, null, 2))}>Load Current</button>
        </div>
      </div>
      <h3 style={{ marginTop: 12 }}>Incidents</h3>
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
