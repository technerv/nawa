import { api } from './axios'

export async function enqueueAlert(payload: { incident_id: number; event_type: string; note?: string }) {
  const res = await api.post<{ event_id: number }>('/alertevent/enqueue/', payload)
  return res.data
}

export async function retryFailedAlerts() {
  const res = await api.post<{ detail: string }>('/alertevent/retry_failed/', {})
  return res.data
}

export async function subscribeAlerts(payload: { county?: string; channel?: 'sms' | 'email' | 'push' }) {
  const res = await api.post<{ id: number; detail: string }>('/alerts/subscribe/', payload)
  return res.data
}

export async function listSubscriptions() {
  const res = await api.get<{ results: { id: number; county?: string | null; channel: string; enabled: boolean }[] }>('/alerts/subscribe/')
  return res.data
}

export async function unsubscribeAlert(id: number) {
  const res = await api.delete<{ detail: string }>('/alerts/subscribe/', { data: { id } })
  return res.data
}
