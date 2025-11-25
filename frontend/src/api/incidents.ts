export async function createIncident(payload: any, token?: string) {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'
  const res = await fetch(`${base}/incidents/`, {
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
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${base}/incidents/${qs ? '?' + qs : ''}`)
  return res.json()
}
