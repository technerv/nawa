import { Link, NavLink, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CategoriesPage from './pages/CategoriesPage'
import ReportsPage from './pages/ReportsPage'
import CreateCrimeReportPage from './pages/CreateCrimeReportPage'
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

const ROLES = {
	User: 'User',
	Admin: 'Admin',
	SuperAdmin: 'SuperAdmin',
	Dispatcher: 'Dispatcher',
}

const hasAnyRole = (userRoles: string[] | null, requiredRoles: string[]): boolean => {
	if (!userRoles) {
		return false
	}
	return userRoles.some(role => requiredRoles.includes(role))
}

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
    
    // Styled NavLink component for navigation
    function StyledNavLink({ to, children }: { to: string; children: any }) {
        return (
            <NavLink
                to={to}
                className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                            ? 'bg-white bg-opacity-20 text-white font-bold'
                            : 'bg-white bg-opacity-5 text-gray-300 hover:bg-opacity-10'
                    }`
                }
            >
                {children}
            </NavLink>
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
		<div className="min-h-screen bg-light">
			{!(loc.pathname === '/' || loc.pathname === '/welcome') && (
				<header className="bg-primary shadow">
					<div className="container mx-auto px-4">
						<div className="flex items-center justify-between h-16">
							<h1 className="text-white text-xl font-bold">
								Neighbourhood Alert Watch
							</h1>
							<nav className="flex items-center space-x-4">
								{roles && roles.length > 0 ? (
									<>
										<StyledNavLink to="/dashboard">Dashboard</StyledNavLink>
										<StyledNavLink to="/categories">Categories</StyledNavLink>
										<StyledNavLink to="/reports/create">Create Report</StyledNavLink>
										<StyledNavLink to="/reports">Reports</StyledNavLink>
										<StyledNavLink to="/map">Map</StyledNavLink>
										<StyledNavLink to="/mapbox/preview">Vector Map Preview</StyledNavLink>
										{(roles.includes('Admin') ||
											roles.includes('Dispatcher') ||
											roles.includes('SuperAdmin')) && (
											<StyledNavLink to="/admin/alerts">Alerts</StyledNavLink>
										)}
										{(roles.includes('Admin') ||
											roles.includes('SuperAdmin')) && (
											<StyledNavLink to="/admin/users">Users</StyledNavLink>
										)}
										<StyledNavLink to="/neighborhood/join">Join Neighborhood</StyledNavLink>
										<StyledNavLink to="/neighborhood/mine">My Neighborhood</StyledNavLink>
										<div className="flex items-center space-x-2 text-gray-400 text-xs border-l border-gray-600 pl-4 ml-2">
											<span>{username}</span>
											<span>·</span>
											<span>{roles.join(', ')}</span>
										</div>
										<button
											onClick={logout}
											className="px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
										>
											Logout
										</button>
									</>
								) : (
									<>
										<StyledNavLink to="/public/dashboard">Public Dashboard</StyledNavLink>
										<StyledNavLink to="/public/map">Public Map</StyledNavLink>
										<StyledNavLink to="/public/report">Report Incident</StyledNavLink>
										<StyledNavLink to="/public/track">Track Case</StyledNavLink>
									</>
								)}
							</nav>
						</div>
					</div>
				</header>
			)}
			{!aliasesReady && (
				<div className="bg-yellow-100 border-b border-yellow-200 text-yellow-800">
					<div className="container mx-auto px-4 py-2 text-sm">
						County aliases not loaded ({aliasSource}). Filters may be less
						accurate.
						<button
							className="ml-4 px-2 py-1 rounded-md bg-yellow-200 text-yellow-800 hover:bg-yellow-300"
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
			<main className="container mx-auto px-4 py-8">
				{roles &&
					roles.length > 0 &&
					!(loc.pathname === '/' || loc.pathname === '/welcome') && (
						<div className="bg-white rounded-lg shadow p-4 mb-6">
							<div className="flex justify-between items-center">
								<div className="font-semibold">
									Welcome{username ? `, ${username}` : ''}
								</div>
								<div className="text-sm text-gray-500">
									Roles: {roles?.join(', ')}
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
					<Route
						path="/dashboard"
						element={
							<RequireAuth>
								<DashboardPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/categories"
						element={
							<RequireAuth>
								<CategoriesPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/reports"
						element={
							<RequireAuth>
								<ReportsPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/reports/create"
						element={
							<RequireAuth>
								<CreateCrimeReportPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/map"
						element={
							<RequireAuth>
								<MapPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/admin/alerts"
						element={
							<RequireAuth>
								<AdminAlertsPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/admin/users"
						element={
							<RequireAuth>
								<AdminUsersPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/neighborhood/join"
						element={
							<RequireAuth>
								<NeighborhoodJoinPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/neighborhood/mine"
						element={
							<RequireAuth>
								<MyNeighborhoodPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/neighborhood/:id"
						element={
							<RequireAuth>
								<NeighborhoodDetailPage />
							</RequireAuth>
						}
					/>
					<Route path="/login" element={<LoginPage />} />
					<Route
						path="/register"
						element={
							roles &&
							(roles.includes('Admin') || roles.includes('SuperAdmin')) ? (
								<RegisterPage />
							) : (
								<Navigate to="/welcome" replace />
							)
						}
					/>
				</Routes>
			</main>
			{!(loc.pathname === '/' || loc.pathname === '/welcome') && (
				<footer className="text-center py-4 text-gray-500">
					© 2025 NAWA
				</footer>
			)}
			{!(
				loc.pathname === '/public/track' || loc.pathname === '/public/report'
			) && (
				<div className="fixed top-4 right-4 grid gap-2 z-50">
					{toasts.map(t => {
						// Parse toast text to detect county notifications like "Kitui County — 2 incidents"
						const countyMatch = t.text.match(/^(.+?)\s*—\s*(\d+)\s+incident/i)
						const isClickable = countyMatch !== null
						const countyName = countyMatch ? countyMatch[1].trim() : null
						
						return (
							<div
								key={t.id}
								className={`bg-primary text-white px-4 py-2 rounded-md shadow-lg ${
									isClickable ? 'cursor-pointer hover:bg-secondary transition-colors' : ''
								}`}
								onClick={isClickable ? () => {
									if (countyName) {
										navigate(`/reports?county=${encodeURIComponent(countyName)}`)
									}
								} : undefined}
								title={isClickable ? `Click to view incidents in ${countyName}` : undefined}
							>
								{t.text}
							</div>
						)
					})}
				</div>
			)}
			<div className="fixed bottom-4 right-4 z-50">
				<button
					className="w-16 h-16 rounded-full bg-red-600 text-white font-bold text-lg shadow-lg"
					onMouseDown={() => {
						setSosHint('Hold to send SOS')
						setTimeout(() => setSosHint(null), 1200)
					}}
					onClick={async () => {
						setSosOpen(true)
						try {
							const res = await fetch(
								`${API_BASE_URL}/public/emergency_numbers/`
							)
							if (res.ok) {
								const d = await res.json()
								setEmNums(d.results || [])
							}
						} catch {}
					}}
				>
					SOS
				</button>
			</div>
			{sosOpen && (
				<div 
					className="fixed inset-0 bg-black bg-opacity-60 grid place-items-center sos-modal-overlay" 
					style={{ zIndex: 10000, position: 'fixed' }}
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setSosOpen(false)
						}
					}}
				>
					<div 
						className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4 sos-modal-content"
						style={{ zIndex: 10001 }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-xl font-bold text-gray-800">Emergency SOS</h3>
							<div className="flex space-x-2">
								<button
									onClick={() => setSosOpen(false)}
									className="px-3 py-1 rounded-md text-sm font-medium bg-gray-200 hover:bg-gray-300 transition-colors"
								>
									Close
								</button>
								<button
									onClick={() => {
										setSosOpen(false)
										try {
											navigate('/welcome')
										} catch {}
									}}
									className="px-3 py-1 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
								>
									Quick Exit
								</button>
							</div>
						</div>
						<p className="mb-4 text-gray-600">
							Send a critical alert with your location.
						</p>
						{emNums.length > 0 && (
							<div className="mb-4">
								<label className="block text-sm font-medium text-gray-700 mb-2">Emergency Numbers</label>
								<div className="flex flex-wrap gap-2">
									{emNums.map((n, i) => (
										<a
											key={i}
											href={n.tel}
											className="px-3 py-2 bg-primary text-white rounded-md text-sm hover:bg-secondary transition-colors font-medium"
										>
											{n.name}: {n.number}
										</a>
									))}
								</div>
							</div>
						)}
						<div className="grid gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Phone number to notify (optional)</label>
								<input
									placeholder="Enter phone number"
									value={sosPhone}
									onChange={e => setSosPhone(e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
								/>
							</div>
							{(sosPhone || '').trim() && (
								<a
									href={`tel:${(sosPhone || '').replace(/[^+\d]/g, '')}`}
									className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm w-fit hover:bg-blue-700 transition-colors font-medium"
								>
									Call {sosPhone}
								</a>
							)}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Message to send (optional)</label>
								<textarea
									rows={3}
									placeholder="Enter your message"
									value={sosCustomMessage}
									onChange={e => setSosCustomMessage(e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
								/>
							</div>
							<button
								disabled={sosSending}
								onClick={async () => {
									setSosSending(true)
									try {
										let lat: number | undefined
										let lon: number | undefined
										try {
											await new Promise<void>(resolve => {
												navigator.geolocation.getCurrentPosition(
													pos => {
														lat = pos.coords.latitude
														lon = pos.coords.longitude
														resolve()
													},
													() => resolve(),
													{ enableHighAccuracy: true, timeout: 10000 }
												)
											})
										} catch {}
										const useLat =
											sosPrefill && typeof sosPrefill.latitude === 'number'
												? sosPrefill.latitude
												: lat
										const useLon =
											sosPrefill && typeof sosPrefill.longitude === 'number'
												? sosPrefill.longitude
												: lon
										const payload: any = {
											...(sosPrefill || {}),
											latitude: useLat,
											longitude: useLon,
											location_name:
												(sosPrefill && sosPrefill.location_name) ||
												(useLat != null && useLon != null
													? `GPS ${Number(useLat).toFixed(5)}, ${Number(
															useLon
													  ).toFixed(5)}`
													: undefined),
										}
										const phone = (sosPhone || '').trim()
										if (phone) payload.notify_phone = phone
										const msg = (sosCustomMessage || '').trim()
										if (msg) payload.notify_message = msg
										if (!navigator.onLine) {
											enqueueSOS(payload)
											window.dispatchEvent(
												new CustomEvent('toast', {
													detail: {
														text: 'Offline, SOS queued',
														type: 'info',
													},
												})
											)
										} else {
											await sendSOS(payload)
											window.dispatchEvent(
												new CustomEvent('toast', {
													detail: { text: 'SOS sent', type: 'success' },
												})
											)
										}
										setSosOpen(false)
										setSosPhone('')
										setSosCustomMessage('')
										setSosPrefill(null)
									} catch (e: any) {
										window.dispatchEvent(
											new CustomEvent('toast', {
												detail: {
													text: String(e?.message || 'SOS failed'),
													type: 'error',
												},
											})
										)
									} finally {
										setSosSending(false)
									}
								}}
								className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{sosSending ? 'Sending...' : 'Send SOS'}
							</button>
							{sosHint && <small className="text-gray-500 text-center">{sosHint}</small>}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}