import { Navigate, useLocation } from 'react-router-dom'

export default function RequireAuth({ children }: { children: JSX.Element }) {
	const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
	const location = useLocation()
	if (!token) {
		return <Navigate to="/login" replace state={{ from: location }} />
	}
	return children
}

