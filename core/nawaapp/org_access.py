"""
Organization-based access control utilities
Ensures strict data isolation between security organizations
"""
from django.db.models import Q
from .models import SecurityOrgWhitelist, CrimeReportBook
from .roles import ROLE_SUPERADMIN, ROLE_SECURITY_ORG


def get_user_organization(user):
    """Get the SecurityOrgWhitelist for a user, or None if not a Security Org User"""
    if not user or not user.is_authenticated:
        return None
    try:
        # Access OneToOneField directly - this will raise DoesNotExist if not found
        return user.security_org_whitelist
    except SecurityOrgWhitelist.DoesNotExist:
        return None
    except AttributeError:
        # In case the relationship doesn't exist on the model
        return None


def is_superadmin(user):
    """Check if user is SuperAdmin"""
    if not user or not user.is_authenticated:
        return False
    try:
        groups = set(user.groups.values_list('name', flat=True))
        return ROLE_SUPERADMIN in groups
    except Exception:
        return False


def is_security_org_user(user):
    """Check if user is a Security Org User"""
    if not user or not user.is_authenticated:
        return False
    try:
        groups = set(user.groups.values_list('name', flat=True))
        return ROLE_SECURITY_ORG in groups
    except Exception:
        return False


def get_org_filter(user, queryset=None):
    """
    Get Q filter for organization-based access control.
    Returns:
    - Q() (no filter) for SuperAdmin (can see all)
    - Q(assigned_organization=user_org) | Q(assigned_to=user) for Security Org Users (their org's reports + reports assigned to them)
    - Q(pk__in=[]) (empty) for unauthenticated or non-org users
    """
    if not user or not user.is_authenticated:
        # Unauthenticated users see nothing (except public endpoints)
        return Q(pk__in=[])
    
    # SuperAdmin can see everything
    if is_superadmin(user):
        return Q()
    
    # Security Org Users see their organization's reports AND reports assigned to them personally
    if is_security_org_user(user):
        org = get_user_organization(user)
        if org:
            # Include reports assigned to their organization OR assigned to them personally
            # This handles cases where assigned_organization might be null but assigned_to is set
            return Q(assigned_organization=org) | Q(assigned_to=user)
        # If user is Security Org but has no whitelist, they see nothing
        return Q(pk__in=[])
    
    # Other users see nothing (unless explicitly allowed elsewhere)
    return Q(pk__in=[])


def filter_queryset_by_org(queryset, user):
    """
    Filter a queryset by organization access control.
    SuperAdmin sees all, Security Org Users see only their org's reports.
    """
    org_filter = get_org_filter(user)
    return queryset.filter(org_filter)


def can_access_report(user, report):
    """
    Check if a user can access a specific report.
    Returns True if:
    - User is SuperAdmin
    - User is Security Org User and (report is assigned to their organization OR assigned to them personally)
    """
    if not user or not user.is_authenticated:
        return False
    
    if is_superadmin(user):
        return True
    
    if is_security_org_user(user):
        org = get_user_organization(user)
        if org:
            # User can access if report is assigned to their org OR assigned to them personally
            if report.assigned_organization == org or report.assigned_to == user:
                return True
    
    return False


def get_org_for_user(user):
    """Get the organization ID for a user (for WebSocket routing, etc.)"""
    org = get_user_organization(user)
    return org.id if org else None

