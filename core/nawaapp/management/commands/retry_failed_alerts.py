from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Retry failed alert dispatches (uses retry_failed_alerts task)'

    def handle(self, *args, **options):
        try:
            from nawaapp.tasks import retry_failed_alerts
            try:
                # Prefer Celery async if available
                async_res = retry_failed_alerts.delay()
                result = async_res.get(timeout=15)
                self.stdout.write(self.style.SUCCESS(str(result)))
            except Exception:
                # Fallback to direct call
                result = retry_failed_alerts()
                self.stdout.write(self.style.SUCCESS(str(result)))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to retry alerts: {e}'))