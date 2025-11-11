import { Link, Route, Routes, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CategoriesPage from './pages/CategoriesPage'
import ReportsPage from './pages/ReportsPage'
import MapPage from './pages/MapPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RequireAuth from './components/RequireAuth'
import DashboardPage from './pages/DashboardPage'
import PublicDashboardPage from './pages/PublicDashboardPage'
import PublicMapPage from './pages/PublicMapPage'

export default function App() {
	const [roles, setRoles] = useState<string[] | null>(null)
	const [username, setUsername] = useState<string | null>(null)

	useEffect(() => {
		async function load() {
			const token = localStorage.getItem('access_token')
			if (!token) {
				setRoles([])
				setUsername(null)
				return
			}
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
	}, [])

	function logout() {
		localStorage.removeItem('access_token')
		localStorage.removeItem('refresh_token')
		try { localStorage.removeItem('roles') } catch {}
		setRoles([])
		setUsername(null)
	}
	return (
		<div style={{ minHeight: '100vh', background: '#fafafa', color: '#222' }}>
			<header style={{ background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
				<div style={{ maxWidth: 960, margin: '0 auto', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<h1 style={{ margin: 0, fontSize: 20 }}>Neighbourhood Alert Watch App</h1>
					<nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
						{roles && roles.length > 0 ? (
							<>
								<Link to="/dashboard">Dashboard</Link>
								<Link to="/categories">Categories</Link>
								<Link to="/reports">Reports</Link>
								<Link to="/map">Map</Link>
								<span style={{ color: '#666', fontSize: 12, borderLeft: '1px solid #ddd', paddingLeft: 12 }}>
									{username} · {roles.join(', ')}
								</span>
								<button onClick={logout}>Logout</button>
							</>
						) : (
							<>
								<Link to="/public/dashboard">Public Dashboard</Link>
								<Link to="/public/map">Public Map</Link>
								<Link to="/login">Login</Link>
								<Link to="/register">Register</Link>
							</>
						)}
					</nav>
				</div>
			</header>
			<main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
				<Routes>
					<Route path="/" element={<Navigate to="/categories" replace />} />
					<Route path="/public/dashboard" element={<PublicDashboardPage />} />
					<Route path="/public/map" element={<PublicMapPage />} />
					<Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
					<Route path="/categories" element={<RequireAuth><CategoriesPage /></RequireAuth>} />
					<Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
					<Route path="/map" element={<RequireAuth><MapPage /></RequireAuth>} />
					<Route path="/login" element={<LoginPage />} />
					<Route path="/register" element={<RegisterPage />} />
				</Routes>
			</main>
		</div>
	)
}

