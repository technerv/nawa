import { FormEvent, useState } from 'react'
import { enqueueAlert, retryFailedAlerts } from '../api/alerts'
import { hasAnyRole, ROLES } from '../lib/roles'
import { showToast } from '../lib/toast'

export default function AdminAlertsPage() {
  const [incidentId, setIncidentId] = useState<number | undefined>()
  const [eventType, setEventType] = useState('created')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const canUse = hasAnyRole([ROLES.Admin, ROLES.Dispatcher, ROLES.SuperAdmin])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!incidentId) return
    setStatus('sending')
    try {
      const res = await enqueueAlert({ incident_id: incidentId, event_type: eventType, note: note || undefined })
      setStatus(`enqueued:${res.event_id}`)
      showToast('Alert enqueued', 'success')
    } catch (err: any) {
      setStatus(err?.response?.data?.detail || 'enqueue_failed')
      showToast('Enqueue failed', 'error')
    }
  }

  async function retry() {
    setStatus('retrying')
    try {
      const res = await retryFailedAlerts()
      setStatus(res.detail)
      showToast('Retry triggered', 'success')
    } catch (err: any) {
      setStatus(err?.response?.data?.detail || 'retry_failed')
      showToast('Retry failed', 'error')
    }
  }

  return (
    <div>
      <h2>Admin Alerts</h2>
      {!canUse && <p style={{ color: '#666' }}>You do not have permission to manage alerts.</p>}
      {canUse && (
        <div className="card">
          <form onSubmit={submit} className="row mb-3">
            <input name="incident_id" type="number" placeholder="Incident ID" value={incidentId ?? ''} onChange={(e) => setIncidentId(e.target.value ? Number(e.target.value) : undefined)} />
            <select name="event_type" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="created">created</option>
              <option value="status_changed">status_changed</option>
              <option value="escalated">escalated</option>
              <option value="resolved">resolved</option>
            </select>
            <input name="note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className="btn-primary">Enqueue</button>
            <button type="button" onClick={retry}>Retry Failed</button>
          </form>
          {status && <p>Status: {status}</p>}
        </div>
      )}
    </div>
  )
}
