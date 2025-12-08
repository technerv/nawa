import { Link, Route, Routes, Navigate, useLocation } from 'react-router-dom'
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
import AdminAlertsPage from './pages/AdminAlertsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import NeighborhoodJoinPage from './pages/NeighborhoodJoinPage'
import { initCountyAliases, areAliasesReady, getAliasSource } from './lib/normalizeCounty'
import MyNeighborhoodPage from './pages/MyNeighborhoodPage'
import NeighborhoodDetailPage from './pages/NeighborhoodDetailPage'
import { useEffect as useEffect2 } from 'react'

export default function App() {
	const [roles, setRoles] = useState<string[] | null>(null)
	const [username, setUsername] = useState<string | null>(null)
	const [aliasesReady, setAliasesReady] = useState<boolean>(true)
	const [aliasSource, setAliasSource] = useState<'fetched' | 'cached' | 'none'>('none')
    const loc = useLocation()
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
	useEffect2(() => {
		function onToast(e: any) {
			const { text, type } = e.detail || {}
			const id = Date.now() + Math.random()
			setToasts((prev) => [...prev, { id, text: String(text || ''), type: type || 'info' }])
			setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
		}
		window.addEventListener('toast', onToast as any)
		return () => window.removeEventListener('toast', onToast as any)
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
                                <A to="/login">Login</A>
                                <A to="/register">Register</A>
                            </>
                        )}
					</nav>
				</div>
			</header>
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
				<div className="card" style={{ marginBottom: 16 }}>
					<div className="row" style={{ justifyContent: 'space-between' }}>
						<div style={{ fontWeight: 600 }}>Welcome{username ? `, ${username}` : ''}</div>
						<div style={{ fontSize: 12, opacity: .8 }}>Roles: {roles?.join(', ') || 'Guest'}</div>
					</div>
				</div>
				<Routes>
					<Route path="/" element={<Navigate to="/categories" replace />} />
					<Route path="/public/dashboard" element={<PublicDashboardPage />} />
                    <Route path="/public/map" element={<PublicMapPage />} />
                    <Route path="/public/report" element={<ReportForm />} />
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
					<Route path="/register" element={<RegisterPage />} />
				</Routes>
			</main>
			<div style={{ position: 'fixed', right: 16, top: 16, display: 'grid', gap: 8, zIndex: 10000 }}>
				{toasts.map((t) => (
					<div key={t.id} className="toast">
						{t.text}
					</div>
				))}
			</div>
		</div>
	)
}
