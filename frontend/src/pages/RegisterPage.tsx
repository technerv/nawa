import { FormEvent, useState } from 'react'
import { registerUser } from '../api/auth'

const ROLES = [
	'Reporter',
	'FieldOfficer',
	'Dispatcher',
	'Analyst',
	'Admin',
	'SuperAdmin',
]

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
			setInfo(
				`Registered as ${res.user.username} (${
					(res.user.roles || []).join(', ') || 'No role'
				})`
			)
		} catch (err: any) {
			setError(err?.response?.data?.detail || 'Registration failed')
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-10">
			<div className="max-w-lg w-full">
				<div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
					<div className="text-center mb-8">
						<h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Register New User</h2>
						<p className="text-gray-600">Create a new user account</p>
					</div>
					<form onSubmit={onSubmit} className="grid gap-5">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
							<input
								name="username"
								placeholder="Enter username"
								value={username}
								onChange={e => setUsername(e.target.value)}
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
							<input
								name="email"
								placeholder="Enter email"
								type="email"
								value={email}
								onChange={e => setEmail(e.target.value)}
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
							<input
								name="password"
								placeholder="Enter password"
								type="password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
							<select
								name="role"
								value={role}
								onChange={e => setRole(e.target.value)}
								className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
							>
								{ROLES.map(r => (
									<option key={r} value={r}>
										{r}
									</option>
								))}
							</select>
						</div>
						<button
							type="submit"
							className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors font-medium text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
						>
							Create Account
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
				</div>
			</div>
		</div>
	)
}