import { API_BASE_URL } from './axios'

export async function createIncident(payload: any, token?: string) {
  const res = await fetch(`${API_BASE_URL}/incidents/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function listIncidents(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${API_BASE_URL}/incidents/${qs ? '?' + qs : ''}`)
  return res.json()
}
