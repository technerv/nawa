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
			setInfo(
				`Logged in as ${profile.username} (${
					profile.roles.join(', ') || 'No role'
				})`
			)
			try {
				localStorage.setItem('roles', JSON.stringify(profile.roles || []))
			} catch {}
			try {
				window.dispatchEvent(
					new CustomEvent('roles_updated', {
						detail: {
							roles: profile.roles || [],
							username: profile.username || null,
						},
					})
				)
			} catch {}
			// redirect to requested page or map
			navigate(redirectTo, { replace: true })
		} catch (err: any) {
			setError(err?.response?.data?.detail || 'Login failed')
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-10">
			<div className="max-w-md w-full">
				<div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
					<div className="text-center mb-8">
						<h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Admin Login</h2>
						<p className="text-gray-600">Sign in to access the admin dashboard</p>
					</div>
					<form onSubmit={onSubmit} className="grid gap-5">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
							<input
								name="username"
								placeholder="Enter your username"
								value={username}
								onChange={e => setUsername(e.target.value)}
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
							<input
								name="password"
								placeholder="Enter your password"
								type="password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
							/>
						</div>
						<button
							type="submit"
							className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors font-medium text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
						>
							Login
						</button>
						{error && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-3">
								<p className="text-red-600 text-sm">{error}</p>
							</div>
						)}
						{info && (
							<div className="bg-green-50 border border-green-200 rounded-lg p-3">
								<p className="text-green-600 text-sm">{info}</p>
							</div>
						)}
					</form>
					<div className="mt-6 text-center">
						<a href="/welcome" className="text-sm text-gray-500 hover:text-primary transition-colors">← Back to Home</a>
					</div>
				</div>
			</div>
		</div>
	)
}