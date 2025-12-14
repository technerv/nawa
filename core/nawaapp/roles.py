# Role and group names for NAWA
# Only 3 user types: Anonymous Reporter (no account), SecurityOrgUser, SuperAdmin

ROLE_SUPERADMIN = 'SuperAdmin'
ROLE_SECURITY_ORG = 'SecurityOrgUser'  # Police, County Command Centers, Private Security, Emergency Responders

ALL_ROLES = [
	ROLE_SUPERADMIN,
	ROLE_SECURITY_ORG,
]

# Legacy roles kept for migration compatibility but not used for new accounts
ROLE_ADMIN = 'Admin'
ROLE_SUPERVISOR = 'Supervisor'
ROLE_DISPATCHER = 'Dispatcher'
ROLE_FIELD_OFFICER = 'FieldOfficer'
ROLE_ANALYST = 'Analyst'
ROLE_REPORTER = 'Reporter'
ROLE_EXTERNAL = 'ExternalAgency'

