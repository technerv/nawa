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
			// redirect to requested page or map
			navigate(redirectTo, { replace: true })
		} catch (err: any) {
			setError(err?.response?.data?.detail || 'Login failed')
		}
	}

	return (
		<div style={{ maxWidth: 420, margin: '40px auto' }}>
			<h2>Login</h2>
			<form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
				<input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
				<input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
				<button type="submit">Login</button>
				{error && <p style={{ color: 'crimson' }}>{error}</p>}
				{info && <p style={{ color: 'green' }}>{info}</p>}
			</form>
		</div>
	)
}

