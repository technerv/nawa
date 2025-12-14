import random
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import transaction

from nawaapp.models import CrimeReportBook


NAIROBI_BOUNDS = {
	'min_lat': -1.45,
	'max_lat': -1.15,
	'min_lng': 36.75,
	'max_lng': 37.05,
}

KNOWN_LOCATIONS = {
	'CBD': (-1.286389, 36.817223),
	'Westlands': (-1.2667, 36.8000),
	'Karen': (-1.3211, 36.7200),
	'Kahawa': (-1.1791, 36.9360),
	'Eastleigh': (-1.2817, 36.8531),
	'Kibera': (-1.3114, 36.7989),
	'Mombasa Road': (-1.3330, 36.9010),
}


class Command(BaseCommand):
	help = "Seed latitude/longitude for CrimeReportBook entries lacking geo data."

	def add_arguments(self, parser):
		parser.add_argument(
			'--dry-run',
			action='store_true',
			help='Do not persist changes, only show what would be updated.'
		)

	def handle(self, *args, **options):
		dry_run = options['dry_run']
		reports = CrimeReportBook.objects.filter(latitude__isnull=True, longitude__isnull=True)
		count = reports.count()

		if count == 0:
			self.stdout.write(self.style.SUCCESS("No reports require seeding."))
			return

		self.stdout.write(f"Seeding coordinates for {count} reports...")

		updates = []

		for report in reports:
			coords = None
			if report.location_name:
				key = report.location_name.strip().title()
				coords = KNOWN_LOCATIONS.get(key)

			if not coords:
				lat = random.uniform(NAIROBI_BOUNDS['min_lat'], NAIROBI_BOUNDS['max_lat'])
				lng = random.uniform(NAIROBI_BOUNDS['min_lng'], NAIROBI_BOUNDS['max_lng'])
				coords = (lat, lng)

			# Normalize to 6 decimal places
			q = Decimal('0.000001')
			report.latitude = Decimal(str(coords[0])).quantize(q, rounding=ROUND_HALF_UP)
			report.longitude = Decimal(str(coords[1])).quantize(q, rounding=ROUND_HALF_UP)
			report.location_description = report.location_description or "Seeded coordinate"
			updates.append(report)

		if dry_run:
			for report in updates[:10]:
				self.stdout.write(f"[DRY RUN] {report.occurance_book_number}: ({report.latitude}, {report.longitude})")
			self.stdout.write(self.style.WARNING("Dry run complete. No changes saved."))
			return

		with transaction.atomic():
			CrimeReportBook.objects.bulk_update(updates, ['latitude', 'longitude', 'location_description'])

		self.stdout.write(self.style.SUCCESS(f"Seeded coordinates for {len(updates)} reports."))

