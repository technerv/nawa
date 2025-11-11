import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

export const api = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: false
})

api.interceptors.request.use((config) => {
	const token = localStorage.getItem('access_token')
	if (token) {
		config.headers = config.headers ?? {}
		;(config.headers as any)['Authorization'] = `Bearer ${token}`
	}
	return config
})

api.interceptors.response.use(
	(response) => response,
	async (error) => {
		// Handle 401 Unauthorized - try to refresh token
		if (error.response?.status === 401) {
			const refreshToken = localStorage.getItem('refresh_token')
			if (refreshToken) {
				try {
					const refreshResponse = await axios.post(
						`${API_BASE_URL}/auth/refresh/`,
						{ refresh: refreshToken }
					)
					const newAccessToken = refreshResponse.data.access
					localStorage.setItem('access_token', newAccessToken)
					// Retry the original request with new token
					error.config.headers['Authorization'] = `Bearer ${newAccessToken}`
					return api.request(error.config)
				} catch (refreshError) {
					// Refresh failed, clear tokens and redirect to login
					localStorage.removeItem('access_token')
					localStorage.removeItem('refresh_token')
					localStorage.removeItem('roles')
					if (window.location.pathname !== '/login') {
						window.location.href = '/login'
					}
				}
			} else {
				// No refresh token, redirect to login
				if (window.location.pathname !== '/login') {
					window.location.href = '/login'
				}
			}
		}
		// Surface meaningful message
		if (error.response) {
			console.error('API error:', error.response.status, error.response.data)
		} else {
			console.error('Network error:', error.message)
		}
		return Promise.reject(error)
	}
)
