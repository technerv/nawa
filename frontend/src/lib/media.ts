import { API_BASE_URL } from '../api/axios'

// Derive backend origin from API base (strip trailing /api)
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '/')

export function resolveMediaUrl(pathOrUrl?: string | null): string | null {
	if (!pathOrUrl) return null
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
	// Ensure no duplicate slashes
	if (pathOrUrl.startsWith('/')) {
		return API_ORIGIN.replace(/\/+$/, '') + pathOrUrl
	}
	return API_ORIGIN.replace(/\/+$/, '') + '/' + pathOrUrl
}

