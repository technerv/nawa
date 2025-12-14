from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from django.utils import timezone
import uuid
from django.contrib.auth import get_user_model

# Crime Category Model
class CrimeCategory(models.Model):
    crime_category = models.CharField(max_length=30, verbose_name='Crime Category')
    crime_short_code = models.CharField(max_length=4, verbose_name='Crime Short Code')
    date_created = models.DateTimeField(verbose_name="Date Created", auto_now_add=True, null=True, blank=True)
    date_updated = models.DateTimeField(verbose_name="Date Updated", auto_now=True, null=True, blank=True)
    
    def __str__(self):
        return self.crime_category
    
    class Meta:
        verbose_name_plural = "Crime Categories"

# Crime ReportBook Model
class CrimeReportBook(models.Model):
    STATUS_SUBMITTED = 'submitted'
    STATUS_TRIAGED = 'triaged'
    STATUS_ESCALATED = 'escalated'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_RESOLVED = 'resolved'
    STATUS_CLOSED = 'closed'

    STATUS_CHOICES = [
        (STATUS_SUBMITTED, 'Submitted'),
        (STATUS_TRIAGED, 'Triaged'),
        (STATUS_ESCALATED, 'Escalated'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_RESOLVED, 'Resolved'),
        (STATUS_CLOSED, 'Closed'),
    ]

    SEVERITY_LOW = 'low'
    SEVERITY_MEDIUM = 'medium'
    SEVERITY_HIGH = 'high'
    SEVERITY_CRITICAL = 'critical'

    SEVERITY_CHOICES = [
        (SEVERITY_LOW, 'Low'),
        (SEVERITY_MEDIUM, 'Medium'),
        (SEVERITY_HIGH, 'High'),
        (SEVERITY_CRITICAL, 'Critical'),
    ]

    occurance_book_number = models.CharField(
        max_length=100, 
        verbose_name='Occurance Book Number (OB Number)', 
        blank=True, 
        unique=True, 
        default=uuid.uuid4, 
        editable=False,
        #read_only = True
    )
    date_of_arrest = models.DateField(verbose_name='Date of Arrest', null=True)
    name_of_crime = models.CharField(max_length=100,verbose_name='Name of Crime')
    description = models.TextField(verbose_name='Crime Description', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SUBMITTED, verbose_name='Status')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default=SEVERITY_MEDIUM, verbose_name='Severity')
    location_name = models.CharField(max_length=255, verbose_name='Location Name', null=True, blank=True)
    location_description = models.CharField(max_length=255, verbose_name='Location Description', null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name='Latitude')
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name='Longitude')
    county = models.CharField(max_length=100, verbose_name='County', null=True, blank=True)
    age = models.IntegerField(verbose_name='Age of Criminal', null=True)
    category_of_crime = models.ForeignKey(
        CrimeCategory, 
        verbose_name='Category of Crime', 
        on_delete=models.CASCADE
    )
    # crime_location = models.PointField(srid=4326)
    # crime_location = models.CharField(max_length=100, verbose_name='Crime Location', null=True) # create geo cordinate feature which includes latitude and longitude
    name_of_criminal = models.CharField(max_length=60, verbose_name='Name of Criminal', null=True)
    criminal_id_number = models.IntegerField(verbose_name='Criminal Identity Number', null=True)
    upload_criminal_photo = models.ImageField(upload_to="images" , blank=True, null=True)
    evidence_video = models.FileField(upload_to="videos", blank=True, null=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='Assigned Officer',
        related_name='assigned_reports',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    assigned_organization = models.ForeignKey(
        'SecurityOrgWhitelist',
        verbose_name='Assigned Organization',
        related_name='assigned_reports',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text='Organization responsible for this report'
    )
    assigned_at = models.DateTimeField(verbose_name='Assigned At', null=True, blank=True)
    triaged_at = models.DateTimeField(verbose_name='Triaged At', null=True, blank=True)
    escalated_at = models.DateTimeField(verbose_name='Escalated At', null=True, blank=True)
    resolved_at = models.DateTimeField(verbose_name='Resolved At', null=True, blank=True)
    closed_at = models.DateTimeField(verbose_name='Closed At', null=True, blank=True)
    last_status_change = models.DateTimeField(verbose_name='Last Status Change', null=True, blank=True)
    date_created = models.DateTimeField(verbose_name="Date Created", auto_now_add=True, null=True, blank=True)
    date_updated = models.DateTimeField(verbose_name="Date Updated", auto_now=True, null=True, blank=True)
    # objects = GeoManager() # Geo Django GeoManager

    def clean(self):
        #Ensure that the criminal__id_number is positive
        if self.criminal_id_number is not None and self.criminal_id_number <= 0:
            raise ValidationError({'criminal_id_number': 'Criminal ID Number must be a positive number.'})
        
        #Ensure name_of_crime is not empty
        if not self.name_of_crime:
            raise ValidationError({'name_of_crime': 'Name of Crime cannot be empty.'})

        # Ensure latitude/longitude validity
        if (self.latitude is None) ^ (self.longitude is None):
            raise ValidationError({'latitude': 'Latitude and longitude must both be provided.', 'longitude': 'Latitude and longitude must both be provided.'})

        from decimal import Decimal, ROUND_HALF_UP
        if self.latitude is not None:
            if not (-90 <= float(self.latitude) <= 90):
                raise ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
            # Normalize to 6 decimal places (round if more than 6)
            lat_decimal = Decimal(str(self.latitude))
            q = Decimal('0.000001')
            self.latitude = lat_decimal.quantize(q, rounding=ROUND_HALF_UP)
        
        if self.longitude is not None:
            if not (-180 <= float(self.longitude) <= 180):
                raise ValidationError({'longitude': 'Longitude must be between -180 and 180.'})
            # Normalize to 6 decimal places (round if more than 6)
            lon_decimal = Decimal(str(self.longitude))
            q = Decimal('0.000001')
            self.longitude = lon_decimal.quantize(q, rounding=ROUND_HALF_UP)
    
    def __str__(self):
        return self.occurance_book_number

    def save(self, *args, **kwargs):
        previous = None
        if self.pk:
            try:
                previous = CrimeReportBook.objects.get(pk=self.pk)
            except CrimeReportBook.DoesNotExist:
                previous = None

        now = timezone.now()

        if previous:
            if previous.status != self.status:
                self.last_status_change = now
            if previous.assigned_to != self.assigned_to:
                self.assigned_at = now if self.assigned_to else None
                # Auto-assign organization when user is assigned
                if self.assigned_to and not self.assigned_organization:
                    try:
                        whitelist = getattr(self.assigned_to, 'security_org_whitelist', None)
                        if whitelist:
                            self.assigned_organization = whitelist
                    except Exception:
                        pass
        else:
            if not self.last_status_change:
                self.last_status_change = now
            if self.assigned_to and not self.assigned_at:
                self.assigned_at = now

        super().save(*args, **kwargs)
    
    class Meta:
        ordering = ['-date_updated']
        verbose_name_plural = "Crime Report Books"

# Crime Witness Model
class CrimeWitness(models.Model):
    name = models.CharField(max_length=100, verbose_name='Name of Witness')
    contact_information = models.CharField(max_length=100, verbose_name='Contact Information', null=True, blank=True)
    statement = models.TextField(verbose_name='Witness Statement')
    crime_report = models.ForeignKey(CrimeReportBook, verbose_name='Related Crime Report', on_delete=models.CASCADE)
    date_created = models.DateTimeField(verbose_name="Date Created", auto_now_add=True, null=True, blank=True)
    date_updated = models.DateTimeField(verbose_name="Date Updated", auto_now=True, null=True, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Crime Witnesses"


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    county = models.CharField(max_length=100, null=True, blank=True)
    on_duty = models.BooleanField(default=False)
    sms_opt_in = models.BooleanField(default=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True, verbose_name='Phone Number')
    fcm_token = models.CharField(max_length=255, null=True, blank=True, verbose_name='FCM Push Token')

    def __str__(self):
        return f"{self.user.username} profile"


class AlertSubscription(models.Model):
    CHANNEL_SMS = 'sms'
    CHANNEL_EMAIL = 'email'
    CHANNEL_PUSH = 'push'
    CHANNEL_CHOICES = [
        (CHANNEL_SMS, 'SMS'),
        (CHANNEL_EMAIL, 'Email'),
        (CHANNEL_PUSH, 'Push'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alert_subscriptions')
    county = models.CharField(max_length=100, null=True, blank=True)  # if null, all counties
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES, default=CHANNEL_SMS)
    enabled = models.BooleanField(default=True)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        scope = self.county or "All counties"
        return f"{self.user.username} {self.channel} ({scope})"


class AlertEvent(models.Model):
    TYPE_CREATED = 'created'
    TYPE_ASSIGNED = 'assigned'
    TYPE_ESCALATED = 'escalated'
    TYPE_STATUS = 'status_changed'
    TYPE_RESOLVED = 'resolved'
    EVENT_CHOICES = [
        (TYPE_CREATED, 'Created'),
        (TYPE_ASSIGNED, 'Assigned'),
        (TYPE_ESCALATED, 'Escalated'),
        (TYPE_STATUS, 'Status Changed'),
        (TYPE_RESOLVED, 'Resolved'),
    ]

    incident = models.ForeignKey(CrimeReportBook, on_delete=models.CASCADE, related_name='alert_events')
    event_type = models.CharField(max_length=32, choices=EVENT_CHOICES)
    severity = models.CharField(max_length=20, choices=CrimeReportBook.SEVERITY_CHOICES)
    county = models.CharField(max_length=100, null=True, blank=True)
    recipients = models.JSONField(default=list)  # list of user ids or contacts
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} - {self.incident.occurance_book_number}"

class CrimeReportBookAuditLog(models.Model):
    report = models.ForeignKey(CrimeReportBook, related_name='audit_logs', on_delete=models.CASCADE)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='crime_report_audit_entries'
    )
    from_status = models.CharField(max_length=20, choices=CrimeReportBook.STATUS_CHOICES, null=True, blank=True)
    to_status = models.CharField(max_length=20, choices=CrimeReportBook.STATUS_CHOICES, null=True, blank=True)
    from_severity = models.CharField(max_length=20, choices=CrimeReportBook.SEVERITY_CHOICES, null=True, blank=True)
    to_severity = models.CharField(max_length=20, choices=CrimeReportBook.SEVERITY_CHOICES, null=True, blank=True)
    from_assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='crime_report_audit_from_assignments'
    )
    to_assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='crime_report_audit_to_assignments'
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Crime Report Audit Log'
        verbose_name_plural = 'Crime Report Audit Logs'

    def __str__(self):
        return f"{self.report.occurance_book_number}: {self.from_status} -> {self.to_status}"
class Neighborhood(models.Model):
    name = models.CharField(max_length=200)
    center_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    center_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    invite_code = models.CharField(max_length=32, null=True, blank=True, unique=True)
    polygon = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class NeighborhoodMember(models.Model):
    neighborhood = models.ForeignKey('Neighborhood', on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='neighborhood_memberships')
    role = models.CharField(max_length=32, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('neighborhood', 'user')
        ordering = ['-joined_at']

class NeighborhoodMessage(models.Model):
    neighborhood = models.ForeignKey('Neighborhood', on_delete=models.CASCADE, related_name='messages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


# Anonymous Session Tracking for Public Reports
class AnonymousSession(models.Model):
    """Tracks anonymous reporting sessions without requiring user accounts"""
    session_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_fingerprint = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    user_agent = models.TextField(null=True, blank=True)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    report_count = models.IntegerField(default=0)
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.TextField(null=True, blank=True)
    blocked_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-last_seen']
        indexes = [
            models.Index(fields=['device_fingerprint', 'last_seen']),
            models.Index(fields=['ip_address', 'last_seen']),
        ]
    
    def __str__(self):
        return f"Session {str(self.session_id)[:8]}... ({self.report_count} reports)"


# Security Org Whitelist
class SecurityOrgWhitelist(models.Model):
    """Whitelist for Security Org Users - only whitelisted users can access"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='security_org_whitelist',
        null=True,
        blank=True
    )
    organization_name = models.CharField(max_length=200, verbose_name='Organization Name')
    organization_type = models.CharField(
        max_length=50,
        choices=[
            ('police', 'National Police Service'),
            ('county_command', 'County Command Center'),
            ('private_security', 'Private Security Firm'),
            ('emergency', 'Emergency Responder'),
            ('other', 'Other'),
        ],
        default='other'
    )
    contact_person = models.CharField(max_length=200, null=True, blank=True)
    contact_email = models.EmailField(null=True, blank=True)
    contact_phone = models.CharField(max_length=20, null=True, blank=True)
    allowed_ip_ranges = models.JSONField(
        default=list,
        help_text='List of IP ranges (CIDR notation) allowed for this org'
    )
    allowed_vpn_names = models.JSONField(
        default=list,
        help_text='List of VPN names/identifiers allowed'
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whitelisted_orgs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Security Org Whitelist'
        verbose_name_plural = 'Security Org Whitelists'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.organization_name} ({self.organization_type})"


# Device Fingerprint for Abuse Prevention
class DeviceFingerprint(models.Model):
    """Tracks device fingerprints for abuse prevention"""
    fingerprint_hash = models.CharField(max_length=64, unique=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    user_agent = models.TextField(null=True, blank=True)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    report_count = models.IntegerField(default=0)
    abuse_score = models.FloatField(default=0.0, help_text='ML/rule-based abuse score')
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.TextField(null=True, blank=True)
    blocked_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, help_text='Additional device metadata')
    
    class Meta:
        ordering = ['-last_seen']
        indexes = [
            models.Index(fields=['fingerprint_hash', 'is_blocked']),
            models.Index(fields=['ip_address', 'is_blocked']),
        ]
    
    def __str__(self):
        status = "BLOCKED" if self.is_blocked else "ACTIVE"
        return f"Device {self.fingerprint_hash[:16]}... ({self.report_count} reports, {status})"
