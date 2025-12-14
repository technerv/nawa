import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getNeighborhood, listNeighborhoodAlerts, joinNeighborhood, leaveNeighborhood, updateNeighborhoodPolygon, listNeighborhoodMessages, createNeighborhoodMessage, approveNeighborhoodMessage } from '../api/neighborhood'
import { showToast } from '../lib/toast'
import { MapContainer, TileLayer, Polygon } from 'react-leaflet'
import { useState } from 'react'
import { hasAnyRole, ROLES } from '../lib/roles'
import { formatDate } from '../lib/dateFormat'
import { formatLocation } from '../lib/locationFormat'

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
  const messages = useQuery({
    queryKey: ['neighborhood_messages', id],
    queryFn: async () => await listNeighborhoodMessages(id),
    enabled: Number.isFinite(id)
  })
  const [msgText, setMsgText] = useState('')
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

  const getSeverityColor = (severity: string) => {
    const s = severity?.toLowerCase() || ''
    if (s === 'low') return 'text-emerald-700 bg-emerald-50'
    if (s === 'medium') return 'text-amber-700 bg-amber-50'
    if (s === 'high') return 'text-red-700 bg-red-50'
    if (s === 'critical') return 'text-violet-700 bg-violet-50'
    return 'text-gray-700 bg-gray-50'
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">{nb.data?.name ?? 'Neighborhood'}</h2>
        <p className="text-gray-100 text-sm">View neighborhood details, incidents, and messages</p>
      </div>
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Neighborhood Map</h3>
        <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: 400 }}>
          <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            {latlngs && <Polygon positions={latlngs as any} pathOptions={{ color: '#2b6cb0', weight: 2, fillOpacity: 0.1 }} />}
          </MapContainer>
        </div>
        <div className="flex gap-3 mt-4">
          <button 
            onClick={follow}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium"
          >
            Follow neighborhood
          </button>
          <button 
            onClick={unfollow}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Unfollow
          </button>
        </div>
      </div>
      {hasAnyRole([ROLES.Admin, ROLES.SuperAdmin]) && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Polygon (GeoJSON)</h3>
          <p className="text-sm text-gray-600 mb-3">Paste a Polygon GeoJSON with coordinates as [lon, lat].</p>
          <textarea 
            rows={6} 
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
            placeholder={`{ "type": "Polygon", "coordinates": [[ [lon,lat], ... ]] }`} 
            value={polygonText} 
            onChange={(e) => setPolygonText(e.target.value)} 
          />
          <div className="flex gap-3 mt-4">
            <button 
              disabled={saving} 
              onClick={async () => {
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
              }}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Polygon'}
            </button>
            <button 
              type="button" 
              onClick={() => setPolygonText(JSON.stringify((nb.data as any)?.polygon ?? {}, null, 2))}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Load Current
            </button>
          </div>
        </div>
      )}
      <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-xl font-bold text-gray-800">Incidents</h3>
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
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Messages</h3>
        <div className="grid gap-4">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <textarea 
              rows={3} 
              placeholder="Write a message to neighbors" 
              value={msgText} 
              onChange={(e) => setMsgText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
            />
            <button 
              onClick={async () => {
                const t = msgText.trim()
                if (!t) { showToast('Message is empty', 'error'); return }
                try {
                  await createNeighborhoodMessage(id, t)
                  setMsgText('')
                  messages.refetch()
                  showToast('Message sent', 'success')
                } catch (e: any) {
                  showToast(e?.message || 'Failed to send message', 'error')
                }
              }}
              className="mt-3 px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium"
            >
              Send Message
            </button>
          </div>
          {!messages.data || messages.data.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No messages yet.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {messages.data.map((m) => (
                <div key={m.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <strong className="text-gray-800">{m.user_name || `User #${m.user}`}</strong>
                    <small className="text-gray-500">{formatDate(m.created_at)}</small>
                  </div>
                  <div className="text-gray-800 mb-3">{m.text}</div>
                  <div className="flex gap-3 items-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${m.approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {m.approved ? '✓ Approved' : '⏳ Pending approval'}
                    </span>
                    {hasAnyRole([ROLES.Admin, ROLES.SuperAdmin]) && (
                      <>
                        {m.approved ? (
                          <button 
                            onClick={async () => { 
                              try { 
                                await approveNeighborhoodMessage(id, m.id, false); 
                                messages.refetch(); 
                                showToast('Message unapproved', 'success') 
                              } catch (e: any) { 
                                showToast(e?.message || 'Failed to unapprove', 'error') 
                              } 
                            }}
                            className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm font-medium"
                          >
                            Unapprove
                          </button>
                        ) : (
                          <button 
                            onClick={async () => { 
                              try { 
                                await approveNeighborhoodMessage(id, m.id, true); 
                                messages.refetch(); 
                                showToast('Message approved', 'success') 
                              } catch (e: any) { 
                                showToast(e?.message || 'Failed to approve', 'error') 
                              } 
                            }}
                            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm font-medium"
                          >
                            Approve
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
