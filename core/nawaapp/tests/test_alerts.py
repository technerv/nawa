from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from nawaapp.models import CrimeCategory, CrimeReportBook, AlertEvent


class EnqueueAlertTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(username='admin', email='admin@example.com', password='pass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.cat = CrimeCategory.objects.create(crime_category='Theft', crime_short_code='THE')
        self.incident = CrimeReportBook.objects.create(
            name_of_crime='Test Crime',
            category_of_crime=self.cat,
            severity=CrimeReportBook.SEVERITY_MEDIUM,
            status=CrimeReportBook.STATUS_SUBMITTED,
        )

    def test_happy_path_enqueue(self):
        url = reverse('nawaapp:alertevent-enqueue')
        resp = self.client.post(url, {
            'incident_id': self.incident.id,
            'event_type': 'created',
            'note': 'unit test'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        eid = resp.data.get('event_id')
        self.assertTrue(eid)
        ev = AlertEvent.objects.get(id=eid)
        self.assertEqual(ev.event_type, 'created')
        self.assertEqual(ev.incident_id, self.incident.id)
        self.assertIsInstance(ev.payload, dict)
        self.assertIn('dispatch_results', ev.payload)

    def test_synchronous_fallback(self):
        # Monkeypatch task.delay to raise, forcing fallback path
        from nawaapp import tasks
        orig_delay = tasks.send_notification_task.delay
        def boom(*args, **kwargs):
            raise RuntimeError('celery down')
        tasks.send_notification_task.delay = boom
        try:
            url = reverse('nawaapp:alertevent-enqueue')
            resp = self.client.post(url, {
                'incident_id': self.incident.id,
                'event_type': 'created',
            }, format='json')
            self.assertEqual(resp.status_code, 201)
            eid = resp.data.get('event_id')
            self.assertTrue(eid)
            self.assertTrue(AlertEvent.objects.filter(id=eid).exists())
        finally:
            tasks.send_notification_task.delay = orig_delay


class RetryFailedAlertsTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(username='admin', email='admin@example.com', password='pass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.cat = CrimeCategory.objects.create(crime_category='Robbery', crime_short_code='ROB')
        self.incident = CrimeReportBook.objects.create(
            name_of_crime='Retry Case',
            category_of_crime=self.cat,
            severity=CrimeReportBook.SEVERITY_HIGH,
            status=CrimeReportBook.STATUS_SUBMITTED,
        )

        # Create an alert event with failed dispatch (no contacts configured)
        url = reverse('nawaapp:alertevent-enqueue')
        resp = self.client.post(url, {
            'incident_id': self.incident.id,
            'event_type': 'created',
            'note': 'prepare retry'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.event_id = resp.data.get('event_id')
        self.assertTrue(self.event_id)

    def test_retry_failed_endpoint(self):
        url = reverse('nawaapp:alertevent-retry-failed')
        resp = self.client.post(url, {}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('detail', resp.data)
        # Verify payload has channels_summary after retry
        ev = AlertEvent.objects.get(id=self.event_id)
        self.assertIn('channels_summary', ev.payload)
        self.assertIn('dispatch_results', ev.payload)

    def test_retry_failed_task_direct(self):
        from nawaapp.tasks import retry_failed_alerts
        # Call task directly
        msg = retry_failed_alerts()
        self.assertTrue(isinstance(msg, str))
