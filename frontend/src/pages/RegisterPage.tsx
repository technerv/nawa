import { FormEvent, useState } from 'react'
import { registerUser } from '../api/auth'

const ROLES = ['Reporter', 'FieldOfficer', 'Dispatcher', 'Analyst', 'Admin', 'SuperAdmin']

export default function RegisterPage() {
	const [username, setUsername] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [role, setRole] = useState('Reporter')
	const [error, setError] = useState<string | null>(null)
	const [info, setInfo] = useState<string | null>(null)

	async function onSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		setInfo(null)
		try {
			const res = await registerUser({ username, email, password, role })
			localStorage.setItem('access_token', res.access)
			localStorage.setItem('refresh_token', res.refresh)
			setInfo(`Registered as ${res.user.username} (${(res.user.roles || []).join(', ') || 'No role'})`)
		} catch (err: any) {
			setError(err?.response?.data?.detail || 'Registration failed')
		}
	}

	return (
		<div style={{ maxWidth: 480, margin: '40px auto' }}>
			<h2>Register</h2>
			<form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
				<input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
				<input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
				<input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
				<select value={role} onChange={(e) => setRole(e.target.value)}>
					{ROLES.map((r) => (
						<option key={r} value={r}>
							{r}
						</option>
					))}
				</select>
				<button type="submit">Create Account</button>
				{error && <p style={{ color: 'crimson' }}>{error}</p>}
				{info && <p style={{ color: 'green' }}>{info}</p>}
			</form>
		</div>
	)
}

