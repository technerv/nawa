from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    CrimeCategory, CrimeReportBook, CrimeWitness, CrimeReportBookAuditLog,
    UserProfile, AlertSubscription, AlertEvent, Neighborhood, NeighborhoodMember,
    AnonymousSession, SecurityOrgWhitelist, DeviceFingerprint
)
from .roles import ROLE_SUPERADMIN, ROLE_SECURITY_ORG
# from leaflet.admin import LeafletGeoAdmin
# Register your models here.
#admin.site.register(CrimeReportBook)

@admin.register(CrimeCategory)
class CrimeCategoryModelAdmin(admin.ModelAdmin):
    list_display = ('crime_category', 'crime_short_code',)
    search_fields = ('crime_category', 'crime_short_code',)
    list_filter = ('crime_category',)
    ordering = ('crime_category',)

# admin.site.register(CrimeCategoryModelAdmin)
    
@admin.register(CrimeReportBook)
class CrimeReportBookModelAdmin(admin.ModelAdmin):
    list_display = ('occurance_book_number', 'name_of_criminal', 'status', 'severity', 'location_name', 'date_of_arrest', 'name_of_crime', 'category_of_crime',
                    'assigned_to', 'date_created', 'date_updated',)
    search_fields = ('occurance_book_number', 'name_of_crime', 'name_of_criminal', 'criminal_id_number', 'location_name',)
    list_filter = ('category_of_crime', 'status', 'severity', 'assigned_to', 'location_name', 'date_created', 'date_updated',)
    ordering = ('-date_created',)
    fieldsets = (
        (None, {
            'fields': ('occurance_book_number', 'name_of_crime', 'description', 'category_of_crime', 'status', 'severity')
        }),
        ('Location', {
            'fields': ('location_name', 'location_description', 'latitude', 'longitude')
        }),
        ('Criminal Details', {
            'fields': ('name_of_criminal', 'criminal_id_number', 'age', 'upload_criminal_photo')
        }),
        ('Workflow', {
            'fields': ('assigned_to', 'assigned_at', 'triaged_at', 'escalated_at', 'resolved_at', 'closed_at', 'last_status_change')
        }),
        ('Dates', {
            'fields': ('date_created', 'date_updated',)
        }),
    )
    readonly_fields = ('occurance_book_number', 'assigned_at', 'triaged_at', 'escalated_at', 'resolved_at', 'closed_at', 'last_status_change', 'date_created', 'date_updated',)

@admin.register(CrimeWitness)
class CrimeWitnessModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_information', 'statement', 'crime_report',)
    search_fields = ('name', 'contact_information', 'crime_report',)
    list_filter = ('name', 'contact_information',)
    ordering = ('-date_created',)
    fieldsets = (
        (None, {
            'fields': ('name', 'contact_information', 'statement', 'crime_report',)
        }),
        # ('Witness Details', {
        #     'fields': ('name', 'contact_information', 'statement', 'crime_report',)
        # }),
        ('Dates', {
            'fields': ('date_created', 'date_updated',)
        }),
    )
    readonly_fields = ('date_created', 'date_updated',)


@admin.register(CrimeReportBookAuditLog)
class CrimeReportBookAuditLogAdmin(admin.ModelAdmin):
    list_display = ('report', 'from_status', 'to_status', 'from_severity', 'to_severity', 'changed_by', 'created_at')
    search_fields = ('report__occurance_book_number', 'changed_by__username', 'note')
    list_filter = ('to_status', 'to_severity', 'changed_by', 'created_at')
    readonly_fields = ('report', 'from_status', 'to_status', 'from_severity', 'to_severity', 'from_assigned_to', 'to_assigned_to', 'changed_by', 'note', 'created_at')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'county', 'on_duty', 'sms_opt_in', 'phone_number')
    list_filter = ('county', 'on_duty', 'sms_opt_in')
    search_fields = ('user__username', 'county', 'phone_number')
    list_editable = ('on_duty',)  # Quick toggle for on_duty
    fieldsets = (
        (None, {
            'fields': ('user', 'county', 'on_duty', 'sms_opt_in')
        }),
        ('Contact Info', {
            'fields': ('phone_number', 'fcm_token')
        }),
    )


@admin.register(AlertSubscription)
class AlertSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'channel', 'county', 'enabled', 'quiet_hours_start', 'quiet_hours_end', 'created_at')
    list_filter = ('channel', 'enabled', 'county')
    search_fields = ('user__username', 'county')


@admin.register(AlertEvent)
class AlertEventAdmin(admin.ModelAdmin):
    list_display = ('incident', 'event_type', 'severity', 'county', 'recipient_count', 'created_at')
    list_filter = ('event_type', 'severity', 'county', 'created_at')
    search_fields = ('incident__occurance_book_number',)
    readonly_fields = ('incident', 'event_type', 'severity', 'county', 'recipients', 'payload', 'created_at', 'dispatch_summary')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    def recipient_count(self, obj):
        return len(obj.recipients) if obj.recipients else 0
    recipient_count.short_description = 'Recipients'

    def dispatch_summary(self, obj):
        results = obj.payload.get('dispatch_results', {})
        if not results:
            return "No dispatch results"
        summary = []
        for uid, channels in results.items():
            success = []
            failed = []
            for ch, meta in channels.items():
                ok = meta.get('success') if isinstance(meta, dict) else bool(meta)
                if ok:
                    success.append(ch)
                else:
                    failed.append(ch)
            if success:
                summary.append(f"User {uid}: ✓ {', '.join(success)}")
            if failed:
                summary.append(f"User {uid}: ✗ {', '.join(failed)}")
        return "\n".join(summary) if summary else "Pending dispatch"
    dispatch_summary.short_description = 'Dispatch Summary'


@admin.register(Neighborhood)
class NeighborhoodAdmin(admin.ModelAdmin):
    list_display = ('name', 'invite_code', 'center_lat', 'center_lon', 'created_at')
    search_fields = ('name', 'invite_code')
    list_filter = ('created_at',)


@admin.register(NeighborhoodMember)
class NeighborhoodMemberAdmin(admin.ModelAdmin):
    list_display = ('neighborhood', 'user', 'role', 'joined_at')
    search_fields = ('neighborhood__name', 'user__username')
    list_filter = ('role', 'joined_at')


@admin.register(AnonymousSession)
class AnonymousSessionAdmin(admin.ModelAdmin):
    list_display = ('session_id', 'device_fingerprint', 'ip_address', 'report_count', 'is_blocked', 'first_seen', 'last_seen')
    list_filter = ('is_blocked', 'first_seen', 'last_seen')
    search_fields = ('session_id', 'device_fingerprint', 'ip_address')
    readonly_fields = ('session_id', 'device_fingerprint', 'ip_address', 'user_agent', 'first_seen', 'last_seen', 'report_count')
    fieldsets = (
        (None, {
            'fields': ('session_id', 'device_fingerprint', 'ip_address', 'user_agent')
        }),
        ('Statistics', {
            'fields': ('report_count', 'first_seen', 'last_seen')
        }),
        ('Blocking', {
            'fields': ('is_blocked', 'blocked_reason', 'blocked_at')
        }),
    )
    
    def has_add_permission(self, request):
        return False  # Sessions are auto-created
    
    actions = ['block_sessions', 'unblock_sessions']
    
    def block_sessions(self, request, queryset):
        from django.utils import timezone
        count = queryset.update(is_blocked=True, blocked_at=timezone.now(), blocked_reason='Blocked by admin')
        self.message_user(request, f'{count} sessions blocked.')
    block_sessions.short_description = 'Block selected sessions'
    
    def unblock_sessions(self, request, queryset):
        count = queryset.update(is_blocked=False, blocked_reason=None, blocked_at=None)
        self.message_user(request, f'{count} sessions unblocked.')
    unblock_sessions.short_description = 'Unblock selected sessions'


@admin.register(SecurityOrgWhitelist)
class SecurityOrgWhitelistAdmin(admin.ModelAdmin):
    list_display = ('organization_name', 'organization_type', 'user', 'is_active', 'contact_person', 'created_at')
    list_filter = ('organization_type', 'is_active', 'created_at')
    search_fields = ('organization_name', 'contact_person', 'contact_email', 'contact_phone', 'user__username')
    fieldsets = (
        ('Organization', {
            'fields': ('organization_name', 'organization_type', 'user', 'is_active')
        }),
        ('Contact Information', {
            'fields': ('contact_person', 'contact_email', 'contact_phone')
        }),
        ('Access Control', {
            'fields': ('allowed_ip_ranges', 'allowed_vpn_names'),
            'description': 'IP ranges in CIDR notation (e.g., ["192.168.1.0/24", "10.0.0.0/8"])'
        }),
        ('Metadata', {
            'fields': ('notes', 'created_by', 'created_at', 'updated_at')
        }),
    )
    readonly_fields = ('created_at', 'updated_at')
    
    def save_model(self, request, obj, form, change):
        if not change:  # New object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(DeviceFingerprint)
class DeviceFingerprintAdmin(admin.ModelAdmin):
    list_display = ('fingerprint_hash', 'ip_address', 'report_count', 'abuse_score', 'is_blocked', 'first_seen', 'last_seen')
    list_filter = ('is_blocked', 'first_seen', 'last_seen')
    search_fields = ('fingerprint_hash', 'ip_address')
    readonly_fields = ('fingerprint_hash', 'ip_address', 'user_agent', 'first_seen', 'last_seen', 'report_count', 'metadata')
    fieldsets = (
        ('Device Info', {
            'fields': ('fingerprint_hash', 'ip_address', 'user_agent')
        }),
        ('Statistics', {
            'fields': ('report_count', 'abuse_score', 'first_seen', 'last_seen', 'metadata')
        }),
        ('Blocking', {
            'fields': ('is_blocked', 'blocked_reason', 'blocked_at')
        }),
    )
    
    def has_add_permission(self, request):
        return False  # Fingerprints are auto-created
    
    actions = ['block_devices', 'unblock_devices', 'reset_abuse_score']
    
    def block_devices(self, request, queryset):
        from django.utils import timezone
        count = queryset.update(is_blocked=True, blocked_at=timezone.now(), blocked_reason='Blocked by admin')
        self.message_user(request, f'{count} devices blocked.')
    block_devices.short_description = 'Block selected devices'
    
    def unblock_devices(self, request, queryset):
        count = queryset.update(is_blocked=False, blocked_reason=None, blocked_at=None)
        self.message_user(request, f'{count} devices unblocked.')
    unblock_devices.short_description = 'Unblock selected devices'
    
    def reset_abuse_score(self, request, queryset):
        count = queryset.update(abuse_score=0.0)
        self.message_user(request, f'Abuse score reset for {count} devices.')
    reset_abuse_score.short_description = 'Reset abuse score'


# Enhanced User Admin for Security Org User Management
User = get_user_model()

class SecurityOrgUserAdmin(BaseUserAdmin):
    """Custom admin for creating/managing Security Org Users"""
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Show all users, but filter by role in list view
        return qs
    
    list_display = BaseUserAdmin.list_display + ('is_security_org', 'is_superadmin', 'whitelist_status')
    list_filter = BaseUserAdmin.list_filter + ('groups',)
    
    def is_security_org(self, obj):
        return obj.groups.filter(name=ROLE_SECURITY_ORG).exists()
    is_security_org.boolean = True
    is_security_org.short_description = 'Security Org'
    
    def is_superadmin(self, obj):
        return obj.groups.filter(name=ROLE_SUPERADMIN).exists()
    is_superadmin.boolean = True
    is_superadmin.short_description = 'SuperAdmin'
    
    def whitelist_status(self, obj):
        if hasattr(obj, 'security_org_whitelist'):
            wl = obj.security_org_whitelist
            status = "✓ Active" if wl.is_active else "✗ Inactive"
            return f"{wl.organization_name} - {status}"
        return "Not whitelisted"
    whitelist_status.short_description = 'Whitelist Status'
    
    def save_model(self, request, obj, form, change):
        """Auto-assign SecurityOrgUser role if user is being whitelisted"""
        super().save_model(request, obj, form, change)
        
        # If user has whitelist entry, ensure they have SecurityOrgUser role
        if hasattr(obj, 'security_org_whitelist') and obj.security_org_whitelist.is_active:
            from django.contrib.auth.models import Group
            security_group, _ = Group.objects.get_or_create(name=ROLE_SECURITY_ORG)
            if security_group not in obj.groups.all():
                obj.groups.add(security_group)


# Unregister default User admin and register custom one
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass
admin.site.register(User, SecurityOrgUserAdmin)
