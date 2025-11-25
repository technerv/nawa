import { FormEvent, useState } from 'react'
import { login, me } from '../api/auth'
import { useLocation, useNavigate } from 'react-router-dom'

export default function LoginPage() {
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [info, setInfo] = useState<string | null>(null)
	const navigate = useNavigate()
	const location = useLocation() as any
	const redirectTo = location?.state?.from?.pathname || '/map'

	async function onSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		setInfo(null)
		try {
			const tokens = await login(username, password)
			localStorage.setItem('access_token', tokens.access)
			localStorage.setItem('refresh_token', tokens.refresh)
			const profile = await me()
			setInfo(`Logged in as ${profile.username} (${profile.roles.join(', ') || 'No role'})`)
			try { localStorage.setItem('roles', JSON.stringify(profile.roles || [])) } catch {}
			try { window.dispatchEvent(new CustomEvent('roles_updated', { detail: { roles: profile.roles || [], username: profile.username || null } })) } catch {}
			// redirect to requested page or map
			navigate(redirectTo, { replace: true })
		} catch (err: any) {
			setError(err?.response?.data?.detail || 'Login failed')
		}
	}

	return (
		<div style={{ maxWidth: 460, margin: '40px auto' }}>
			<h2 style={{ marginBottom: 12 }}>Login</h2>
			<div className="card">
				<form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
					<input name="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
					<input name="password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
					<button type="submit">Login</button>
					{error && <p style={{ color: '#fecaca' }}>{error}</p>}
					{info && <p style={{ color: '#a7f3d0' }}>{info}</p>}
				</form>
			</div>
		</div>
	)
}
