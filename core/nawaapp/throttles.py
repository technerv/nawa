from rest_framework.throttling import AnonRateThrottle
from django.conf import settings


class PublicAnonRateThrottle(AnonRateThrottle):
	scope = 'public'

	def get_rate(self):
		rates = getattr(settings, 'REST_FRAMEWORK_PUBLIC_THROTTLE_RATES', {}) or {}
		return rates.get(self.scope, '60/min')


