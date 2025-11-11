"""
Management command to test SMS sending.
Usage:
    python manage.py test_sms --phone +254712345678 --message "Test message"
    python manage.py test_sms --user username --message "Test message"
"""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from nawaapp.channels import get_sms_provider, get_user_contact

User = get_user_model()


class Command(BaseCommand):
    help = 'Test SMS sending functionality'

    def add_arguments(self, parser):
        parser.add_argument(
            '--phone',
            type=str,
            help='Phone number to send SMS to (e.g., +254712345678 or 0712345678)',
        )
        parser.add_argument(
            '--user',
            type=str,
            help='Username to send SMS to (uses phone from UserProfile)',
        )
        parser.add_argument(
            '--message',
            type=str,
            default='Test SMS from Neighbourhood Alert Watch App',
            help='Message to send (default: Test SMS from Neighbourhood Alert Watch App)',
        )

    def handle(self, *args, **options):
        phone = options.get('phone')
        username = options.get('user')
        message = options.get('message')

        if not phone and not username:
            raise CommandError('Must specify either --phone or --user')

        if phone and username:
            raise CommandError('Cannot specify both --phone and --user')

        # Get phone number
        if username:
            try:
                user = User.objects.get(username=username)
                profile = getattr(user, 'profile', None)
                if not profile or not profile.phone_number:
                    raise CommandError(f'User {username} does not have a phone number in their profile')
                phone = profile.phone_number
                self.stdout.write(f'Using phone number from user profile: {phone}')
            except User.DoesNotExist:
                raise CommandError(f'User "{username}" not found')

        # Send SMS
        self.stdout.write(f'Sending SMS to {phone}...')
        self.stdout.write(f'Message: {message}')
        
        sms_provider = get_sms_provider()
        if not sms_provider.enabled:
            self.stdout.write(self.style.WARNING('SMS provider is not configured. Check your .env file for:'))
            self.stdout.write('  - AFRICAS_TALKING_API_KEY and AFRICAS_TALKING_USERNAME (for Africa\'s Talking)')
            self.stdout.write('  - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (for Twilio)')
            return

        success = sms_provider.send(phone, message)
        
        if success:
            self.stdout.write(self.style.SUCCESS(f'✓ SMS sent successfully to {phone}'))
        else:
            self.stdout.write(self.style.ERROR(f'✗ Failed to send SMS to {phone}'))
            self.stdout.write('Check the logs for more details.')

