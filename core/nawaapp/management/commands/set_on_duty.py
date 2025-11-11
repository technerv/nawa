"""
Management command to set officers on/off duty by county or username.
Usage:
    python manage.py set_on_duty --county "Nairobi" --on
    python manage.py set_on_duty --username officer1 --off
    python manage.py set_on_duty --county "Meru County" --all --on
"""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from nawaapp.models import UserProfile
from nawaapp.roles import ROLE_FIELD_OFFICER

User = get_user_model()


class Command(BaseCommand):
    help = 'Set officers on/off duty by county or username'

    def add_arguments(self, parser):
        parser.add_argument(
            '--county',
            type=str,
            help='County name to filter officers',
        )
        parser.add_argument(
            '--username',
            type=str,
            help='Specific username to set on/off duty',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Apply to all field officers (use with --county to filter by county)',
        )
        parser.add_argument(
            '--on',
            action='store_true',
            help='Set officers on duty',
        )
        parser.add_argument(
            '--off',
            action='store_true',
            help='Set officers off duty',
        )

    def handle(self, *args, **options):
        county = options.get('county')
        username = options.get('username')
        all_flag = options.get('all', False)
        on_duty = options.get('on', False)
        off_duty = options.get('off', False)

        if not (on_duty or off_duty):
            raise CommandError('Must specify --on or --off')

        if on_duty and off_duty:
            raise CommandError('Cannot specify both --on and --off')

        duty_status = on_duty

        # Get field officers group
        try:
            field_officer_group = Group.objects.get(name=ROLE_FIELD_OFFICER)
        except Group.DoesNotExist:
            raise CommandError(f'Group "{ROLE_FIELD_OFFICER}" does not exist. Run bootstrap_roles first.')

        # Build queryset
        users = User.objects.filter(groups=field_officer_group)

        if username:
            users = users.filter(username=username)
            if not users.exists():
                raise CommandError(f'User "{username}" not found or not a field officer')
        elif county:
            # Filter by county in profile
            users = users.filter(profile__county__icontains=county)
            if not users.exists():
                self.stdout.write(self.style.WARNING(f'No field officers found in county "{county}"'))
                return
        elif not all_flag:
            raise CommandError('Must specify --county, --username, or --all')

        # Update profiles
        updated = 0
        for user in users:
            profile, created = UserProfile.objects.get_or_create(user=user)
            profile.on_duty = duty_status
            profile.save()
            updated += 1
            status_str = 'ON DUTY' if duty_status else 'OFF DUTY'
            self.stdout.write(
                self.style.SUCCESS(f'Set {user.username} ({user.profile.county or "No county"}) to {status_str}')
            )

        self.stdout.write(
            self.style.SUCCESS(f'\nUpdated {updated} officer(s) to {"ON DUTY" if duty_status else "OFF DUTY"}')
        )

