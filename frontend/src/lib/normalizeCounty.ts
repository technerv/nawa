// The frontend will not ship a static alias fallback anymore.
// Aliases must be fetched from the backend at runtime (force-fetch).
// This makes the client dependent on the backend alias service being reachable.
// RUNTIME_COUNTY_ALIASES is empty until `initCountyAliases()` populates it.
let RUNTIME_COUNTY_ALIASES: Record<string, string> = {}
let ALIASES_READY = false
let LAST_ALIAS_SOURCE: 'fetched' | 'cached' | 'none' = 'none'

const STORAGE_KEY = 'nawa_aliases_v1'
const STORAGE_ETAG_KEY = 'nawa_aliases_etag_v1'

/**
 * Initialize county aliases by fetching from backend `/api/county_aliases/`.
 * This is non-blocking; callers may still use normalizeCountyName immediately.
 */
import { API_BASE_URL } from '../api/axios'

export async function initCountyAliases(): Promise<void> {
	ALIASES_READY = false
	LAST_ALIAS_SOURCE = 'none'
    const url = `${API_BASE_URL}/county_aliases/`

	const maxAttempts = 3 // initial try + 2 retries
	const timeoutMs = Number(import.meta.env.VITE_ALIAS_FETCH_TIMEOUT_MS ?? 10000)

	// helper to load cached map from localStorage
	const loadCached = (): boolean => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY)
			if (!raw) return false
			const parsed = JSON.parse(raw)
			if (!parsed || typeof parsed !== 'object') return false
			RUNTIME_COUNTY_ALIASES = {}
			Object.keys(parsed).forEach((k) => {
				if (!k) return
				RUNTIME_COUNTY_ALIASES[k.toLowerCase()] = parsed[k]
			})
			ALIASES_READY = true
			LAST_ALIAS_SOURCE = 'cached'
			return true
		} catch (e) {
			return false
		}
	}

	// If no network, but cached exists, we may use it as fallback at the end
	let lastError: unknown = null
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const controller = new AbortController()
		const to = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 10000)
		try {
			const headers: Record<string, string> = {}
			const storedEtag = localStorage.getItem(STORAGE_ETAG_KEY)
			if (storedEtag) headers['If-None-Match'] = storedEtag
			const res = await fetch(url, { signal: controller.signal, headers })
			clearTimeout(to)

			if (res.status === 304) {
				// Server indicates not modified; load cached map
				if (loadCached()) return
				// No cached map available, continue to next attempt
				lastError = new Error('ETag matched but no cached map available')
				continue
			}

			if (!res.ok) {
				lastError = new Error(`Fetch failed: ${res.status}`)
				// fall through to retry
				throw lastError
			}

			const data = await res.json()
			const map = data && data.aliases ? data.aliases : (typeof data === 'object' ? data : null)
			if (!map) {
				lastError = new Error('Invalid alias payload')
				throw lastError
			}

			// Save to localStorage (both map and etag)
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
				const respEtag = res.headers.get('ETag') || (data && data.version) || ''
				if (respEtag) localStorage.setItem(STORAGE_ETAG_KEY, respEtag)
			} catch (e) {
				// ignore storage errors
			}

			// Populate runtime aliases normalized to lowercase keys
			RUNTIME_COUNTY_ALIASES = {}
			Object.keys(map).forEach((k) => {
				if (!k) return
				RUNTIME_COUNTY_ALIASES[k.toLowerCase()] = map[k]
			})
			ALIASES_READY = true
			LAST_ALIAS_SOURCE = 'fetched'
			return
		} catch (e) {
			clearTimeout(to)
			lastError = e
			// exponential backoff before next attempt
			if (attempt < maxAttempts) {
				const backoff = 200 * Math.pow(2, attempt - 1)
				await new Promise((r) => setTimeout(r, backoff))
				continue
			}
		}
	}

	// All attempts failed: try to load cached as a last resort
	if (loadCached()) return

	// If no cached map, surface the last error to caller
	ALIASES_READY = false
	LAST_ALIAS_SOURCE = 'none'
	throw lastError
}

export function getAliasSource(): 'fetched' | 'cached' | 'none' {
	return LAST_ALIAS_SOURCE
}

export function areAliasesReady(): boolean {
	return ALIASES_READY
}

export function normalizeCountyName(name?: string | null): string {
	if (!name) return ''
	let key = String(name).trim()
	if (!key) return ''
	// remove trailing ' County' if present
	key = key.replace(/\s+county$/i, '')
	const lookup = key.toLowerCase().replace(/\s+/g, ' ').trim()
	if (RUNTIME_COUNTY_ALIASES[lookup]) {
		return RUNTIME_COUNTY_ALIASES[lookup]
	}
	// If aliases are not ready, do not fall back to shipped static map — keep a minimal title-case fallback
	// This preserves readable URLs while making it explicit that canonical mapping depends on backend.
	key = key.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
	if (key !== 'Unknown' && !key.endsWith('County')) {
		key = `${key} County`
	}
	return key
}
