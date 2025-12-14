from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.contrib.auth.models import Group
from .roles import ROLE_SUPERADMIN, ROLE_SECURITY_ORG, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_DISPATCHER, ROLE_FIELD_OFFICER, ROLE_ANALYST, ROLE_REPORTER, ROLE_EXTERNAL


def user_in_groups(user, groups):
	if not user or not user.is_authenticated:
		return False
	user_groups = set(user.groups.values_list('name', flat=True))
	return bool(user_groups.intersection(set(groups)))


class IsReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class IsAdminOrDispatcherOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        # SecurityOrgUser and SuperAdmin can modify
        return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_SECURITY_ORG, ROLE_ADMIN, ROLE_DISPATCHER])


class IsFieldOfficerOrAbove(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_DISPATCHER, ROLE_FIELD_OFFICER])


class IsReporterOrAbove(BasePermission):
    """Allows SecurityOrgUser and SuperAdmin to create/update reports"""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        # SecurityOrgUser and SuperAdmin can modify
        return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_SECURITY_ORG, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_DISPATCHER, ROLE_FIELD_OFFICER, ROLE_REPORTER])

class IsAdminOrSupervisor(BasePermission):
    def has_permission(self, request, view):
        try:
            if request.user and request.user.is_authenticated:
                if getattr(request.user, 'is_superuser', False) or getattr(request.user, 'is_staff', False):
                    return True
        except Exception:
            pass
        return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_SECURITY_ORG, ROLE_ADMIN, ROLE_SUPERVISOR])

class AllowReadUnlessAnalystOnCases(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            try:
                groups = set(request.user.groups.values_list('name', flat=True)) if request.user and request.user.is_authenticated else set()
                act = getattr(view, 'action', None)
                if ROLE_ANALYST in groups and act in ('list', 'retrieve', 'map'):
                    return False
            except Exception:
                pass
            return True
        return True

class IsExternalAgencyReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return user_in_groups(request.user, [ROLE_EXTERNAL]) or user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_DISPATCHER, ROLE_FIELD_OFFICER])
        return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_SUPERVISOR, ROLE_DISPATCHER, ROLE_FIELD_OFFICER])
