from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.contrib.auth.models import Group
from .roles import ROLE_ADMIN, ROLE_DISPATCHER, ROLE_FIELD_OFFICER, ROLE_SUPERADMIN, ROLE_ANALYST, ROLE_REPORTER


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
		return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_DISPATCHER])


class IsFieldOfficerOrAbove(BasePermission):
	def has_permission(self, request, view):
		if request.method in SAFE_METHODS:
			return True
		return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_DISPATCHER, ROLE_FIELD_OFFICER])


class IsReporterOrAbove(BasePermission):
	"""Allows Reporter, FieldOfficer, Dispatcher, Admin, and SuperAdmin to create/update reports"""
	def has_permission(self, request, view):
		if request.method in SAFE_METHODS:
			return True
		return user_in_groups(request.user, [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_DISPATCHER, ROLE_FIELD_OFFICER, ROLE_REPORTER])


