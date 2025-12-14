import { FormEvent, useState } from 'react'
import { enqueueAlert, retryFailedAlerts } from '../api/alerts'
import { hasAnyRole, ROLES } from '../lib/roles'
import { showToast } from '../lib/toast'

export default function AdminAlertsPage() {
  const [incidentId, setIncidentId] = useState<number | undefined>()
  const [eventType, setEventType] = useState('created')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const canUse = hasAnyRole([ROLES.SuperAdmin, ROLES.SecurityOrgUser, ROLES.Admin, ROLES.Dispatcher])

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

  async function testNotify() {
    setStatus('testing')
    try {
      if (!incidentId) { setStatus('need_incident_id'); return }
      const res = await enqueueAlert({ incident_id: incidentId, event_type: 'created', note: 'test notify' })
      setStatus(`enqueued:${res.event_id}`)
      showToast('Test notify enqueued', 'success')
    } catch (err: any) {
      setStatus(err?.response?.data?.detail || 'test_failed')
      showToast('Test notify failed', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">Admin Alerts</h2>
        <p className="text-gray-100 text-sm">Manage and enqueue alert notifications</p>
      </div>
      {!canUse && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">You do not have permission to manage alerts.</p>
        </div>
      )}
      {canUse && (
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Enqueue Alert</h3>
          <form onSubmit={submit} className="grid gap-4 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Incident ID <span className="text-red-500">*</span></label>
                <input 
                  name="incident_id" 
                  type="number" 
                  placeholder="Incident ID" 
                  value={incidentId ?? ''} 
                  onChange={(e) => setIncidentId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select 
                  name="event_type" 
                  value={eventType} 
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                >
                  <option value="created">Created</option>
                  <option value="status_changed">Status Changed</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <input 
                name="note" 
                placeholder="Note (optional)" 
                value={note} 
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <button 
                type="submit" 
                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium"
              >
                Enqueue
              </button>
              <button 
                type="button" 
                onClick={retry}
                className="px-6 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-medium"
              >
                Retry Failed
              </button>
              <button 
                type="button" 
                onClick={testNotify}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
              >
                Test Notify
              </button>
            </div>
            {status && (
              <div className={`p-3 rounded-md ${status.includes('failed') || status.includes('need_') ? 'bg-red-50 border border-red-200' : status.includes('enqueued') || status.includes('retrying') ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-sm font-medium ${status.includes('failed') || status.includes('need_') ? 'text-red-800' : status.includes('enqueued') || status.includes('retrying') ? 'text-green-800' : 'text-gray-800'}`}>
                  Status: <span className="font-normal">{status}</span>
                </p>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
