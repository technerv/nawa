import { api } from './axios'

export interface Neighborhood {
  id: number
  name: string
  center_lat?: number
  center_lon?: number
  invite_code?: string
  polygon?: any
}

export async function listNeighborhoods() {
  const res = await api.get<{ results: Neighborhood[]; count: number; next?: string; previous?: string }>('/neighborhood/')
  return res.data
}

export async function joinNeighborhood(id: number, invite_code?: string) {
  const res = await api.post(`/neighborhood/${id}/join/`, { invite_code })
  return res.data as { id: number; role: string }
}

export async function myMemberships() {
  const res = await api.get('/neighborhood/my/')
  return res.data as { id: number; neighborhood: number; user: number; role: string; joined_at: string }[]
}

export async function listNeighborhoodAlerts(id: number) {
  const res = await api.get(`/neighborhood/${id}/alerts/`)
  return res.data as any[]
}

export async function getNeighborhood(id: number) {
  const res = await api.get<Neighborhood>(`/neighborhood/${id}/`)
  return res.data
}

export async function neighborhoodAlertCounts(params?: { days?: number }) {
  const res = await api.get<{ results: { id: number; count: number }[] }>(`/neighborhood/alerts_counts/`, { params })
  return res.data
}

export async function leaveNeighborhood(id: number) {
  const res = await api.post(`/neighborhood/${id}/leave/`, {})
  return res.data as { detail: string }
}

export async function updateNeighborhoodPolygon(id: number, polygon: any) {
  const res = await api.patch<Neighborhood>(`/neighborhood/${id}/`, { polygon })
  return res.data
}

export async function listNeighborhoodMessages(id: number) {
  const res = await api.get<{ id: number; neighborhood: number; user: number; user_name?: string | null; text: string; approved: boolean; created_at: string }[]>(`/neighborhood/${id}/messages/`)
  return res.data
}

export async function createNeighborhoodMessage(id: number, text: string) {
  const res = await api.post<{ id: number; neighborhood: number; user: number; user_name?: string | null; text: string; approved: boolean; created_at: string }>(`/neighborhood/${id}/messages/`, { text })
  return res.data
}

export async function approveNeighborhoodMessage(id: number, message_id: number, approved: boolean = true) {
  const res = await api.post<{ id: number; neighborhood: number; user: number; user_name?: string | null; text: string; approved: boolean; created_at: string }>(`/neighborhood/${id}/messages/approve/`, { message_id, approved })
  return res.data
}
