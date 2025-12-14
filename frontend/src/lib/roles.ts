export const ROLES = {
	SuperAdmin: 'SuperAdmin',
	SecurityOrgUser: 'SecurityOrgUser',
	// Legacy roles kept for backward compatibility with existing accounts
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

// Helper to check if user is Security Org User (includes legacy roles that map to Security Org)
export function isSecurityOrgUser(roles: string[] | null): boolean {
	if (!roles) return false
	const securityRoles = [
		ROLES.SecurityOrgUser,
		ROLES.Admin,
		ROLES.Dispatcher,
		ROLES.FieldOfficer,
		ROLES.Analyst
	]
	return roles.some(r => securityRoles.includes(r as any))
}

// Helper to check if user is SuperAdmin
export function isSuperAdmin(roles: string[] | null): boolean {
	if (!roles) return false
	return roles.includes(ROLES.SuperAdmin)
}
