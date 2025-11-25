import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q, Count, Sum
from django.contrib.auth.models import Group
from celery import shared_task
from .models import CrimeReportBook, AlertEvent, UserProfile, AlertSubscription
from .alerting import create_alert_event, dispatch_alert
from .roles import ROLE_DISPATCHER, ROLE_ADMIN

logger = logging.getLogger(__name__)


@shared_task
def send_notification_task(incident_id: int, event_type: str, note: str = '') -> int:
    try:
        incident = CrimeReportBook.objects.get(id=incident_id)
    except CrimeReportBook.DoesNotExist:
        logger.error("Incident %s not found for send_notification_task", incident_id)
        return 0

    event = create_alert_event(incident, event_type, note)
    return int(event.id)


@shared_task
def check_sla_breaches():
    now = timezone.now()
    # SLA thresholds (in minutes)
    sla_thresholds = {
        CrimeReportBook.SEVERITY_CRITICAL: 15,  # 15 minutes
        CrimeReportBook.SEVERITY_HIGH: 30,      # 30 minutes
        CrimeReportBook.SEVERITY_MEDIUM: 60,     # 1 hour
        CrimeReportBook.SEVERITY_LOW: 120,      # 2 hours
    }

    breaches = []
    for severity, threshold_minutes in sla_thresholds.items():
        threshold = now - timedelta(minutes=threshold_minutes)
        # Find incidents that:
        # - Match severity
        # - Are not resolved/closed
        # - Were created or last status changed before threshold
        # - Haven't been escalated yet (or were escalated before threshold)
        incidents = CrimeReportBook.objects.filter(
            severity=severity,
            status__in=[
                CrimeReportBook.STATUS_SUBMITTED,
                CrimeReportBook.STATUS_TRIAGED,
                CrimeReportBook.STATUS_IN_PROGRESS,
            ],
        ).filter(
            Q(last_status_change__lt=threshold) | Q(date_created__lt=threshold, last_status_change__isnull=True)
        )

        for incident in incidents:
            # Check if we already alerted for this breach recently (avoid spam)
            recent_alert = AlertEvent.objects.filter(
                incident=incident,
                event_type=AlertEvent.TYPE_ESCALATED,
                created_at__gte=now - timedelta(minutes=threshold_minutes),
            ).exists()

            if not recent_alert:
                breaches.append(incident)
                logger.warning("SLA breach detected: %s (severity %s, threshold %d min)", 
                             incident.occurance_book_number, severity, threshold_minutes)

    # Re-alert for breaches
    for incident in breaches:
        try:
            create_alert_event(incident, AlertEvent.TYPE_ESCALATED, 
                            note=f"SLA breach: No response within threshold")
        except Exception as e:
            logger.error("Failed to create SLA breach alert for %s: %s", 
                        incident.occurance_book_number, e)

    return f"Checked SLA breaches, found {len(breaches)} incidents"


@shared_task
def send_daily_summary():
    yesterday = timezone.now() - timedelta(days=1)
    yesterday_start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Aggregate stats
    total_incidents = CrimeReportBook.objects.filter(
        date_created__gte=yesterday_start,
        date_created__lte=yesterday_end,
    ).count()

    by_severity = CrimeReportBook.objects.filter(
        date_created__gte=yesterday_start,
        date_created__lte=yesterday_end,
    ).values('severity').annotate(count=Count('id'))

    by_county = CrimeReportBook.objects.filter(
        date_created__gte=yesterday_start,
        date_created__lte=yesterday_end,
    ).values('county').annotate(count=Count('id')).order_by('-count')[:10]

    unresolved = CrimeReportBook.objects.filter(
        status__in=[
            CrimeReportBook.STATUS_SUBMITTED,
            CrimeReportBook.STATUS_TRIAGED,
            CrimeReportBook.STATUS_IN_PROGRESS,
            CrimeReportBook.STATUS_ESCALATED,
        ],
    ).count()

    # Format summary
    summary_lines = [
        f"Neighbourhood Alert Watch App Daily Summary - {yesterday.strftime('%Y-%m-%d')}",
        "=" * 50,
        f"Total Incidents: {total_incidents}",
        f"Unresolved: {unresolved}",
        "",
        "By Severity:",
    ]
    for item in by_severity:
        summary_lines.append(f"  {item['severity'].upper()}: {item['count']}")

    summary_lines.extend([
        "",
        "Top Counties:",
    ])
    for item in by_county:
        county = item['county'] or 'Unknown'
        summary_lines.append(f"  {county}: {item['count']}")

    summary_text = "\n".join(summary_lines)
    summary_html = summary_text.replace('\n', '<br>')

    # Send to Admins and Dispatchers
    recipients = []
    for group_name in [ROLE_ADMIN, ROLE_DISPATCHER]:
        try:
            group = Group.objects.get(name=group_name)
            recipients.extend(group.user_set.all())
        except Group.DoesNotExist:
            pass

    from .channels import get_email_provider
    email_provider = get_email_provider()

    sent_count = 0
    for user in set(recipients):  # Deduplicate
        if user.email:
            success = email_provider.send(
                user.email,
                f"Neighbourhood Alert Watch App Daily Summary - {yesterday.strftime('%Y-%m-%d')}",
                summary_text,
                summary_html,
            )
            if success:
                sent_count += 1

    logger.info("Daily summary sent to %d recipients", sent_count)
    return f"Daily summary sent to {sent_count} recipients"


@shared_task
def retry_failed_alerts():
    """
    Retry failed alert dispatches (e.g., SMS gateway temporarily down).
    Runs every 5 minutes.
    """
    # Find recent alert events with failed dispatches
    recent = timezone.now() - timedelta(hours=1)
    events = AlertEvent.objects.filter(
        created_at__gte=recent,
    ).exclude(payload__dispatch_results={})

    retried = 0
    for event in events:
        dispatch_results = event.payload.get('dispatch_results', {})
        for user_id_str, channels in dispatch_results.items():
            # Check if any channel failed
            failed_channels = [ch for ch, meta in channels.items() if not meta.get('success')]
            if failed_channels:
                try:
                    user_id = int(user_id_str)
                    # Retry only failed channels
                    results = dispatch_alert(user_id, event.incident, event.event_type, 
                                            event.payload.get('note', ''))
                    # Update payload with retry results
                    if user_id_str not in event.payload.get('dispatch_results', {}):
                        event.payload['dispatch_results'][user_id_str] = {}
                    event.payload['dispatch_results'][user_id_str].update(results)
                    event.save(update_fields=['payload'])
                    retried += 1
                except Exception as e:
                    logger.error("Failed to retry alert for user %s: %s", user_id_str, e)

    return f"Retried {retried} failed alerts"

@shared_task(bind=True, ignore_result=True)
def warm_subcounties_cache(self):
    try:
        import requests
        headers = {'Accept': 'application/json'}
        urls = [
            'https://ckan.africadatahub.org/dataset/ebfdedaa-b9c4-442e-9144-72f2303105c5/resource/650999c2-c1f7-4acb-9bbb-d3af84a6a04b/download/kenya-subcounties-simplified.geojson',
            'https://raw.githubusercontent.com/Mondieki/kenya-counties-subcounties/master/geojson/subcounties.geojson',
        ]
        data = None
        for url in urls:
            try:
                resp = requests.get(url, headers=headers, timeout=15)
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception:
                continue
        if not data:
            logger.warning('Warm cache: failed to fetch subcounties from external sources')
            return 'no data'
        from django.conf import settings
        import os, json
        target = os.path.join(getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR), 'subcounties.geojson')
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        logger.info('Warm cache: subcounties persisted to %s', target)
        return 'ok'
    except Exception as e:
        logger.error('Warm cache: error %s', e)
        return 'error'
