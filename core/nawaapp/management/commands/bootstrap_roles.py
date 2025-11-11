from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

from nawaapp.models import CrimeReportBook
from nawaapp.roles import ALL_ROLES, ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_DISPATCHER, ROLE_FIELD_OFFICER, ROLE_ANALYST, ROLE_REPORTER


class Command(BaseCommand):
	help = "Create default NAWA groups/roles and assign model permissions."

	def handle(self, *args, **options):
		# Ensure groups exist
		for role in ALL_ROLES:
			Group.objects.get_or_create(name=role)

		# Assign basic permissions for CrimeReportBook
		ct = ContentType.objects.get_for_model(CrimeReportBook)
		add_perm = Permission.objects.get(codename='add_crimereportbook', content_type=ct)
		change_perm = Permission.objects.get(codename='change_crimereportbook', content_type=ct)
		delete_perm = Permission.objects.get(codename='delete_crimereportbook', content_type=ct)
		view_perm = Permission.objects.get(codename='view_crimereportbook', content_type=ct)

		def grant(group_name, perms):
			group = Group.objects.get(name=group_name)
			for p in perms:
				group.permissions.add(p)

		# SuperAdmin: all CRUD
		grant(ROLE_SUPERADMIN, [add_perm, change_perm, delete_perm, view_perm])
		# Admin: all CRUD
		grant(ROLE_ADMIN, [add_perm, change_perm, delete_perm, view_perm])
		# Dispatcher: add/change/view
		grant(ROLE_DISPATCHER, [add_perm, change_perm, view_perm])
		# Field Officer: change/view (update assigned reports)
		grant(ROLE_FIELD_OFFICER, [change_perm, view_perm])
		# Analyst: view only
		grant(ROLE_ANALYST, [view_perm])
		# Reporter: add/view
		grant(ROLE_REPORTER, [add_perm, view_perm])

		self.stdout.write(self.style.SUCCESS("Roles/groups bootstrapped with permissions."))

