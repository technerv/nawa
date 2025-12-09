import { Link, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CategoriesPage from './pages/CategoriesPage'
import ReportsPage from './pages/ReportsPage'
import MapPage from './pages/MapPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RequireAuth from './components/RequireAuth'
import DashboardPage from './pages/DashboardPage'
import PublicDashboardPage from './pages/PublicDashboardPage'
import ReportForm from './pages/ReportForm'
import PublicMapPage from './pages/PublicMapPage'
import MapboxPreviewPage from './pages/MapboxPreviewPage'
import TrackCasePage from './pages/TrackCasePage'
import AdminAlertsPage from './pages/AdminAlertsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import NeighborhoodJoinPage from './pages/NeighborhoodJoinPage'
import { initCountyAliases, areAliasesReady, getAliasSource } from './lib/normalizeCounty'
import MyNeighborhoodPage from './pages/MyNeighborhoodPage'
import NeighborhoodDetailPage from './pages/NeighborhoodDetailPage'
import WelcomePage from './pages/WelcomePage'
import { useEffect as useEffect2 } from 'react'
import { sendSOS } from './api/alerts'
import { API_BASE_URL } from './api/axios'

export default function App() {
	const [roles, setRoles] = useState<string[] | null>(null)
	const [username, setUsername] = useState<string | null>(null)
	const [aliasesReady, setAliasesReady] = useState<boolean>(true)
	const [aliasSource, setAliasSource] = useState<'fetched' | 'cached' | 'none'>('none')
    const loc = useLocation()
    const navigate = useNavigate()
    function A({ to, children }: { to: string; children: any }) {
        const active = loc.pathname === to
        return (
            <Link to={to} style={{
                padding: '8px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: active ? 700 : 500,
                background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                border: '1px solid',
                borderColor: active ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.12)',
                color: '#e5e7eb'
            }}>{children}</Link>
        )
    }

	useEffect(() => {
		async function load() {
			const token = localStorage.getItem('access_token')
			if (!token) {
				setRoles([])
				setUsername(null)
				return
			}
			try {
				const raw = localStorage.getItem('roles')
				if (raw) {
					const cached = JSON.parse(raw)
					if (Array.isArray(cached)) setRoles(cached)
				}
			} catch {}
			try {
				const res = await fetch((import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api') + '/auth/me/', {
					headers: { Authorization: `Bearer ${token}` }
				})
				if (!res.ok) throw new Error('not ok')
				const data = await res.json()
				setRoles(data.roles || [])
				setUsername(data.username || null)
				try { localStorage.setItem('roles', JSON.stringify(data.roles || [])) } catch {}
			} catch {
				setRoles([])
				setUsername(null)
				try { localStorage.removeItem('roles') } catch {}
			}
		}
		load()

		// Initialize county aliases for better county UX in filters
		;(async () => {
			try {
				await initCountyAliases()
				setAliasesReady(areAliasesReady())
				setAliasSource(getAliasSource())
			} catch {
				setAliasesReady(false)
				setAliasSource(getAliasSource())
			}
		})()
		function onRolesUpdated(e: any) {
		const { roles: r, username: u } = (e && e.detail) || {}
		if (Array.isArray(r)) setRoles(r)
		if (u !== undefined) setUsername(u ?? null)
		}
		window.addEventListener('roles_updated', onRolesUpdated as any)
		return () => {
		window.removeEventListener('roles_updated', onRolesUpdated as any)
		}
		}, [])

    const [toasts, setToasts] = useState<{ id: number; text: string; type: 'success' | 'error' | 'info' }[]>([])
    const [sosOpen, setSosOpen] = useState(false)
    const [sosSending, setSosSending] = useState(false)
    const [sosHint, setSosHint] = useState<string | null>(null)
    const [emNums, setEmNums] = useState<{ name: string; number: string; tel: string }[]>([])
    const [sosPhone, setSosPhone] = useState('')
    const [sosCustomMessage, setSosCustomMessage] = useState('')
    const [sosPrefill, setSosPrefill] = useState<any | null>(null)

	function enqueueSOS(payload: any) {
		try {
			const raw = localStorage.getItem('sos_queue')
			const arr = raw ? JSON.parse(raw) : []
			arr.push({ ...payload, ts: Date.now() })
			localStorage.setItem('sos_queue', JSON.stringify(arr))
		} catch {}
	}

	async function flushSOSQueue() {
		try {
			const raw = localStorage.getItem('sos_queue')
			const arr = raw ? JSON.parse(raw) : []
			if (!Array.isArray(arr) || arr.length === 0) return
			const rest: any[] = []
			for (const item of arr) {
				try { await sendSOS(item) } catch { rest.push(item) }
			}
			localStorage.setItem('sos_queue', JSON.stringify(rest))
			if (arr.length !== rest.length) window.dispatchEvent(new CustomEvent('toast', { detail: { text: 'Queued SOS sent', type: 'success' } }))
		} catch {}
	}
    useEffect2(() => {
        function onToast(e: any) {
            const { text, type } = e.detail || {}
            const id = Date.now() + Math.random()
            setToasts((prev) => [...prev, { id, text: String(text || ''), type: type || 'info' }])
            setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
        }
        function onOpenSOS(e: any) {
            const d = e && e.detail || {}
            const payload = d && d.payload
            const message = d && d.message
            const phone = d && d.phone
            setSosPrefill(payload || null)
            if (typeof message === 'string') setSosCustomMessage(message)
            if (typeof phone === 'string') setSosPhone(phone)
            setSosOpen(true)
            ;(async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/public/emergency_numbers/`)
                    if (res.ok) {
                        const d2 = await res.json()
                        setEmNums(d2.results || [])
                        if (!(typeof phone === 'string' && phone.trim())) {
                            const first = (d2.results || [])[0]
                            const num = first && first.number
                            if (typeof num === 'string' && num.trim()) setSosPhone(num)
                        }
                    }
                } catch {}
            })()
        }
        function onSOSRequest(e: any) {
            const payload = (e && e.detail) || {}
            ;(async () => {
                try {
                    if (!navigator.onLine) {
                        enqueueSOS(payload)
                        window.dispatchEvent(new CustomEvent('toast', { detail: { text: 'Offline, SOS queued', type: 'info' } }))
                    } else {
                        await sendSOS(payload)
                        window.dispatchEvent(new CustomEvent('toast', { detail: { text: 'SOS sent', type: 'success' } }))
                    }
                } catch (err: any) {
                    window.dispatchEvent(new CustomEvent('toast', { detail: { text: String(err?.message || 'SOS failed'), type: 'error' } }))
                }
            })()
        }
        window.addEventListener('toast', onToast as any)
        window.addEventListener('online', () => { flushSOSQueue() })
        window.addEventListener('open_sos', onOpenSOS as any)
        window.addEventListener('sos_request', onSOSRequest as any)
        return () => {
            window.removeEventListener('toast', onToast as any)
            window.removeEventListener('open_sos', onOpenSOS as any)
            window.removeEventListener('sos_request', onSOSRequest as any)
        }
    }, [])

	function logout() {
		localStorage.removeItem('access_token')
		localStorage.removeItem('refresh_token')
		try { localStorage.removeItem('roles') } catch {}
		setRoles([])
		setUsername(null)
	}
	return (
		<div className="app-shell">
            {!(loc.pathname === '/' || loc.pathname === '/welcome') && (
                <header>
                    <div className="app-header-inner">
                        <h1 className="app-title">Neighbourhood Alert Watch App</h1>
                        <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            {roles && roles.length > 0 ? (
                                <>
                                    <A to="/dashboard">Dashboard</A>
                                    <A to="/categories">Categories</A>
                                    <A to="/reports">Report Incident</A>
                                    <A to="/map">Map</A>
                                    <A to="/mapbox/preview">Vector Map Preview</A>
                            {(roles.includes('Admin') || roles.includes('Dispatcher') || roles.includes('SuperAdmin')) && (
                                <A to="/admin/alerts">Alerts</A>
                            )}
                            {(roles.includes('Admin') || roles.includes('SuperAdmin')) && (
                                <A to="/admin/users">Users</A>
                            )}
                                    <A to="/neighborhood/join">Join Neighborhood</A>
                                    <A to="/neighborhood/mine">My Neighborhood</A>
                                    <span style={{ color: '#666', fontSize: 12, borderLeft: '1px solid #ddd', paddingLeft: 12 }}>
                                        {username} · {roles.join(', ')}
                                    </span>
                                    <button onClick={logout}>Logout</button>
                                </>
                            ) : (
                                <>
                                    <A to="/public/dashboard">Public Dashboard</A>
                                    <A to="/public/map">Public Map</A>
                                    <A to="/public/report">Report Incident</A>
                                    <A to="/public/track">Track Case</A>
                                </>
                            )}
                        </nav>
                    </div>
                </header>
            )}
			{!aliasesReady && (
				<div style={{ background: 'rgba(253,230,138,0.15)', borderBottom: '1px solid rgba(253,230,138,0.35)', color: '#fde68a' }}>
					<div style={{ maxWidth: 1100, margin: '0 auto', padding: 8, fontSize: 13 }}>
						County aliases not loaded ({aliasSource}). Filters may be less accurate.
						<button
							style={{ marginLeft: 8 }}
							onClick={async () => {
								try {
									await initCountyAliases()
									setAliasesReady(areAliasesReady())
									setAliasSource(getAliasSource())
								} catch {
									setAliasesReady(false)
									setAliasSource(getAliasSource())
								}
							}}
						>
							Retry
						</button>
					</div>
				</div>
			)}
            <main className="app-main">
                {roles && roles.length > 0 && !(loc.pathname === '/' || loc.pathname === '/welcome') && (
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 600 }}>Welcome{username ? `, ${username}` : ''}</div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ fontSize: 12, opacity: .8 }}>Roles: {roles?.join(', ')}</div>
                                {roles && roles.length > 0 && (
                                    <button onClick={logout}>Logout</button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <Routes>
                    <Route path="/" element={<WelcomePage />} />
                    <Route path="/public/dashboard" element={<PublicDashboardPage />} />
                    <Route path="/public/map" element={<PublicMapPage />} />
                    <Route path="/mapbox/preview" element={<MapboxPreviewPage />} />
                    <Route path="/public/report" element={<ReportForm />} />
                    <Route path="/public/track" element={<TrackCasePage />} />
                    <Route path="/welcome" element={<WelcomePage />} />
                    <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
                    <Route path="/categories" element={<RequireAuth><CategoriesPage /></RequireAuth>} />
                    <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
					<Route path="/map" element={<RequireAuth><MapPage /></RequireAuth>} />
					<Route path="/admin/alerts" element={<RequireAuth><AdminAlertsPage /></RequireAuth>} />
					<Route path="/admin/users" element={<RequireAuth><AdminUsersPage /></RequireAuth>} />
                    <Route path="/neighborhood/join" element={<RequireAuth><NeighborhoodJoinPage /></RequireAuth>} />
                    <Route path="/neighborhood/mine" element={<RequireAuth><MyNeighborhoodPage /></RequireAuth>} />
                    <Route path="/neighborhood/:id" element={<RequireAuth><NeighborhoodDetailPage /></RequireAuth>} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/register"
                        element={roles && (roles.includes('Admin') || roles.includes('SuperAdmin')) ? <RegisterPage /> : <Navigate to="/welcome" replace />}
                    />
                </Routes>
            </main>
            {!(loc.pathname === '/' || loc.pathname === '/welcome') && (
                <footer style={{ marginTop: 12, padding: 12, textAlign: 'center', color: '#9ca3af' }}>
                    © 2025 NAWA
                </footer>
            )}
            {!(loc.pathname === '/public/track' || loc.pathname === '/public/report') && (
                <div style={{ position: 'fixed', right: 16, top: 16, display: 'grid', gap: 8, zIndex: 10000 }}>
                    {toasts.map((t) => (
                        <div key={t.id} className="toast">
                            {t.text}
						</div>
					))}
				</div>
			)}
			<div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 10000 }}>
				<button
					style={{ width: 64, height: 64, borderRadius: 32, background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 14 }}
					onMouseDown={() => { setSosHint('Hold to send SOS'); setTimeout(() => setSosHint(null), 1200) }}
					onClick={async () => { setSosOpen(true); try { const res = await fetch(`${API_BASE_URL}/public/emergency_numbers/`); if (res.ok) { const d = await res.json(); setEmNums(d.results || []) } } catch {} }}
				>
					SOS
				</button>
			</div>
			{sosOpen && (
				<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 10001 }}>
						<div className="card" style={{ maxWidth: 420, width: '90%', padding: 16 }}>
						<div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
							<h3 style={{ margin: 0 }}>Emergency SOS</h3>
                            <div style={{ display: 'inline-flex', gap: 8 }}>
                                <button onClick={() => setSosOpen(false)}>Close</button>
                                <button onClick={() => { setSosOpen(false); try { navigate('/welcome') } catch {} }}>Quick Exit</button>
                            </div>
						</div>
						<p style={{ marginTop: 8 }}>Send a critical alert with your location.</p>
							<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
								{emNums.map((n, i) => (
									<a key={i} href={n.tel} style={{ padding: '6px 10px', background: '#1f2937', color: 'white', borderRadius: 6, textDecoration: 'none' }}>{n.name}: {n.number}</a>
								))}
							</div>
							<div style={{ display: 'grid', gap: 8 }}>
								<input placeholder="Phone number to notify (optional)" value={sosPhone} onChange={(e) => setSosPhone(e.target.value)} />
								{(sosPhone || '').trim() && (
									<a href={`tel:${(sosPhone || '').replace(/[^+\d]/g, '')}`} style={{ padding: '6px 10px', background: '#0f172a', color: 'white', borderRadius: 6, textDecoration: 'none', width: 'fit-content' }}>Call {sosPhone}</a>
								)}
								<textarea rows={2} placeholder="Message to send (optional)" value={sosCustomMessage} onChange={(e) => setSosCustomMessage(e.target.value)} />
                                <button disabled={sosSending} onClick={async () => {
                                    setSosSending(true)
                                    try {
                                        let lat: number | undefined
                                        let lon: number | undefined
                                        try {
                                            await new Promise<void>((resolve) => {
                                                navigator.geolocation.getCurrentPosition((pos) => {
                                                    lat = pos.coords.latitude
                                                    lon = pos.coords.longitude
                                                    resolve()
                                                }, () => resolve(), { enableHighAccuracy: true, timeout: 10000 })
                                            })
                                        } catch {}
                                        const useLat = (sosPrefill && typeof sosPrefill.latitude === 'number') ? sosPrefill.latitude : lat
                                        const useLon = (sosPrefill && typeof sosPrefill.longitude === 'number') ? sosPrefill.longitude : lon
                                        const payload: any = {
                                            ...(sosPrefill || {}),
                                            latitude: useLat,
                                            longitude: useLon,
                                            location_name: (sosPrefill && sosPrefill.location_name) || (useLat != null && useLon != null ? `GPS ${Number(useLat).toFixed(5)}, ${Number(useLon).toFixed(5)}` : undefined)
                                        }
                                        const phone = (sosPhone || '').trim()
                                        if (phone) payload.notify_phone = phone
                                        const msg = (sosCustomMessage || '').trim()
                                        if (msg) payload.notify_message = msg
                                        if (!navigator.onLine) {
                                            enqueueSOS(payload)
                                            window.dispatchEvent(new CustomEvent('toast', { detail: { text: 'Offline, SOS queued', type: 'info' } }))
                                        } else {
                                            await sendSOS(payload)
                                            window.dispatchEvent(new CustomEvent('toast', { detail: { text: 'SOS sent', type: 'success' } }))
                                        }
                                        setSosOpen(false)
                                        setSosPhone('')
                                        setSosCustomMessage('')
                                        setSosPrefill(null)
                                    } catch (e: any) {
                                        window.dispatchEvent(new CustomEvent('toast', { detail: { text: String(e?.message || 'SOS failed'), type: 'error' } }))
                                    } finally {
                                        setSosSending(false)
                                    }
                                }}>Send SOS</button>
								<small style={{ color: '#cbd5e1' }}>{sosHint || ''}</small>
							</div>
						</div>
					</div>
				)}
		</div>
	)
}
