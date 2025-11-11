import logging
from typing import List, Dict, Any, Set
from datetime import datetime, time
from django.contrib.auth.models import Group
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from .models import CrimeReportBook, AlertEvent, UserProfile, AlertSubscription
from .roles import ROLE_DISPATCHER, ROLE_FIELD_OFFICER, ROLE_ADMIN, ROLE_SUPERADMIN
from .channels import get_sms_provider, get_email_provider, get_push_provider, get_user_contact

logger = logging.getLogger(__name__)
User = get_user_model()


def get_group_users(group_name: str):
	try:
		group = Group.objects.get(name=group_name)
		return group.user_set.all()
	except Group.DoesNotExist:
		return []


def is_quiet_hours(subscription: AlertSubscription) -> bool:
	"""Check if current time falls within subscription's quiet hours"""
	if not subscription.quiet_hours_start or not subscription.quiet_hours_end:
		return False
	now = timezone.now().time()
	start = subscription.quiet_hours_start
	end = subscription.quiet_hours_end
	# Handle overnight quiet hours (e.g., 22:00 - 06:00)
	if start > end:
		return now >= start or now <= end
	return start <= now <= end


def decide_recipients(incident: CrimeReportBook, event_type: str) -> List[int]:
	"""
	Basic rules:
	- Created (low/medium): Dispatchers in county + on-duty FieldOfficers in county
	- Created (high/critical): above + Admin
	- Escalated/status_changed/resolved: Dispatcher + assigned_to (if present); Admin for critical
	"""
	county = incident.county or ''
	severity = incident.severity
	user_ids: set[int] = set()

	# Dispatcher(s) in county
	for u in get_group_users(ROLE_DISPATCHER):
		profile = getattr(u, 'profile', None)
		if not profile or (county and profile.county and profile.county.lower() != county.lower()):
			continue
		user_ids.add(u.id)

	# Field officers on duty in county
	for u in get_group_users(ROLE_FIELD_OFFICER):
		profile = getattr(u, 'profile', None)
		if profile and profile.on_duty and (not county or not profile.county or profile.county.lower() == county.lower()):
			user_ids.add(u.id)

	# Admins for high/critical
	if severity in (CrimeReportBook.SEVERITY_HIGH, CrimeReportBook.SEVERITY_CRITICAL):
		for u in list(get_group_users(ROLE_ADMIN)) + list(get_group_users(ROLE_SUPERADMIN)):
			user_ids.add(u.id)

	# Assignee
	if incident.assigned_to_id:
		user_ids.add(incident.assigned_to_id)

	return list(user_ids)


def format_alert_message(incident: CrimeReportBook, event_type: str, note: str = '') -> str:
	"""Format alert message for SMS/email/push"""
	severity_emoji = {
		CrimeReportBook.SEVERITY_LOW: '🟢',
		CrimeReportBook.SEVERITY_MEDIUM: '🟡',
		CrimeReportBook.SEVERITY_HIGH: '🟠',
		CrimeReportBook.SEVERITY_CRITICAL: '🔴',
	}
	emoji = severity_emoji.get(incident.severity, '⚪')
	category = incident.category_of_crime.crime_category if incident.category_of_crime_id else 'Unknown'
	location = incident.location_name or incident.county or 'Unknown location'
	
	msg = f"{emoji} Neighbourhood Alert Watch App Alert: {event_type.upper()}\n"
	msg += f"Crime: {incident.name_of_crime} ({category})\n"
	msg += f"Severity: {incident.severity.upper()}\n"
	msg += f"Location: {location}\n"
	msg += f"OB#: {incident.occurance_book_number}\n"
	if note:
		msg += f"Note: {note}\n"
	return msg


def dispatch_alert(user_id: int, incident: CrimeReportBook, event_type: str, note: str = '') -> Dict[str, bool]:
	"""
	Dispatch alert to a user via all their enabled subscriptions.
	Returns dict of {channel: success} for each channel attempted.
	"""
	results = {}
	try:
		user = User.objects.get(id=user_id)
		subscriptions = AlertSubscription.objects.filter(user=user, enabled=True)
		
		if not subscriptions.exists():
			logger.debug("No enabled subscriptions for user %s", user.username)
			return results

		message = format_alert_message(incident, event_type, note)
		subject = f"Neighbourhood Alert Watch App Alert: {incident.name_of_crime} ({incident.severity.upper()})"

		for sub in subscriptions:
			# Check county scope
			if sub.county and incident.county and sub.county.lower() != incident.county.lower():
				continue

			# Check quiet hours (skip SMS/push during quiet hours, but allow email)
			if is_quiet_hours(sub) and sub.channel in ('sms', 'push'):
				logger.debug("Skipping %s alert to %s (quiet hours)", sub.channel, user.username)
				continue

			contact = get_user_contact(user, sub.channel)
			if not contact:
				logger.warning("No contact info for user %s channel %s", user.username, sub.channel)
				results[sub.channel] = False
				continue

			success = False
			if sub.channel == 'sms':
				success = get_sms_provider().send(contact, message)
			elif sub.channel == 'email':
				html_msg = message.replace('\n', '<br>')
				success = get_email_provider().send(contact, subject, message, html_msg)
			elif sub.channel == 'push':
				success = get_push_provider().send(contact, subject, message, {
					'incident_id': str(incident.id),
					'ob_number': incident.occurance_book_number,
					'event_type': event_type,
				})

			results[sub.channel] = success
			if success:
				logger.info("Alert sent via %s to %s (%s)", sub.channel, user.username, contact)
			else:
				logger.warning("Failed to send %s alert to %s", sub.channel, user.username)

	except User.DoesNotExist:
		logger.error("User %s not found for alert dispatch", user_id)
	except Exception as e:
		logger.error("Error dispatching alert to user %s: %s", user_id, e)

	return results


def create_alert_event(incident: CrimeReportBook, event_type: str, note: str = '') -> AlertEvent:
	recipients = decide_recipients(incident, event_type)
	payload: Dict[str, Any] = {
		'name_of_crime': incident.name_of_crime,
		'severity': incident.severity,
		'status': incident.status,
		'county': incident.county,
		'category': incident.category_of_crime.crime_category if incident.category_of_crime_id else None,
		'note': note,
	}
	event = AlertEvent.objects.create(
		incident=incident,
		event_type=event_type,
		severity=incident.severity,
		county=incident.county,
		recipients=recipients,
		payload=payload,
	)

	# Dispatch alerts to all recipients
	dispatch_results = {}
	for uid in recipients:
		results = dispatch_alert(uid, incident, event_type, note)
		dispatch_results[str(uid)] = results

	# Store dispatch results in payload for audit
	event.payload['dispatch_results'] = dispatch_results
	event.save(update_fields=['payload'])

	logger.info("Alert event %s created for incident %s, dispatched to %d recipients", 
	            event_type, incident.occurance_book_number, len(recipients))
	return event


