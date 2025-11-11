export const ROLES = {
	SuperAdmin: 'SuperAdmin',
	Admin: 'Admin',
	Dispatcher: 'Dispatcher',
	FieldOfficer: 'FieldOfficer',
	Analyst: 'Analyst',
	Reporter: 'Reporter'
} as const

export function getRoles(): string[] {
	try {
		const raw = localStorage.getItem('roles')
		if (!raw) return []
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export function hasAnyRole(required: string[]): boolean {
	const userRoles = new Set(getRoles())
	return required.some((r) => userRoles.has(r))
}

