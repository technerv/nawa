from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from nawaapp.models import Neighborhood, CrimeCategory, CrimeReportBook


class NeighborhoodGeoTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(username='admin', email='admin@example.com', password='pass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        # Simple square polygon around a point near Nairobi (lon, lat)
        self.poly = {
            "type": "Polygon",
            "coordinates": [[
                [36.80, -1.30],
                [36.90, -1.30],
                [36.90, -1.25],
                [36.80, -1.25],
                [36.80, -1.30]
            ]]
        }

        self.nb = Neighborhood.objects.create(name='Test NB', polygon=self.poly)

        self.cat = CrimeCategory.objects.create(crime_category='Theft', crime_short_code='THE')
        # Incident inside polygon
        self.incident_in = CrimeReportBook.objects.create(
            name_of_crime='Inside',
            category_of_crime=self.cat,
            severity=CrimeReportBook.SEVERITY_LOW,
            status=CrimeReportBook.STATUS_SUBMITTED,
            latitude=-1.285,
            longitude=36.845,
        )
        # Incident outside polygon
        self.incident_out = CrimeReportBook.objects.create(
            name_of_crime='Outside',
            category_of_crime=self.cat,
            severity=CrimeReportBook.SEVERITY_LOW,
            status=CrimeReportBook.STATUS_SUBMITTED,
            latitude=-1.40,
            longitude=36.95,
        )

    def test_contains_point(self):
        url = reverse('nawaapp:neighborhood-contains-point')
        resp = self.client.get(url, {'lat': -1.285, 'lon': 36.845})
        self.assertEqual(resp.status_code, 200)
        ids = resp.data.get('neighborhood_ids')
        self.assertIn(self.nb.id, ids)

    def test_alerts_in_polygon(self):
        url = reverse('nawaapp:neighborhood-alerts', args=[self.nb.id])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        names = [r['name_of_crime'] for r in resp.data]
        self.assertIn('Inside', names)
        self.assertNotIn('Outside', names)

    def test_patch_polygon_update(self):
        # Shrink polygon to exclude the inside incident
        new_poly = {
            "type": "Polygon",
            "coordinates": [[
                [36.80, -1.30],
                [36.82, -1.30],
                [36.82, -1.28],
                [36.80, -1.28],
                [36.80, -1.30]
            ]]
        }
        url = reverse('nawaapp:neighborhood-detail', args=[self.nb.id])
        resp = self.client.patch(url, {'polygon': new_poly}, format='json')
        self.assertEqual(resp.status_code, 200)
        # Alerts now should exclude the previous inside incident
        url_alerts = reverse('nawaapp:neighborhood-alerts', args=[self.nb.id])
        resp2 = self.client.get(url_alerts)
        self.assertEqual(resp2.status_code, 200)
        names2 = [r['name_of_crime'] for r in resp2.data]
        self.assertNotIn('Inside', names2)
