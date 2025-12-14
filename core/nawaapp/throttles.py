from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta


class PublicAnonRateThrottle(AnonRateThrottle):
	scope = 'public'

	def get_rate(self):
		rates = getattr(settings, 'REST_FRAMEWORK_PUBLIC_THROTTLE_RATES', {}) or {}
		return rates.get(self.scope, '60/min')


class DeviceBasedRateThrottle(AnonRateThrottle):
	"""
	Enhanced rate limiting based on device fingerprint and IP address.
	More granular than standard IP-based throttling.
	"""
	scope = 'device'
	
	def get_cache_key(self, request, view):
		# Try to get device fingerprint from session
		session_id = request.headers.get('X-Session-ID') or request.data.get('session_id')
		if session_id:
			return f'throttle_device_{session_id}'
		
		# Fallback to IP-based throttling
		ip = self.get_ident(request)
		return f'throttle_ip_{ip}'
	
	def get_rate(self):
		rates = getattr(settings, 'REST_FRAMEWORK_PUBLIC_THROTTLE_RATES', {}) or {}
		return rates.get(self.scope, '10/hour')  # Stricter default for device-based
	
	def throttle_failure(self):
		"""Called when rate limit is exceeded"""
		from rest_framework.exceptions import Throttled
		raise Throttled(detail={
			'message': 'Rate limit exceeded. Please wait before submitting another report.',
			'retry_after': self.wait()
		})


class IPBasedRateThrottle(AnonRateThrottle):
	"""
	IP-based rate limiting for anonymous reports.
	Separate from device-based to catch coordinated abuse.
	"""
	scope = 'ip_anon'
	
	def get_rate(self):
		rates = getattr(settings, 'REST_FRAMEWORK_PUBLIC_THROTTLE_RATES', {}) or {}
		return rates.get(self.scope, '50/day')  # Daily limit per IP


