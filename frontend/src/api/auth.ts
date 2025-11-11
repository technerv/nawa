import { api } from './axios'

export interface JwtTokens {
	access: string
	refresh: string
}

export interface MeResponse {
	id: number
	username: string
	email: string
	first_name: string
	last_name: string
	roles: string[]
}

export async function login(username: string, password: string) {
	const res = await api.post<JwtTokens>('/auth/login/', { username, password })
	return res.data
}

export async function me() {
	const res = await api.get<MeResponse>('/auth/me/')
	return res.data
}

export async function registerUser(payload: { username: string; password: string; email?: string; role?: string }) {
	const res = await api.post('/auth/register/', payload)
	return res.data as { access: string; refresh: string; user: MeResponse }
}

